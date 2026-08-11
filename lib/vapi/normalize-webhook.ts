import { createHash } from 'node:crypto';

import {
  extractEmailFromConversation,
  extractNameFromConversation,
  extractPhoneFromConversation,
  gatherConversationText,
  normalizePhone,
  parseAppointmentFromConversation,
  pickFirstString,
  splitFullName,
} from '@/lib/vapi/conversation';
import { inferDefaultTimezone, resolveAppointmentWindow } from '@/lib/vapi/time';
import type {
  CanonicalAppointmentProjection,
  CanonicalAuthContext,
  CanonicalContactProjection,
  CanonicalToolCall,
  CanonicalValidationIssue,
  CanonicalVapiWebhookEnvelope,
} from '@/lib/vapi/types';

function setTrace(trace: Record<string, string[]>, field: string, path: string | undefined) {
  if (!path) return;
  if (!trace[field]) trace[field] = [];
  trace[field]!.push(path);
}

function addValidationIssue(
  issues: CanonicalValidationIssue[],
  path: string,
  code: string,
  message: string
) {
  issues.push({ path, code, message });
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function normalizeDbCallDirection(raw: unknown): 'inbound' | 'outbound' {
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'outbound') return 'outbound';
  return 'inbound';
}

function resolveCallDirection(call: Record<string, unknown>, message: Record<string, unknown>): 'inbound' | 'outbound' {
  const direct = coerceString(call.direction) ?? coerceString(message.direction);
  if (direct && direct.toLowerCase() === 'outbound') return 'outbound';
  const callType = coerceString(call.type)?.toLowerCase() ?? '';
  if (callType.includes('outbound')) return 'outbound';
  return 'inbound';
}

function extractCallIdFromArtifact(message: Record<string, unknown>): string | undefined {
  const artifact = message.artifact;
  if (!artifact || typeof artifact !== 'object') return undefined;
  const record = artifact as Record<string, unknown>;
  return coerceString(record.callId) ?? coerceString(record.call_id) ?? coerceString((record.call as Record<string, unknown> | undefined)?.id);
}

function pickCallMessage(body: Record<string, unknown>) {
  const items: Record<string, unknown>[] = [];
  if (Array.isArray(body.message)) {
    for (const item of body.message) {
      if (item && typeof item === 'object') items.push(item as Record<string, unknown>);
    }
  } else if (body.message && typeof body.message === 'object') {
    items.push(body.message as Record<string, unknown>);
  }
  items.push(body);

  for (const item of items) {
    let call = item.call as Record<string, unknown> | undefined;
    if (!call || typeof call !== 'object') {
      const flatId = coerceString(item.callId) ?? coerceString(body.callId) ?? extractCallIdFromArtifact(item);
      if (!flatId) continue;
      call = { id: flatId };
    }

    const callId = coerceString(call.id) ?? coerceString(item.callId) ?? coerceString(body.callId);
    if (!callId) continue;

    return {
      message: item,
      call: {
        ...call,
        id: callId,
        direction: resolveCallDirection(call, item),
      },
      eventType: coerceString(item.type) ?? coerceString(body.type) ?? 'unknown',
    };
  }

  return null;
}

function extractOrganizationCandidate(payload: Record<string, unknown>, call: Record<string, unknown>): string | null {
  const assistant = call.assistant as Record<string, unknown> | undefined;
  const assistantMetadata = assistant?.metadata as Record<string, unknown> | undefined;
  const callMetadata = call.metadata as Record<string, unknown> | undefined;
  const payloadMetadata = payload.metadata as Record<string, unknown> | undefined;
  const message = payload.message && typeof payload.message === 'object' ? (payload.message as Record<string, unknown>) : undefined;
  const messageMetadata = message?.metadata as Record<string, unknown> | undefined;

  return (
    pickFirstString(
      callMetadata?.organizationId,
      callMetadata?.organization_id,
      assistantMetadata?.organizationId,
      assistantMetadata?.organization_id,
      payloadMetadata?.organizationId,
      payloadMetadata?.organization_id,
      messageMetadata?.organizationId,
      messageMetadata?.organization_id
    ) ?? null
  );
}

function buildExternalContactId(organizationId: string | null, phone: string, providerContactId?: string | null) {
  if (providerContactId) return `vapi:${providerContactId}`;
  return `vapi:${organizationId ?? 'unknown'}:${phone}`;
}

function buildExternalAppointmentId(
  providerCallId: string | null,
  startTimeUtc: string,
  resourceId?: string | null
) {
  return `vapi:${providerCallId ?? 'unknown'}:appointment:${resourceId ?? startTimeUtc}`;
}

function buildCanonicalContact(input: {
  organizationId: string | null;
  phone: string | null;
  name: string | undefined;
  email: string | undefined;
  notes: string | undefined;
  source: string;
  createdAt: string;
  validationErrors: CanonicalValidationIssue[];
  trace: Record<string, string[]>;
  providerContactId?: string | null;
}): CanonicalContactProjection | null {
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) {
    if (input.phone) {
      addValidationIssue(input.validationErrors, 'contact.primary_phone', 'invalid_phone', 'Contact phone number is invalid.');
    }
    return null;
  }

  const nameParts = splitFullName(input.name);

  return {
    external_contact_id: buildExternalContactId(input.organizationId, normalizedPhone, input.providerContactId),
    first_name: nameParts.firstName,
    last_name: nameParts.lastName,
    middle_name: nameParts.middleName,
    email: input.email?.toLowerCase() ?? null,
    primary_phone: normalizedPhone,
    mobile_phone: normalizedPhone,
    company: null,
    job_title: null,
    source: input.source,
    notes: input.notes?.trim() || null,
    created_at: input.createdAt,
  };
}

function buildCanonicalAppointment(input: {
  organizationId: string | null;
  providerCallId: string | null;
  contact: CanonicalContactProjection | null;
  startAt?: string | null;
  endAt?: string | null;
  localDate?: string | null;
  localTime?: string | null;
  timezone?: string | null;
  durationMinutes?: number | null;
  subject?: string | null;
  location?: string | null;
  calendarId?: string | null;
  recurrence?: Record<string, unknown> | null;
  status?: string | null;
  notes?: string | null;
  resourceId?: string | null;
  createdAt: string;
  updatedAt: string;
  validationErrors: CanonicalValidationIssue[];
  warnings: string[];
  tracePath: string;
}): CanonicalAppointmentProjection | null {
  if (!input.contact) {
    addValidationIssue(input.validationErrors, `${input.tracePath}.contact`, 'missing_contact', 'Appointment requires a canonical contact.');
    return null;
  }

  const resolved = resolveAppointmentWindow({
    startAt: input.startAt,
    endAt: input.endAt,
    localDate: input.localDate,
    localTime: input.localTime,
    timezone: input.timezone,
    durationMinutes: input.durationMinutes,
    tracePath: input.tracePath,
  });

  if (!resolved) {
    addValidationIssue(input.validationErrors, input.tracePath, 'invalid_appointment_window', 'Appointment window could not be resolved.');
    return null;
  }

  if (resolved.validation_errors.length > 0) {
    input.validationErrors.push(...resolved.validation_errors);
    return null;
  }

  input.warnings.push(...resolved.warnings);

  const subject = input.subject?.trim();
  if (!subject) {
    addValidationIssue(input.validationErrors, `${input.tracePath}.subject`, 'missing_subject', 'Appointment subject is required.');
    return null;
  }

  return {
    external_appointment_id: buildExternalAppointmentId(
      input.providerCallId,
      resolved.start_time_utc,
      input.resourceId
    ),
    contact_external_id: input.contact.external_contact_id,
    start_time_utc: resolved.start_time_utc,
    end_time_utc: resolved.end_time_utc,
    date: resolved.date,
    timezone: resolved.timezone,
    duration_minutes: resolved.duration_minutes,
    subject,
    location: input.location?.trim() || null,
    calendar_id: input.calendarId?.trim() || null,
    recurrence: input.recurrence ?? null,
    status: input.status?.trim() || 'confirmed',
    notes: input.notes?.trim() || null,
    created_at: input.createdAt,
    updated_at: input.updatedAt,
  };
}

function normalizeToolCall(
  toolCall: Record<string, unknown>,
  context: {
    organizationId: string | null;
    providerCallId: string | null;
    occurredAt: string;
  }
): CanonicalToolCall {
  const validation_errors: CanonicalValidationIssue[] = [];
  const warnings: string[] = [];
  const id = coerceString(toolCall.id) ?? `tool-${Math.random().toString(36).slice(2)}`;
  const name = coerceString(toolCall.name) ?? 'unknown';

  let args: Record<string, unknown> = {};
  const rawArgs = toolCall.parameters ?? toolCall.arguments ?? {};
  if (typeof rawArgs === 'string') {
    try {
      const parsed = JSON.parse(rawArgs);
      if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>;
    } catch {
      addValidationIssue(validation_errors, `tool_calls.${id}.arguments`, 'invalid_json', 'Tool arguments must be valid JSON.');
    }
  } else if (rawArgs && typeof rawArgs === 'object') {
    args = rawArgs as Record<string, unknown>;
  }

  const messageText = pickFirstString(args.message, args.note, args.details);
  const nameValue = pickFirstString(args.customerName, args.customer_name, args.name);
  const emailValue = pickFirstString(args.customerEmail, args.customer_email, args.email);
  const phoneValue =
    pickFirstString(args.customerPhone, args.customer_phone, args.phone, args.from_number) ??
    extractPhoneFromConversation(messageText ?? '');

  const contact = buildCanonicalContact({
    organizationId: context.organizationId,
    phone: phoneValue ?? null,
    name: nameValue ?? extractNameFromConversation(messageText ?? ''),
    email: emailValue ?? extractEmailFromConversation(messageText ?? ''),
    notes: messageText,
    source: `Vapi tool:${name}`,
    createdAt: context.occurredAt,
    validationErrors: validation_errors,
    trace: {},
  });

  let appointment: CanonicalAppointmentProjection | null = null;
  let availability_request: CanonicalToolCall['availability_request'] = null;

  if (name === 'check_availability') {
    const requestedStartAt = pickFirstString(args.requestedStartAt, args.startAt, args.requested_start_at);
    const requestedEndAt = pickFirstString(args.requestedEndAt, args.endAt, args.requested_end_at);
    const durationMinutes = Number(args.durationMinutes ?? args.duration_minutes ?? 30);
    const timezone = pickFirstString(args.timezone) ?? inferDefaultTimezone() ?? 'UTC';

    if (!requestedStartAt) {
      addValidationIssue(validation_errors, `tool_calls.${id}.requestedStartAt`, 'missing_start', 'Availability checks require requestedStartAt.');
    } else {
      availability_request = {
        requested_start_at: requestedStartAt,
        requested_end_at: requestedEndAt ?? null,
        duration_minutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? Math.floor(durationMinutes) : 30,
        timezone,
      };
    }
  }

  if (name === 'book_appointment') {
      appointment = buildCanonicalAppointment({
        organizationId: context.organizationId,
        providerCallId: context.providerCallId,
        contact,
        startAt: pickFirstString(args.startAt, args.start_at),
        endAt: pickFirstString(args.endAt, args.end_at),
        localDate: pickFirstString(args.localDate, args.local_date, args.date),
        localTime: pickFirstString(args.localTime, args.local_time, args.time),
        timezone: pickFirstString(args.timezone) ?? inferDefaultTimezone(),
        durationMinutes: Number(args.durationMinutes ?? args.duration_minutes ?? 0),
      subject: pickFirstString(args.subject, args.title) ?? 'Appointment',
      location: pickFirstString(args.location),
      calendarId: pickFirstString(args.calendarId, args.calendar_id),
      recurrence: (args.recurrence as Record<string, unknown> | undefined) ?? null,
      status: pickFirstString(args.status) ?? 'confirmed',
      notes: pickFirstString(args.callNotes, args.call_notes, args.notes, args.reason),
      resourceId: pickFirstString(args.externalAppointmentId, args.external_appointment_id),
      createdAt: context.occurredAt,
      updatedAt: context.occurredAt,
      validationErrors: validation_errors,
      warnings,
      tracePath: `tool_calls.${id}`,
    });
  }

  return {
    id,
    name,
    arguments: args,
    validation_errors,
    warnings,
    contact,
    appointment,
    message_text: messageText ?? null,
    availability_request,
  };
}

export function applyResolvedOrganizationIds(
  envelope: CanonicalVapiWebhookEnvelope,
  organizationId: string
): CanonicalVapiWebhookEnvelope {
  const rewriteContact = (contact: CanonicalContactProjection | null) => {
    if (!contact) return null;
    const providerContactId = contact.external_contact_id.startsWith('vapi:') && !contact.external_contact_id.includes(':unknown:')
      ? null
      : null;
    return {
      ...contact,
      external_contact_id: buildExternalContactId(organizationId, contact.primary_phone, providerContactId),
    };
  };

  const contact = rewriteContact(envelope.contact);
  const appointment = envelope.appointment && contact
    ? {
        ...envelope.appointment,
        contact_external_id: contact.external_contact_id,
      }
    : envelope.appointment;

  return {
    ...envelope,
    organization_id: organizationId,
    contact,
    appointment,
    tool_calls: envelope.tool_calls.map(toolCall => {
      const updatedContact = rewriteContact(toolCall.contact);
      const updatedAppointment = toolCall.appointment && updatedContact
        ? {
            ...toolCall.appointment,
            contact_external_id: updatedContact.external_contact_id,
          }
        : toolCall.appointment;

      return {
        ...toolCall,
        contact: updatedContact,
        appointment: updatedAppointment,
      };
    }),
  };
}

export function normalizeVapiWebhook(input: {
  payload: Record<string, unknown>;
  rawBody: string;
  receivedAt: string;
  authContext: CanonicalAuthContext;
  headers: Headers;
}): CanonicalVapiWebhookEnvelope {
  const validation_errors: CanonicalValidationIssue[] = [];
  const warnings: string[] = [];
  const trace: Record<string, string[]> = {};
  const hash = createHash('sha256').update(input.rawBody).digest('hex');
  const picked = pickCallMessage(input.payload);

  if (!picked) {
    addValidationIssue(validation_errors, 'call.id', 'missing_call', 'Webhook payload does not contain a resolvable Vapi call.');
  }

  const message = (picked?.message ?? {}) as Record<string, unknown>;
  const call = (picked?.call ?? {}) as Record<string, unknown>;
  const provider_event_type = picked?.eventType ?? coerceString(input.payload.type) ?? 'unknown';
  const provider_call_id = coerceString(call.id) ?? null;
  const provider_assistant_id =
    coerceString(call.assistantId) ??
    coerceString((call.assistant as Record<string, unknown> | undefined)?.id) ??
    null;
  const organization_id = extractOrganizationCandidate(input.payload, call);
  const occurred_at =
    pickFirstString(
      message.timestamp,
      call.updatedAt,
      call.endedAt,
      call.startedAt,
      input.payload.timestamp,
      input.payload.createdAt
    ) ?? input.receivedAt;
  const provider_delivery_id =
    input.headers.get('x-vapi-delivery-id') ??
    input.headers.get('x-webhook-id') ??
    coerceString(input.payload.id) ??
    coerceString(message.id) ??
    `${provider_event_type}:${provider_call_id ?? 'none'}:${hash}`;

  const from_number = normalizePhone(
    pickFirstString(
      (call.from as Record<string, unknown> | undefined)?.number,
      call.from_number,
      message.from_number
    ) ?? ''
  ) || null;
  const to_number = normalizePhone(
    pickFirstString(
      (call.to as Record<string, unknown> | undefined)?.number,
      call.to_number,
      message.to_number
    ) ?? ''
  ) || null;

  const transcript_text = gatherConversationText(message as Record<string, any>, input.payload as Record<string, any>) || null;
  const customerName =
    pickFirstString(
      (call.customer as Record<string, unknown> | undefined)?.name,
      call.customerName,
      (message.analysis as Record<string, any> | undefined)?.structuredData?.customerName,
      (message.analysis as Record<string, any> | undefined)?.structuredData?.customer_name
    ) ?? extractNameFromConversation(transcript_text ?? '');
  const customerEmail =
    pickFirstString(
      (call.customer as Record<string, unknown> | undefined)?.email,
      (message.analysis as Record<string, any> | undefined)?.structuredData?.customerEmail,
      (message.analysis as Record<string, any> | undefined)?.structuredData?.customer_email
    ) ?? extractEmailFromConversation(transcript_text ?? '');
  const customerPhone = from_number ?? (normalizePhone(extractPhoneFromConversation(transcript_text ?? '') ?? '') || null);

  setTrace(trace, 'provider_event_type', 'message.type');
  setTrace(trace, 'provider_call_id', 'call.id');
  setTrace(trace, 'organization_id', organization_id ? 'metadata.organization_id' : undefined);

  const contact = buildCanonicalContact({
    organizationId: organization_id,
    phone: customerPhone,
    name: customerName,
    email: customerEmail,
    notes: transcript_text ?? undefined,
    source: 'Vapi webhook',
    createdAt: occurred_at,
    validationErrors: validation_errors,
    trace,
  });

  let appointment: CanonicalAppointmentProjection | null = null;
  const guessedAppointment = transcript_text ? parseAppointmentFromConversation(transcript_text, new Date(occurred_at)) : null;
  if (guessedAppointment && contact) {
    const defaultTimezone = inferDefaultTimezone();
    if (!defaultTimezone) {
      warnings.push('transcript_appointment_skipped_missing_default_timezone');
    } else {
      appointment = buildCanonicalAppointment({
        organizationId: organization_id,
        providerCallId: provider_call_id,
        contact,
        localDate: `${guessedAppointment.year}-${String(guessedAppointment.month).padStart(2, '0')}-${String(guessedAppointment.day).padStart(2, '0')}`,
        localTime: `${String(guessedAppointment.hour).padStart(2, '0')}:${String(guessedAppointment.minute).padStart(2, '0')}`,
        timezone: defaultTimezone,
        durationMinutes: guessedAppointment.durationMinutes,
        subject: 'Appointment',
        notes: 'Booked automatically from call transcript (AI receptionist).',
        createdAt: occurred_at,
        updatedAt: occurred_at,
        validationErrors: validation_errors,
        warnings,
        tracePath: 'appointment',
      });
    }
  }

  const tool_calls_source = Array.isArray(message.toolCallList)
    ? message.toolCallList
    : input.payload.toolCall
      ? [input.payload.toolCall]
      : [];
  const tool_calls = tool_calls_source
    .filter(item => item && typeof item === 'object')
    .map(item => normalizeToolCall(item as Record<string, unknown>, {
      organizationId: organization_id,
      providerCallId: provider_call_id,
      occurredAt: occurred_at,
    }));

  if (!provider_call_id) {
    addValidationIssue(validation_errors, 'provider_call_id', 'missing_call_id', 'Webhook payload must include a provider call id.');
  }

  if (!organization_id) {
    warnings.push('organization_id_requires_database_resolution');
  }

  return {
    provider: 'vapi',
    provider_event_type,
    provider_delivery_id,
    provider_call_id,
    provider_assistant_id,
    organization_id,
    occurred_at,
    received_at: input.receivedAt,
    raw_payload: input.payload,
    raw_payload_sha256: hash,
    auth_context: input.authContext,
    contact,
    appointment,
    trace,
    validation_errors,
    warnings,
    tool_calls,
    transcript_text,
    call_direction: normalizeDbCallDirection(call.direction),
    call_status: coerceString(call.status) ?? null,
    call_started_at: coerceString(call.startedAt) ?? null,
    call_ended_at: coerceString(call.endedAt) ?? null,
    from_number,
    to_number,
  };
}
