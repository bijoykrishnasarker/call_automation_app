import type { SupabaseClient } from '@supabase/supabase-js';

import { registerProjection } from '@/lib/vapi/idempotency';
import { logVapiInfo, logVapiWarn } from '@/lib/vapi/logger';
import type {
  CanonicalAppointmentProjection,
  CanonicalContactProjection,
  CanonicalToolCall,
  CanonicalValidationIssue,
  CanonicalVapiWebhookEnvelope,
  ProjectionDecision,
} from '@/lib/vapi/types';

function getUuid(): string {
  return (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ?? `id_${Date.now()}`;
}

function mapBookingStatus(status: string): 'Confirmed' | 'Pending' | 'Completed' {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'pending') return 'Pending';
  return 'Confirmed';
}

function parseLegacyNotes(existingNotes: unknown): Array<{ id: string; text: string; createdAt: string; type: string }> {
  return Array.isArray(existingNotes) ? (existingNotes as Array<{ id: string; text: string; createdAt: string; type: string }>) : [];
}

export async function resolveOrganizationIdForEnvelope(
  supabase: SupabaseClient,
  envelope: CanonicalVapiWebhookEnvelope
): Promise<string | null> {
  if (envelope.organization_id) return envelope.organization_id;

  if (envelope.to_number) {
    const { data: phoneRow } = await supabase
      .from('vapi_phone_numbers')
      .select('organization_id')
      .eq('e164_number', envelope.to_number)
      .maybeSingle();
    if (phoneRow?.organization_id) return phoneRow.organization_id as string;
  }

  if (envelope.provider_assistant_id) {
    const { data: assistantRow } = await supabase
      .from('vapi_assistants')
      .select('organization_id, assistant_metadata')
      .eq('vapi_assistant_id', envelope.provider_assistant_id)
      .maybeSingle();
    if (assistantRow?.organization_id) return assistantRow.organization_id as string;
    const metadataOrg = (assistantRow?.assistant_metadata as Record<string, unknown> | undefined)?.organization_id;
    if (typeof metadataOrg === 'string' && metadataOrg.trim()) return metadataOrg.trim();
  }

  return null;
}

export async function getOwnerUserIdForOrganization(
  supabase: SupabaseClient,
  organizationId: string
): Promise<string | null> {
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('owner_user_id')
    .eq('id', organizationId)
    .maybeSingle();

  const ownerUserId = orgRow?.owner_user_id;
  if (typeof ownerUserId === 'string' && ownerUserId.trim()) return ownerUserId.trim();

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return typeof profileRow?.id === 'string' && profileRow.id.trim() ? profileRow.id.trim() : null;
}

export async function recordCallArtifacts(
  supabase: SupabaseClient,
  envelope: CanonicalVapiWebhookEnvelope,
  organizationId: string
): Promise<string> {
  const { data: callRow, error: callError } = await supabase
    .from('calls')
    .upsert(
      {
        organization_id: organizationId,
        vapi_call_id: envelope.provider_call_id,
        direction: envelope.call_direction,
        from_number: envelope.from_number,
        to_number: envelope.to_number,
        status: envelope.call_status,
        started_at: envelope.call_started_at,
        ended_at: envelope.call_ended_at,
      },
      { onConflict: 'vapi_call_id' }
    )
    .select('id')
    .single();

  if (callError) throw callError;
  const callId = callRow.id as string;

  const eventProjectionKey = `${envelope.provider_delivery_id}:call-event`;
  const eventProjection = await registerProjection(supabase, {
    providerDeliveryId: envelope.provider_delivery_id,
    organizationId,
    providerCallId: envelope.provider_call_id,
    projectionKey: eventProjectionKey,
    externalResourceId: envelope.provider_call_id,
    resourceType: 'call_event',
    operation: 'insert',
    detail: { event_type: envelope.provider_event_type },
  });

  if (eventProjection === 'inserted') {
    await supabase.from('call_events').insert({
      call_id: callId,
      type: envelope.provider_event_type,
      payload: envelope.raw_payload,
    });
  }

  if (envelope.transcript_text) {
    const transcriptProjection = await registerProjection(supabase, {
      providerDeliveryId: envelope.provider_delivery_id,
      organizationId,
      providerCallId: envelope.provider_call_id,
      projectionKey: `${envelope.provider_delivery_id}:transcript`,
      externalResourceId: envelope.provider_call_id,
      resourceType: 'call_transcript',
      operation: 'insert',
    });

    if (transcriptProjection === 'inserted') {
      await supabase.from('call_transcripts').insert({
        call_id: callId,
        transcript: envelope.transcript_text,
      });
    }
  }

  return callId;
}

export async function upsertCanonicalContact(params: {
  supabase: SupabaseClient;
  organizationId: string;
  ownerUserId: string;
  contact: CanonicalContactProjection;
  envelope: CanonicalVapiWebhookEnvelope;
}): Promise<{ contactId: string; decision: ProjectionDecision }> {
  const { supabase, organizationId, ownerUserId, contact, envelope } = params;

  const { data: existingByExternal } = await supabase
    .from('contacts')
    .select('id, email, first_name, last_name, notes, created_at')
    .eq('organization_id', organizationId)
    .eq('external_contact_id', contact.external_contact_id)
    .maybeSingle();

  const { data: existingByPhone } = existingByExternal?.id
    ? { data: null }
    : await supabase
        .from('contacts')
        .select('id, email, first_name, last_name, notes, created_at')
        .eq('user_id', ownerUserId)
        .eq('phone', contact.primary_phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

  const existing = existingByExternal ?? existingByPhone;
  const nextNote = contact.notes?.trim()
    ? {
        id: getUuid(),
        text: contact.notes.trim(),
        createdAt: envelope.received_at,
        type: 'call-log',
      }
    : null;
  const existingNotes = parseLegacyNotes(existing?.notes);
  const notes = nextNote && !existingNotes.some(item => item.text === nextNote.text)
    ? [...existingNotes, nextNote]
    : existingNotes;

  if (existing?.id) {
    const { error } = await supabase
      .from('contacts')
      .update({
        organization_id: organizationId,
        external_contact_id: contact.external_contact_id,
        first_name: existing.first_name || contact.first_name,
        last_name: existing.last_name || contact.last_name,
        middle_name: contact.middle_name,
        email: existing.email || contact.email || '',
        phone: contact.primary_phone,
        primary_phone: contact.primary_phone,
        mobile_phone: contact.mobile_phone,
        company: contact.company,
        job_title: contact.job_title,
        source: contact.source,
        notes,
        last_activity: envelope.received_at,
        canonical_created_at: contact.created_at,
        last_canonical_event_at: envelope.received_at,
        updated_at: envelope.received_at,
      })
      .eq('id', existing.id);

    if (error) throw error;
    return { contactId: existing.id as string, decision: { outcome: 'updated' } };
  }

  const { data: inserted, error } = await supabase
    .from('contacts')
    .insert({
      user_id: ownerUserId,
      organization_id: organizationId,
      external_contact_id: contact.external_contact_id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      middle_name: contact.middle_name,
      email: contact.email || '',
      phone: contact.primary_phone,
      primary_phone: contact.primary_phone,
      mobile_phone: contact.mobile_phone,
      company: contact.company,
      job_title: contact.job_title,
      status: 'New Lead',
      tags: [],
      source: contact.source,
      last_activity: envelope.received_at,
      notes,
      tasks: [],
      address: null,
      city: null,
      state: null,
      zip: null,
      canonical_created_at: contact.created_at,
      last_canonical_event_at: envelope.received_at,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { contactId: inserted.id as string, decision: { outcome: 'created' } };
}

export async function checkAvailability(params: {
  supabase: SupabaseClient;
  userId: string;
  requestedStartAt: string;
  durationMinutes: number;
  requestedEndAt?: string | null;
  suggestionsCount?: number;
  suggestionWindowDays?: number;
}) {
  const {
    supabase,
    userId,
    requestedStartAt,
    durationMinutes,
    requestedEndAt,
    suggestionsCount = 3,
    suggestionWindowDays = 7,
  } = params;

  const start = new Date(requestedStartAt);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid requestedStartAt.');
  const end = requestedEndAt ? new Date(requestedEndAt) : new Date(start.getTime() + durationMinutes * 60 * 1000);
  if (Number.isNaN(end.getTime())) throw new Error('Invalid requestedEndAt.');

  const windowEnd = new Date(start.getTime() + suggestionWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('start_at, end_at')
    .eq('user_id', userId)
    .lt('start_at', windowEnd)
    .gt('end_at', start.toISOString());

  if (error) throw error;
  const intervals = (bookings ?? []).map((booking: any) => ({
    start: new Date(booking.start_at).getTime(),
    end: new Date(booking.end_at).getTime(),
  }));

  const overlaps = intervals.some(interval => start.getTime() < interval.end && end.getTime() > interval.start);
  if (!overlaps) {
    return {
      isAvailable: true,
      suggestedSlots: [{ startAt: start.toISOString(), endAt: end.toISOString() }],
    };
  }

  const suggestedSlots: Array<{ startAt: string; endAt: string }> = [];
  let cursor = start.getTime() + 30 * 60 * 1000;
  while (suggestedSlots.length < suggestionsCount) {
    const candidateStart = new Date(cursor);
    const candidateEnd = new Date(cursor + durationMinutes * 60 * 1000);
    if (candidateEnd.getTime() > new Date(windowEnd).getTime()) break;
    const candidateConflict = intervals.some(interval => candidateStart.getTime() < interval.end && candidateEnd.getTime() > interval.start);
    if (!candidateConflict) {
      suggestedSlots.push({ startAt: candidateStart.toISOString(), endAt: candidateEnd.toISOString() });
    }
    cursor += 30 * 60 * 1000;
  }

  return { isAvailable: false, suggestedSlots };
}

export async function upsertCanonicalAppointment(params: {
  supabase: SupabaseClient;
  organizationId: string;
  ownerUserId: string;
  providerAssistantId: string | null;
  providerCallId: string | null;
  contactId: string;
  appointment: CanonicalAppointmentProjection;
}): Promise<{ appointmentId: string; bookingId: string | null; decision: ProjectionDecision }> {
  const { supabase, organizationId, ownerUserId, providerAssistantId, providerCallId, contactId, appointment } = params;

  const { data: existing } = await supabase
    .from('appointments')
    .select('id, legacy_booking_id')
    .eq('organization_id', organizationId)
    .eq('external_appointment_id', appointment.external_appointment_id)
    .maybeSingle();

  let bookingId: string | null = existing?.legacy_booking_id ?? null;
  if (!bookingId) {
    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('user_id', ownerUserId)
      .lt('start_at', appointment.end_time_utc)
      .gt('end_at', appointment.start_time_utc);

    if ((conflicts ?? []).length > 0) {
      const availability = await checkAvailability({
        supabase,
        userId: ownerUserId,
        requestedStartAt: appointment.start_time_utc,
        requestedEndAt: appointment.end_time_utc,
        durationMinutes: appointment.duration_minutes,
      });

      throw new Error(JSON.stringify({
        error: 'slot_unavailable',
        suggestedSlots: availability.suggestedSlots,
      }));
    }

    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        user_id: ownerUserId,
        contact_id: contactId,
        title: appointment.subject,
        start_at: appointment.start_time_utc,
        end_at: appointment.end_time_utc,
        type: 'Service',
        status: mapBookingStatus(appointment.status),
      })
      .select('id')
      .single();
    bookingId = (booking?.id as string | undefined) ?? null;
  } else {
    await supabase
      .from('bookings')
      .update({
        contact_id: contactId,
        title: appointment.subject,
        start_at: appointment.start_time_utc,
        end_at: appointment.end_time_utc,
        status: mapBookingStatus(appointment.status),
        updated_at: appointment.updated_at,
      })
      .eq('id', bookingId);
  }

  if (existing?.id) {
    await supabase
      .from('appointments')
      .update({
        owner_user_id: ownerUserId,
        contact_id: contactId,
        contact_external_id: appointment.contact_external_id,
        subject: appointment.subject,
        location: appointment.location,
        calendar_id: appointment.calendar_id,
        recurrence: appointment.recurrence,
        status: appointment.status,
        notes: appointment.notes,
        timezone: appointment.timezone,
        date: appointment.date,
        start_time_utc: appointment.start_time_utc,
        end_time_utc: appointment.end_time_utc,
        duration_minutes: appointment.duration_minutes,
        provider_call_id: providerCallId,
        provider_assistant_id: providerAssistantId,
        legacy_booking_id: bookingId,
        updated_at: appointment.updated_at,
      })
      .eq('id', existing.id);

    return {
      appointmentId: existing.id as string,
      bookingId,
      decision: { outcome: 'updated' },
    };
  }

  const { data: inserted } = await supabase
    .from('appointments')
    .insert({
      organization_id: organizationId,
      owner_user_id: ownerUserId,
      contact_id: contactId,
      contact_external_id: appointment.contact_external_id,
      external_appointment_id: appointment.external_appointment_id,
      provider: 'vapi',
      provider_call_id: providerCallId,
      provider_assistant_id: providerAssistantId,
      subject: appointment.subject,
      location: appointment.location,
      calendar_id: appointment.calendar_id,
      recurrence: appointment.recurrence,
      status: appointment.status,
      notes: appointment.notes,
      timezone: appointment.timezone,
      date: appointment.date,
      start_time_utc: appointment.start_time_utc,
      end_time_utc: appointment.end_time_utc,
      duration_minutes: appointment.duration_minutes,
      legacy_booking_id: bookingId,
      created_at: appointment.created_at,
      updated_at: appointment.updated_at,
    })
    .select('id')
    .single();

  return {
    appointmentId: inserted.id as string,
    bookingId,
    decision: { outcome: 'created' },
  };
}

export async function executeToolCalls(params: {
  supabase: SupabaseClient;
  organizationId: string;
  ownerUserId: string;
  envelope: CanonicalVapiWebhookEnvelope;
  callId: string;
  toolCalls: CanonicalToolCall[];
}): Promise<Array<{ toolCallId: string; result?: string; error?: string }>> {
  const { supabase, organizationId, ownerUserId, envelope, callId, toolCalls } = params;
  const { data: settings } = await supabase
    .from('ai_receptionists')
    .select('can_take_messages, can_book_appointments')
    .eq('organization_id', organizationId)
    .maybeSingle();

  const results: Array<{ toolCallId: string; result?: string; error?: string }> = [];
  for (const toolCall of toolCalls) {
    try {
      if (toolCall.validation_errors.length > 0) {
        results.push({
          toolCallId: toolCall.id,
          error: toolCall.validation_errors.map(issue => issue.message).join(' '),
        });
        continue;
      }

      if (toolCall.name === 'take_message') {
        if (!settings?.can_take_messages) {
          results.push({ toolCallId: toolCall.id, error: 'Tool take_message is not enabled.' });
          continue;
        }
        const projection = await registerProjection(supabase, {
          providerDeliveryId: envelope.provider_delivery_id,
          organizationId,
          providerCallId: envelope.provider_call_id,
          projectionKey: `${envelope.provider_delivery_id}:tool:${toolCall.id}:message`,
          externalResourceId: toolCall.contact?.external_contact_id ?? null,
          resourceType: 'receptionist_message',
          operation: 'insert',
        });

        if (projection === 'inserted' && toolCall.message_text) {
          await supabase.from('receptionist_messages').insert({
            organization_id: organizationId,
            call_id: callId,
            from_number: toolCall.contact?.primary_phone ?? envelope.from_number,
            customer_name: toolCall.contact ? `${toolCall.contact.first_name} ${toolCall.contact.last_name}`.trim() : null,
            message: toolCall.message_text,
            raw_arguments: toolCall.arguments,
          });
        }

        if (toolCall.contact) {
          await upsertCanonicalContact({
            supabase,
            organizationId,
            ownerUserId,
            contact: toolCall.contact,
            envelope,
          });
        }

        results.push({ toolCallId: toolCall.id, result: 'ok' });
        continue;
      }

      if (toolCall.name === 'check_availability') {
        if (!settings?.can_book_appointments) {
          results.push({ toolCallId: toolCall.id, error: 'Tool check_availability is not enabled.' });
          continue;
        }

        if (!toolCall.availability_request) {
          results.push({ toolCallId: toolCall.id, error: 'Availability request is incomplete.' });
          continue;
        }

        const availability = await checkAvailability({
          supabase,
          userId: ownerUserId,
          requestedStartAt: toolCall.availability_request.requested_start_at,
          requestedEndAt: toolCall.availability_request.requested_end_at,
          durationMinutes: toolCall.availability_request.duration_minutes,
        });

        results.push({ toolCallId: toolCall.id, result: JSON.stringify(availability) });
        continue;
      }

      if (toolCall.name === 'book_appointment') {
        if (!settings?.can_book_appointments) {
          results.push({ toolCallId: toolCall.id, error: 'Tool book_appointment is not enabled.' });
          continue;
        }

        if (!toolCall.contact || !toolCall.appointment) {
          results.push({ toolCallId: toolCall.id, error: 'Appointment payload is incomplete.' });
          continue;
        }

        try {
          const contactResult = await upsertCanonicalContact({
            supabase,
            organizationId,
            ownerUserId,
            contact: toolCall.contact,
            envelope,
          });
          const appointmentResult = await upsertCanonicalAppointment({
            supabase,
            organizationId,
            ownerUserId,
            providerAssistantId: envelope.provider_assistant_id,
            providerCallId: envelope.provider_call_id,
            contactId: contactResult.contactId,
            appointment: toolCall.appointment,
          });

          logVapiInfo('vapi.tool.book_appointment', {
            organization_id: organizationId,
            provider_call_id: envelope.provider_call_id,
            external_appointment_id: toolCall.appointment.external_appointment_id,
            booking_id: appointmentResult.bookingId,
          });

          results.push({
            toolCallId: toolCall.id,
            result: JSON.stringify({
              booked: true,
              appointmentId: appointmentResult.appointmentId,
              bookingId: appointmentResult.bookingId,
            }),
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : '';
          if (errMsg.includes('slot_unavailable')) {
            let suggested: any[] = [];
            try {
              suggested = JSON.parse(errMsg).suggestedSlots || [];
            } catch {
              // ignore parse errors
            }
            results.push({
              toolCallId: toolCall.id,
              result: JSON.stringify({
                booked: false,
                error: 'slot_unavailable',
                message: 'This slot is already booked.',
                suggestedSlots: suggested
              })
            });
          } else {
            throw err;
          }
        }
        continue;
      }

      results.push({ toolCallId: toolCall.id, error: `Tool ${toolCall.name} not enabled or not supported` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      logVapiWarn('vapi.tool.error', {
        organization_id: organizationId,
        provider_call_id: envelope.provider_call_id,
        tool_call_id: toolCall.id,
        tool_name: toolCall.name,
        message,
      });
      results.push({ toolCallId: toolCall.id, error: message.replace(/\s+/g, ' ') });
    }
  }

  return results;
}

export async function persistEnvelope(params: {
  supabase: SupabaseClient;
  envelope: CanonicalVapiWebhookEnvelope;
  organizationId: string;
  validationErrors: CanonicalValidationIssue[];
}) {
  const { supabase, envelope, organizationId } = params;
  const ownerUserId = await getOwnerUserIdForOrganization(supabase, organizationId);
  if (!ownerUserId) {
    throw new Error('No owner user mapping found for organization.');
  }

  const callId = await recordCallArtifacts(supabase, envelope, organizationId);

  let contactResult: { contactId: string; decision: ProjectionDecision } | null = null;
  if (envelope.contact) {
    contactResult = await upsertCanonicalContact({
      supabase,
      organizationId,
      ownerUserId,
      contact: envelope.contact,
      envelope,
    });
  }

  let appointmentResult: { appointmentId: string; bookingId: string | null; decision: ProjectionDecision } | null = null;
  if (envelope.appointment && contactResult) {
    try {
      appointmentResult = await upsertCanonicalAppointment({
        supabase,
        organizationId,
        ownerUserId,
        providerAssistantId: envelope.provider_assistant_id,
        providerCallId: envelope.provider_call_id,
        contactId: contactResult.contactId,
        appointment: envelope.appointment,
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '';
      if (errMsg.includes('slot_unavailable')) {
        logVapiWarn('vapi.projection.appointment.slot_conflict', {
          organization_id: organizationId,
          provider_call_id: envelope.provider_call_id,
          message: 'Appointment projection skipped due to slot conflict',
        });
      } else {
        throw e;
      }
    }
  }

  return {
    callId,
    ownerUserId,
    contactResult,
    appointmentResult,
    toolResults:
      envelope.provider_event_type === 'tool-calls' || envelope.tool_calls.length > 0
        ? await executeToolCalls({
            supabase,
            organizationId,
            ownerUserId,
            envelope,
            callId,
            toolCalls: envelope.tool_calls,
          })
        : [],
  };
}
