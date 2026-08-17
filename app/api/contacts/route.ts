import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import {
  friendlyContactWriteError,
  isMissingColumnError,
  missingColumnName,
} from '@/lib/ai-receptionist/supabase-errors';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';
const OPTIONAL_CONTACT_COLUMNS = [
  'primary_phone',
  'middle_name',
  'mobile_phone',
  'job_title',
  'canonical_created_at',
  'last_canonical_event_at',
  'organization_id',
  'external_contact_id',
];

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function insertContactRow(
  supabase: ReturnType<typeof createSupabaseClientForUser>,
  payload: Record<string, unknown>
) {
  let current = { ...payload };
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase.from('contacts').insert(current).select('*').single();
    if (!error && data) return { data, error: null };
    if (!error) return { data: null, error: { message: 'Failed to save contact' } };

    const missing = missingColumnName(error);
    if (missing && missing in current && missing !== 'user_id' && missing !== 'first_name') {
      const next = { ...current };
      delete next[missing];
      current = next;
      continue;
    }

    if (isMissingColumnError(error)) {
      const extra = OPTIONAL_CONTACT_COLUMNS.find((column) => column in current);
      if (extra) {
        const next = { ...current };
        delete next[extra];
        current = next;
        continue;
      }
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Failed to save contact' } };
}

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const firstName = pickString(body.firstName);
  if (!firstName) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'First name is required' },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();
  const organizationId = typeof profile?.organization_id === 'string' ? profile.organization_id : null;

  const phone = pickString(body.phone);
  const payload: Record<string, unknown> = {
    user_id: user.id,
    first_name: firstName,
    last_name: pickString(body.lastName) || '—',
    email: pickString(body.email),
    phone,
    company: pickString(body.company) || null,
    status: pickString(body.status) || 'New Lead',
    tags: Array.isArray(body.tags) ? body.tags : [],
    source: pickString(body.source) || 'Manual Entry',
    last_activity: pickString(body.lastActivity) || 'Just now',
    address: pickString(body.address) || null,
    city: pickString(body.city) || null,
    state: pickString(body.state) || null,
    zip: pickString(body.zip) || null,
    notes: Array.isArray(body.notes) ? body.notes : [],
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    external_contact_id: `manual:${crypto.randomUUID()}`,
  };
  if (organizationId) payload.organization_id = organizationId;
  if (phone) payload.primary_phone = phone;

  const { data, error } = await insertContactRow(supabase, payload);
  if (error || !data) {
    console.error('[POST /api/contacts]', error);
    return NextResponse.json(
      { error: 'Validation failed', message: friendlyContactWriteError(error) },
      { status: 400 }
    );
  }

  return NextResponse.json({ contact: data });
}

function isIgnorableDeleteError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return true;
  const code = String(error.code ?? '');
  const msg = (error.message ?? '').toLowerCase();
  if (error.message === 'timeout') return true;
  if (isMissingColumnError(error)) return true;
  if (code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache')) return true;
  return false;
}

async function timedDelete(
  run: PromiseLike<{ error: { code?: string; message?: string } | null }>,
  ms = 4000,
): Promise<{ error: { code?: string; message?: string } | null }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(run),
      new Promise<{ error: { message: string } }>((resolve) => {
        timer = setTimeout(() => resolve({ error: { message: 'timeout' } }), ms);
      }),
    ]);
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : 'delete failed' } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function DELETE(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const contactId = typeof body.id === 'string' ? body.id.trim() : '';
  if (!contactId) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Contact id is required' },
      { status: 400 }
    );
  }

  const { data: contact, error: loadError } = await supabase
    .from('contacts')
    .select('id, organization_id, external_contact_id')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (loadError && !isMissingColumnError(loadError)) {
    console.error('[DELETE /api/contacts] load', loadError);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  if (!contact?.id) {
    const fallback = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!fallback.data?.id) {
      return NextResponse.json(
        { error: 'Not found', message: 'Contact not found' },
        { status: 404 }
      );
    }
  }

  const deals = await timedDelete(
    supabase.from('deals').delete().eq('user_id', user.id).eq('contact_id', contactId),
  );
  if (deals.error && !isIgnorableDeleteError(deals.error)) {
    console.warn('[DELETE /api/contacts] deals', deals.error.message);
  }

  const bookings = await timedDelete(
    supabase.from('bookings').delete().eq('user_id', user.id).eq('contact_id', contactId),
  );
  if (bookings.error && !isIgnorableDeleteError(bookings.error)) {
    console.warn('[DELETE /api/contacts] bookings', bookings.error.message);
  }

  const appointmentsById = await timedDelete(
    supabase.from('appointments').delete().eq('contact_id', contactId),
  );
  if (appointmentsById.error && !isIgnorableDeleteError(appointmentsById.error)) {
    console.warn('[DELETE /api/contacts] appointments', appointmentsById.error.message);
  }

  const organizationId = contact?.organization_id as string | null | undefined;
  const externalId = contact?.external_contact_id as string | null | undefined;
  if (organizationId && externalId) {
    const appointmentsByExternal = await timedDelete(
      supabase
        .from('appointments')
        .delete()
        .eq('organization_id', organizationId)
        .eq('contact_external_id', externalId),
    );
    if (appointmentsByExternal.error && !isIgnorableDeleteError(appointmentsByExternal.error)) {
      console.warn('[DELETE /api/contacts] appointments-external', appointmentsByExternal.error.message);
    }
  }

  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId)
    .eq('user_id', user.id);

  if (error) {
    console.error('[DELETE /api/contacts]', error);
    const msg = (error.message ?? '').toLowerCase();
    const blocked = error.code === '23503' || msg.includes('foreign key') || msg.includes('violates');
    return NextResponse.json(
      {
        error: blocked ? 'Conflict' : 'Internal error',
        message: blocked
          ? 'This contact still has related records, so it could not be deleted. Try again in a moment.'
          : GENERIC_ERROR_MESSAGE,
      },
      { status: blocked ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
