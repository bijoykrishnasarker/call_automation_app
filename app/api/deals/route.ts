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
  const stageId = pickString(body.stageId);
  const source = pickString(body.source) || 'Direct Lead';
  const valueRaw = body.value;
  const value =
    typeof valueRaw === 'number'
      ? valueRaw
      : typeof valueRaw === 'string'
        ? Number.parseFloat(valueRaw)
        : Number.NaN;

  if (!title) {
    return NextResponse.json({ error: 'Validation failed', message: 'Deal title is required' }, { status: 400 });
  }
  if (!contactId) {
    return NextResponse.json({ error: 'Validation failed', message: 'Select a contact' }, { status: 400 });
  }
  if (!stageId) {
    return NextResponse.json({ error: 'Validation failed', message: 'Select a pipeline stage' }, { status: 400 });
  }
  if (Number.isNaN(value) || value < 0) {
    return NextResponse.json({ error: 'Validation failed', message: 'Enter a valid deal value' }, { status: 400 });
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

  const { data: stageRow } = await supabase
    .from('pipeline_stages')
    .select('id, pipeline_id')
    .eq('id', stageId)
    .maybeSingle();

  if (!stageRow?.id) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Select a valid pipeline stage' },
      { status: 400 }
    );
  }

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('id', stageRow.pipeline_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!pipeline?.id) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Select a valid pipeline stage' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('deals')
    .insert({
      user_id: user.id,
      contact_id: contactId,
      stage_id: stageId,
      title,
      value,
      source,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[POST /api/deals]', error);
    const msg = (error.message ?? '').toLowerCase();
    if (error.code === '23503' || msg.includes('foreign key')) {
      return NextResponse.json(
        { error: 'Validation failed', message: 'Select a valid contact and pipeline stage' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  return NextResponse.json({ deal: data });
}
