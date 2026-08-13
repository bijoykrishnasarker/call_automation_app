import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';
import { validateSettings } from '@/lib/ai-receptionist/validate-settings';
import type { AiReceptionistSettingsRow, AiReceptionistSettingsResponse } from '@/lib/ai-receptionist/types';
import {
  AI_RECEPTIONIST_SELECT_COLUMNS,
  AI_RECEPTIONIST_SELECT_COLUMNS_LEGACY,
} from '@/lib/ai-receptionist/types';
import { isMissingColumnError } from '@/lib/ai-receptionist/supabase-errors';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';
const SUPABASE_RETRY_ATTEMPTS = 3;
const SUPABASE_RETRY_DELAY_MS = 500;

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const cause = err.cause as Error | undefined;
    if (msg.includes('fetch failed') || msg.includes('econnreset') || msg.includes('socket')) return true;
    if (cause?.message?.toLowerCase().includes('econnreset')) return true;
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = SUPABASE_RETRY_ATTEMPTS): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1 && isRetryableNetworkError(e)) {
        await new Promise((r) => setTimeout(r, SUPABASE_RETRY_DELAY_MS));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
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
  let userResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    userResult = await withRetry(() => supabase.auth.getUser(accessToken));
  } catch (e) {
    console.error('[GET /api/ai-receptionist/settings]', e);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
  const { data: { user }, error: userError } = userResult;
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

  // Fetch existing row only; no row returns { settings: null } (no auto-create).
  let data: AiReceptionistSettingsRow | null = null;
  {
    const full = await supabase
      .from('ai_receptionists')
      .select(AI_RECEPTIONIST_SELECT_COLUMNS.join(', '))
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (full.error) {
      if (isMissingColumnError(full.error)) {
        console.warn(
          '[GET /api/ai-receptionist/settings] ai_receptionists missing knowledge columns; retry legacy select. Run docs/AI_RECEPTIONIST_SUPABASE_SCHEMA.md migration.'
        );
        const legacy = await supabase
          .from('ai_receptionists')
          .select(AI_RECEPTIONIST_SELECT_COLUMNS_LEGACY.join(', '))
          .eq('organization_id', organizationId)
          .maybeSingle();
        if (legacy.error) {
          console.error('[GET /api/ai-receptionist/settings]', legacy.error);
          return NextResponse.json(
            { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
            { status: 500 }
          );
        }
        const row = legacy.data as unknown as Omit<AiReceptionistSettingsRow, 'services' | 'additional_business_info' | 'greeting_message'> | null;
        data = row
          ? {
              ...row,
              services: [],
              additional_business_info: null,
              greeting_message: null,
            }
          : null;
      } else {
        console.error('[GET /api/ai-receptionist/settings]', full.error);
        return NextResponse.json(
          { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
          { status: 500 }
        );
      }
    } else {
      data = full.data as unknown as AiReceptionistSettingsRow | null;
    }
  }

  const { data: phoneRow, error: phoneError } = await supabase
    .from('vapi_phone_numbers')
    .select('e164_number')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();
  if (phoneError) {
    console.warn('[GET /api/ai-receptionist/settings] vapi_phone_numbers', phoneError.message);
  }

  const { data: assistantRow } = await supabase
    .from('vapi_assistants')
    .select('vapi_assistant_id')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  const settings = normalizeSettingsRow(data as unknown as AiReceptionistSettingsRow | null);
  const body: AiReceptionistSettingsResponse = {
    settings,
    connected_phone_number: phoneRow?.e164_number ?? null,
    vapi_assistant_id: assistantRow?.vapi_assistant_id ?? null,
  };
  return NextResponse.json(body);
}

/** Coerce jsonb `services` to string[] for API clients. */
function normalizeSettingsRow(row: AiReceptionistSettingsRow | null): AiReceptionistSettingsRow | null {
  if (!row) return null;
  const raw = row as unknown as { services?: unknown };
  let services: string[] = [];
  if (Array.isArray(raw.services)) {
    services = raw.services
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  }
  return { ...row, services };
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
  let userResult: Awaited<ReturnType<typeof supabase.auth.getUser>>;
  try {
    userResult = await withRetry(() => supabase.auth.getUser(accessToken));
  } catch (e) {
    console.error('[POST /api/ai-receptionist/settings]', e);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
  const { data: { user }, error: userError } = userResult;
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const validation = validateSettings(body);
  if (!validation.valid) {
    const message = 'message' in validation ? validation.message : 'Validation failed';
    return NextResponse.json(
      { error: 'Validation failed', message },
      { status: 400 }
    );
  }

  const { normalized } = validation;
  // organization_id is never taken from the body; only from getOrganizationIdForUser above.
  const now = new Date().toISOString();
  const payloadBase = {
    is_enabled: normalized.is_enabled,
    agent_name: normalized.agent_name,
    voice: normalized.voice,
    speed: normalized.speed,
    live_transfer_number: normalized.live_transfer_number,
    answer_after_hours_only: normalized.answer_after_hours_only,
    business_name: normalized.business_name,
    business_type: normalized.business_type,
    business_address: normalized.business_address,
    business_hours: normalized.business_hours,
    can_answer_questions: normalized.can_answer_questions,
    can_take_messages: normalized.can_take_messages,
    can_book_appointments: normalized.can_book_appointments,
    transfer_urgent_calls: normalized.transfer_urgent_calls,
    updated_at: now,
  };
  const payloadWithKnowledge = {
    ...payloadBase,
    services: normalized.services,
    additional_business_info: normalized.additional_business_info,
    greeting_message: normalized.greeting_message,
  };

  // Select-then-insert-or-update so we don't require a UNIQUE constraint on organization_id
  const { data: existing } = await supabase
    .from('ai_receptionists')
    .select('id')
    .eq('organization_id', organizationId)
    .maybeSingle();

  let data: AiReceptionistSettingsRow | null = null;

  async function upsertRow(
    payload: typeof payloadWithKnowledge | typeof payloadBase,
    selectCols: string
  ): Promise<{ data: AiReceptionistSettingsRow | null; error: { message: string; code?: string } | null }> {
    if (existing?.id) {
      const { data: updated, error } = await supabase
        .from('ai_receptionists')
        .update(payload)
        .eq('organization_id', organizationId)
        .select(selectCols)
        .single();
      return { data: updated as unknown as AiReceptionistSettingsRow | null, error };
    }
    const { data: inserted, error } = await supabase
      .from('ai_receptionists')
      .insert({
        organization_id: organizationId,
        ...payload,
      })
      .select(selectCols)
      .single();
    return { data: inserted as unknown as AiReceptionistSettingsRow | null, error };
  }

  const selectFull = AI_RECEPTIONIST_SELECT_COLUMNS.join(', ');
  const selectLegacy = AI_RECEPTIONIST_SELECT_COLUMNS_LEGACY.join(', ');

  let result = await upsertRow(payloadWithKnowledge, selectFull);
  if (result.error && isMissingColumnError(result.error)) {
    console.warn(
      '[POST /api/ai-receptionist/settings] ai_receptionists missing knowledge columns; retry without them. Run docs/AI_RECEPTIONIST_SUPABASE_SCHEMA.md migration.'
    );
    result = await upsertRow(payloadBase, selectLegacy);
    if (result.data) {
      result.data = {
        ...result.data,
        services: [],
        additional_business_info: null,
        greeting_message: null,
      } as AiReceptionistSettingsRow;
    }
  }

  if (result.error) {
    console.error('[POST /api/ai-receptionist/settings]', result.error);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
  data = result.data;

  return NextResponse.json({ settings: normalizeSettingsRow(data) });
}
