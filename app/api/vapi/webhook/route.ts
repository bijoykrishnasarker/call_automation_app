import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { buildContactFromVapiPayload, extractVapiStructuredData } from '@/lib/vapi/contact-normalization';

function extractOrganizationId(payload: any): string | null {
  return payload?.message?.call?.metadata?.organizationId ||
         payload?.message?.call?.metadata?.organization_id ||
         payload?.message?.call?.assistant?.metadata?.organizationId ||
         payload?.message?.call?.assistant?.metadata?.organization_id ||
         payload?.metadata?.organizationId ||
         payload?.metadata?.organization_id ||
         payload?.call?.metadata?.organizationId ||
         null;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Bad Request', message: 'Content-Type must be application/json.' }, { status: 400 });
  }

  // 4. Validate VAPI_WEBHOOK_SECRET
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (token !== secret) {
      return NextResponse.json({ error: 'Unauthorized'}, { status: 401 });
    }
  }

  const rawBody = await request.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid JSON body' }, { status: 400 });
  }

  const eventType = payload?.message?.type || payload?.type;

  // 5. For non-final events, return 200 quickly.
  if (['call-started', 'conversation-update', 'speech-update', 'function-call'].includes(eventType)) {
    return NextResponse.json({ ok: true, note: 'non-final event ignored' }, { status: 200 });
  }

  // 6. For final events process payload
  if (!['end-of-call-report', 'call-ended', 'call.ended'].includes(eventType)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const supabase = createSupabaseServiceClient();

  // 7. Extract fields
  const message = payload.message || {};
  const call = message.call || payload.call || {};
  const vapi_call_id = call.id;
  const vapi_assistant_id = call.assistantId;
  const caller_phone = message.customer?.number || call.customer?.number || call.from_number;
  const transcript = message.transcript || payload.transcript || null;
  const summary = message.summary || payload.summary || null;
  const raw_structured_data = extractVapiStructuredData(payload);
  const organization_id = extractOrganizationId(payload);

  if (!vapi_call_id) {
    return NextResponse.json({ error: 'Bad Request', message: 'Missing call ID' }, { status: 400 });
  }

  // 8. Normalize and validate contact fields
  const contactData = buildContactFromVapiPayload(payload);

  // Default to organization matching or fallback
  const finalOrgId = organization_id; // Using service role, it can insert as-is.

  // Save the Call (Part C Idempotency included via unique vapi_call_id handling usually, or we do upsert)
  const callPayload = {
    organization_id: finalOrgId,
    vapi_call_id,
    vapi_assistant_id,
    caller_phone,
    full_name: contactData.fullName,
    email: contactData.email || contactData.emailSpoken,
    email_confirmed: contactData.emailConfirmed,
    requested_service: contactData.requestedService,
    preferred_date: contactData.preferredDate,
    preferred_time: contactData.preferredTime,
    message: contactData.message,
    call_reason: contactData.callReason,
    contact_complete: contactData.contactComplete,
    needs_human_review: contactData.needsHumanReview,
    missing_fields: contactData.missingFields,
    transcript,
    summary,
    raw_payload: payload,
    raw_structured_data,
    status: 'completed',
    direction: call.direction || 'inbound',
  };

  const { data: callRow, error: callError } = await supabase
    .from('calls')
    .upsert(callPayload, { onConflict: 'vapi_call_id' })
    .select('id')
    .single();

  if (callError) {
    console.error('Error saving call:', callError);
  }

  // 9. If email is invalid or emailConfirmed is false: do not mark contactComplete
  // 10. If name/phone/email are valid enough: upsert contact/lead in Supabase.
  let contactSaved = false;

  // We should fetch the ownerUserId for the org if we add to the contacts table
  let ownerUserId: string | null = null;
  if (finalOrgId) {
    const { data: orgData } = await supabase.from('organizations').select('owner_user_id').eq('id', finalOrgId).single();
    if (orgData) ownerUserId = orgData.owner_user_id;
  }

  if (ownerUserId && (contactData.phone || contactData.email)) {
    // Determine existing contact
    let existingContact = null;
    
    if (contactData.email) {
      const { data: existingEmail } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, notes, email')
        .eq('organization_id', finalOrgId)
        .eq('email', contactData.email)
        .limit(1)
        .maybeSingle();
      existingContact = existingEmail;
    }

    if (!existingContact && contactData.phone) {
      const { data: existingPhone } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, notes, email')
        .eq('organization_id', finalOrgId)
        .eq('phone', contactData.phone)
        .limit(1)
        .maybeSingle();
      existingContact = existingPhone;
    }

    const first_name = contactData.fullName ? contactData.fullName.split(' ')[0] : 'Unknown';
    const last_name = contactData.fullName && contactData.fullName.split(' ').length > 1 ? contactData.fullName.split(' ').slice(1).join(' ') : 'Caller';

    if (existingContact) {
      // Update
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          first_name: existingContact.first_name !== 'Unknown' ? existingContact.first_name : first_name,
          last_name: existingContact.last_name !== 'Caller' ? existingContact.last_name : last_name,
          email: contactData.email || existingContact.email,
          email_confirmed: contactData.emailConfirmed || undefined,
          phone: contactData.phone,
          last_activity: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingContact.id);
      
      if (!updateError) contactSaved = true;
    } else {
      // Insert
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          user_id: ownerUserId,
          organization_id: finalOrgId,
          first_name,
          last_name,
          email: contactData.email || '',
          email_confirmed: contactData.emailConfirmed,
          phone: contactData.phone || '',
          status: 'New Lead',
          source: 'Vapi Call',
          last_activity: new Date().toISOString()
        });

      if (!insertError) contactSaved = true;
    }
  }

  // Development-safe logging (Part D)
  console.log('[VAPI Webhook]', {
    event_type: eventType,
    vapi_call_id,
    vapi_assistant_id,
    extracted_structured_data: raw_structured_data,
    normalized_contact: contactData,
    contactSaved,
    needsHumanReview: contactData.needsHumanReview
  });

  return NextResponse.json({
    ok: true,
    processed: true,
    contactSaved,
    needsHumanReview: contactData.needsHumanReview
  }, { status: 200 });
}
