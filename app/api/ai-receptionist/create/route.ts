import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';
import type { AiReceptionistSettingsRow } from '@/lib/ai-receptionist/types';
import { AI_RECEPTIONIST_SELECT_COLUMNS } from '@/lib/ai-receptionist/types';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function normalizeLiveTransferNumber(raw: unknown): string | null {
  if (raw == null) return null;
  const value = typeof raw === 'string' ? raw : String(raw);
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const agentName = typeof body.agentName === 'string' ? body.agentName.trim() : '';
  const voiceModel = typeof body.voiceModel === 'string' ? body.voiceModel.trim() : '';
  const voiceSpeed = typeof body.voiceSpeed === 'number' ? body.voiceSpeed : Number.NaN;

  if (!agentName || !voiceModel || Number.isNaN(voiceSpeed)) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        message: 'agentName, voiceModel, and voiceSpeed are required',
      },
      { status: 400 }
    );
  }

  const liveTransferNumber = normalizeLiveTransferNumber(body.transferNumber);

  const now = new Date().toISOString();

  const updatePayload = {
    agent_name: agentName,
    voice: voiceModel,
    speed: voiceSpeed,
    live_transfer_number: liveTransferNumber,
    answer_after_hours_only: Boolean(body.afterHoursOnly),
    business_name: typeof body.businessName === 'string' ? body.businessName.trim() : null,
    business_type: typeof body.businessType === 'string' ? body.businessType.trim() : null,
    business_address:
      typeof body.businessAddress === 'string' ? body.businessAddress.trim() : null,
    business_hours: typeof body.businessHours === 'string' ? body.businessHours.trim() : null,
    can_answer_questions:
      typeof body.answerQuestions === 'boolean' ? body.answerQuestions : true,
    can_take_messages:
      typeof body.takeMessages === 'boolean' ? body.takeMessages : true,
    can_book_appointments:
      typeof body.bookAppointments === 'boolean' ? body.bookAppointments : false,
    transfer_urgent_calls:
      typeof body.transferEnabled === 'boolean' ? body.transferEnabled : false,
    services: [] as string[],
    additional_business_info: null as string | null,
    greeting_message: null as string | null,
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from('ai_receptionists')
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  let row: AiReceptionistSettingsRow | null = null;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('ai_receptionists')
      .update(updatePayload)
      .eq('organization_id', organizationId)
      .select(AI_RECEPTIONIST_SELECT_COLUMNS.join(', '))
      .single();

    if (error) {
      console.error('[POST /api/ai-receptionist/create] update error', error);
      return NextResponse.json(
        { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    row = data as unknown as AiReceptionistSettingsRow;
  } else {
    const { data, error } = await supabase
      .from('ai_receptionists')
      .insert({
        organization_id: organizationId,
        ...updatePayload,
      })
      .select(AI_RECEPTIONIST_SELECT_COLUMNS.join(', '))
      .single();

    if (error) {
      console.error('[POST /api/ai-receptionist/create] insert error', error);
      return NextResponse.json(
        { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    row = data as unknown as AiReceptionistSettingsRow;
  }

  return NextResponse.json({
    settings: row,
  });
}

