import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function pickString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const BOOKING_TYPES = new Set(['Service', 'Consultation', 'Checkup']);
const BOOKING_STATUSES = new Set(['Pending', 'Confirmed', 'Completed']);

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

  const title = pickString(body.title);
  const contactId = pickString(body.contactId);
  const startAt = pickString(body.startAt);
  const endAt = pickString(body.endAt);
  const type = pickString(body.type) || 'Service';
  const status = pickString(body.status) || 'Pending';

  if (!title) {
    return NextResponse.json({ error: 'Validation failed', message: 'Title is required' }, { status: 400 });
  }
  if (!contactId) {
    return NextResponse.json({ error: 'Validation failed', message: 'Select a contact' }, { status: 400 });
  }
  if (!startAt || !endAt || Number.isNaN(Date.parse(startAt)) || Number.isNaN(Date.parse(endAt))) {
    return NextResponse.json({ error: 'Validation failed', message: 'Enter a valid date and time' }, { status: 400 });
  }
  if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return NextResponse.json({ error: 'Validation failed', message: 'End time must be after start time' }, { status: 400 });
  }
  if (!BOOKING_TYPES.has(type)) {
    return NextResponse.json({ error: 'Validation failed', message: 'Invalid appointment type' }, { status: 400 });
  }
  if (!BOOKING_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Validation failed', message: 'Invalid status' }, { status: 400 });
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!contact?.id) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Select a valid contact from your CRM' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: user.id,
      contact_id: contactId,
      title,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      type,
      status,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[POST /api/bookings]', error);
    const msg = (error.message ?? '').toLowerCase();
    if (error.code === '23503' || msg.includes('foreign key')) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'Select a valid contact from your CRM' },
        { status: 400 }
      );
    }
    if (error.code === '23514' || msg.includes('check constraint')) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'Invalid appointment type or status' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  return NextResponse.json({ booking: data });
}
