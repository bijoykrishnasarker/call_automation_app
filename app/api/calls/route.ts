import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function GET(request: NextRequest) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = createSupabaseClientForUser(accessToken);
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const organizationId = await getOrganizationIdForUser(supabase, user.id);
  if (organizationId === null) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'No organization access' },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from('calls')
    .select('id, direction, from_number, to_number, status, started_at, ended_at, created_at, vapi_call_id, full_name, email, email_confirmed, needs_human_review, missing_fields, summary, caller_phone, requested_service, preferred_date, preferred_time, message, call_reason, transcript, contact_complete')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[GET /api/calls]', error);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  return NextResponse.json({ calls: data ?? [] });
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(request: NextRequest) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const supabase = createSupabaseClientForUser(accessToken);
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      { status: 401 }
    );
  }

  const organizationId = await getOrganizationIdForUser(supabase, user.id);
  if (organizationId === null) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'No organization access' },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const callId = pickString(body.id);
  if (!callId) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Call id is required' },
      { status: 400 }
    );
  }

  const fullName = pickString(body.fullName);
  const email = pickString(body.email);
  const phone = pickString(body.phone);
  const message = pickString(body.message);
  const requestedService = pickString(body.requestedService);

  const missing: string[] = [];
  if (!fullName) missing.push('name');
  if (!phone) missing.push('phone');
  if (!email) missing.push('email');

  const { data: updated, error } = await supabase
    .from('calls')
    .update({
      full_name: fullName || null,
      email: email || null,
      email_confirmed: Boolean(email),
      caller_phone: phone || null,
      message: message || null,
      requested_service: requestedService || null,
      needs_human_review: false,
      contact_complete: Boolean(fullName && (phone || email)),
      missing_fields: missing,
      updated_at: new Date().toISOString(),
    })
    .eq('id', callId)
    .eq('organization_id', organizationId)
    .select('id, direction, from_number, to_number, status, started_at, ended_at, created_at, vapi_call_id, full_name, email, email_confirmed, needs_human_review, missing_fields, summary, caller_phone, requested_service, preferred_date, preferred_time, message, call_reason, transcript, contact_complete')
    .maybeSingle();

  if (error) {
    console.error('[PATCH /api/calls]', error);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: 'Not found', message: 'Call not found' },
      { status: 404 }
    );
  }

  if (fullName && (phone || email)) {
    const nameParts = fullName.split(/\s+/);
    const firstName = nameParts[0] ?? fullName;
    const lastName = nameParts.slice(1).join(' ') || '—';
    const note = {
      id: crypto.randomUUID(),
      text: message || 'Reviewed from Recent Calls.',
      createdAt: new Date().toISOString(),
      type: 'call-log',
    };

    let existing: { id: string; notes: unknown } | null = null;
    if (phone) {
      const { data } = await supabase
        .from('contacts')
        .select('id, notes')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = data;
    }
    if (!existing?.id && email) {
      const { data } = await supabase
        .from('contacts')
        .select('id, notes')
        .eq('user_id', user.id)
        .eq('email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      existing = data;
    }

    const existingNotes = Array.isArray(existing?.notes) ? existing.notes : [];
    if (existing?.id) {
      await supabase
        .from('contacts')
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email || undefined,
          phone: phone || undefined,
          notes: [...existingNotes, note],
          last_activity: 'Call reviewed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('contacts').insert({
        user_id: user.id,
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email: email || '',
        phone: phone || '',
        status: 'New Lead',
        source: 'Voice call review',
        last_activity: 'Call reviewed',
        notes: [note],
      });
    }
  }

  return NextResponse.json({ call: updated });
}


