import { NextRequest, NextResponse } from 'next/server';
import { VapiError } from '@vapi-ai/server-sdk';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';
import { vapi } from '@/lib/vapi/client';

const VAPI_BASE = 'https://api.vapi.ai';
const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/** Optional body: frontend may send assistantId and/or areaCode; otherwise we load assistantId from DB */
interface ProvisionBody {
  assistantId?: string;
  areaCode?: string;
}

// Area codes Vapi currently supports (primary + fallbacks)
const VAPI_AREA_CODE_FALLBACKS = ['442', '943', '843', '571', '202', '737'];

/** Normalize area code: digits only, min 3 chars; default "442" (Vapi-available) */
function normalizeAreaCode(raw: unknown): string {
  if (raw != null && typeof raw === 'string') {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 3) return digits.slice(0, 3);
  }
  return VAPI_AREA_CODE_FALLBACKS[0]; // 442 — confirmed available
}

/** Response shape from Vapi POST /phone-number/buy (legacy fallback) */
interface VapiBuyResponse {
  id?: string;
  number?: string;
  [key: string]: unknown;
}

async function getAssistantId(
  supabase: Awaited<ReturnType<typeof createSupabaseClientForUser>>,
  organizationId: string,
  body: ProvisionBody | null
): Promise<string | null> {
  const fromBody = body?.assistantId;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();

  const { data: assistant } = await supabase
    .from('vapi_assistants')
    .select('vapi_assistant_id')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  return assistant?.vapi_assistant_id ?? null;
}

async function verifyAssistantInVapi(assistantId: string): Promise<{ ok: true } | { ok: false; status: number }> {
  try {
    await vapi.assistants.get({ id: assistantId });
    return { ok: true };
  } catch (e) {
    const code = e instanceof VapiError ? e.statusCode : undefined;
    console.error('[provision] assistants.get failed', e);
    return { ok: false, status: code ?? 500 };
  }
}

/** Preferred: create Vapi number with assistant — tries multiple area codes automatically */
async function createVapiNumberWithAssistant(
  areaCode: string,
  assistantId: string
): Promise<{ id: string; number: string }> {
  // Build ordered list: user-requested first, then our known-available fallbacks
  const codesToTry = [areaCode, ...VAPI_AREA_CODE_FALLBACKS.filter(c => c !== areaCode)];

  let lastError: Error = new Error('No area codes available');
  for (const code of codesToTry) {
    try {
      const created = await vapi.phoneNumbers.create({
        provider: 'vapi',
        numberDesiredAreaCode: code,
        assistantId,
      });
      const row = created as { id?: string; number?: string };
      if (typeof row.id !== 'string' || !row.id) throw new Error('Vapi create phone response missing id');
      if (typeof row.number !== 'string' || !row.number) throw new Error('Vapi create phone response missing number');
      console.log(`[provision] Phone number created with area code ${code}: ${row.number}`);
      return { id: row.id, number: row.number };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('area code') || msg.toLowerCase().includes('not available')) {
        console.warn(`[provision] Area code ${code} not available, trying next`);
        lastError = e instanceof Error ? e : new Error(msg);
        continue;
      }
      throw e; // Non-area-code error — stop retrying
    }
  }
  throw lastError;
}

/** Fallback: create phone number via new REST API (without SDK) using multiple area codes */
async function buyPhoneNumberLegacy(apiKey: string, areaCode: string): Promise<{ id: string; number: string }> {
  const codesToTry = [areaCode, ...VAPI_AREA_CODE_FALLBACKS.filter(c => c !== areaCode)];

  for (const code of codesToTry) {
    const res = await fetch(`${VAPI_BASE}/phone-number`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ provider: 'vapi', numberDesiredAreaCode: code }),
    });

    const data = (await res.json().catch(() => ({}))) as VapiBuyResponse & { message?: string; error?: string };

    if (!res.ok) {
      const msg = typeof data?.message === 'string' ? data.message : data?.error ?? `Vapi buy failed (${res.status})`;
      if (msg.toLowerCase().includes('area code') || msg.toLowerCase().includes('not available')) {
        console.warn(`[provision-legacy] Area code ${code} not available, trying next`);
        continue;
      }
      throw new Error(msg);
    }

    const id = data?.id;
    const number = data?.number;
    if (typeof id !== 'string' || !id) throw new Error('Vapi phone response missing id');
    if (typeof number !== 'string' || !number) throw new Error('Vapi phone response missing number');
    console.log(`[provision-legacy] Phone number created with area code ${code}: ${number}`);
    return { id, number };
  }

  throw new Error('No available area codes. Please try again later or contact support.');
}

async function patchPhoneAssistant(phoneNumberId: string, assistantId: string): Promise<void> {
  await vapi.phoneNumbers.update({
    id: phoneNumberId,
    body: { assistantId },
  });
}

/**
 * Auto-creates a minimal Vapi assistant from saved AI receptionist settings
 * so that Provision Phone Number works in one click without requiring a prior Sync.
 */
async function autoCreateAssistantFromSettings(
  supabase: Awaited<ReturnType<typeof createSupabaseClientForUser>>,
  organizationId: string
): Promise<string | null> {
  try {
    // Load saved ai_receptionists settings for this org
    const { data: settings } = await supabase
      .from('ai_receptionists')
      .select('agent_name, voice, speed, business_name, business_hours, greeting_message')
      .eq('organization_id', organizationId)
      .maybeSingle();

    const agentName = settings?.agent_name || 'Sarah';
    const businessName = settings?.business_name || 'our business';
    const businessHours = settings?.business_hours || '';
    const greetingMessage = settings?.greeting_message ||
      `Hello, thank you for calling ${businessName}. How can I assist you today?`;

    const voiceMap: Record<string, string> = { sarah: 'Emma', mike: 'Elliot', emma: 'Emma' };
    const voiceId = voiceMap[settings?.voice ?? 'sarah'] ?? 'Emma';

    const systemPrompt = [
      `# Role\nYou are ${agentName}, an AI phone receptionist for ${businessName}. Speak in a warm, professional tone. Keep answers short and clear.`,
      `# Business\n- Name: ${businessName}${businessHours ? `\n- Business hours: ${businessHours}` : ''}`,
      `# Capabilities\nYou are allowed to: answer common customer questions; book appointments when the caller is ready; take a clear message (name, phone, reason for calling). If unsure, offer to take a message.`,
      `# Contact info collection — REQUIRED\nCollect the caller's full name, phone number, and email before ending the call. Confirm key details by repeating them back.`,
    ].join('\n\n');

    const now = new Date().toISOString();

    const created = await vapi.assistants.create({
      name: agentName,
      firstMessage: greetingMessage,
      model: {
        provider: 'openai' as const,
        model: 'gpt-4o-mini' as const,
        messages: [{ role: 'system' as const, content: systemPrompt }],
      },
      voice: {
        provider: 'vapi' as const,
        voiceId: voiceId as 'Emma' | 'Elliot',
      },
      metadata: {
        organization_id: organizationId,
        auto_created: true,
        synced_at: now,
      },
    } as Parameters<typeof vapi.assistants.create>[0]);

    const vapiAssistantId = created.id;

    // Save to vapi_assistants table
    const { data: existing } = await supabase
      .from('vapi_assistants')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .maybeSingle();

    const assistantRow = {
      organization_id: organizationId,
      vapi_assistant_id: vapiAssistantId,
      name: agentName,
      assistant_metadata: { organization_id: organizationId, auto_created: true, synced_at: now },
      webhook_auth_mode: 'optional',
      is_primary: true,
      last_synced_at: now,
    };

    if (existing?.id) {
      await supabase.from('vapi_assistants').update(assistantRow).eq('id', existing.id);
    } else {
      await supabase.from('vapi_assistants').insert(assistantRow);
    }

    console.log('[provision] Auto-created Vapi assistant:', vapiAssistantId);
    return vapiAssistantId;
  } catch (e) {
    console.error('[provision] autoCreateAssistantFromSettings failed:', e);
    return null;
  }
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

  const organizationId = await getOrganizationIdForUser(supabase, user.id);
  if (organizationId === null) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'No organization access' },
      { status: 403 }
    );
  }

  let body: ProvisionBody | null = null;
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as ProvisionBody;
  } catch {
    // optional body; ignore parse errors
  }

  const apiKey = process.env.VAPI_PRIVATE_KEY;
  if (!apiKey) {
    console.error('[POST /api/vapi/phone/provision] VAPI_PRIVATE_KEY is not set');
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  // Try to get existing assistant ID; if none, auto-create from saved settings
  let assistantId = await getAssistantId(supabase, organizationId, body);
  let autoCreated = false;

  if (!assistantId) {
    console.log('[provision] No assistant found — attempting auto-create from settings');
    assistantId = await autoCreateAssistantFromSettings(supabase, organizationId);
    autoCreated = true;

    if (!assistantId) {
      return NextResponse.json(
        {
          error: 'Setup required',
          message:
            'Could not create AI assistant. Please go to AI Center, fill in your Business Name and Agent Name, then click Save before provisioning a phone number.',
        },
        { status: 400 }
      );
    }
  }

  // If auto-created, skip the live Vapi verification (we just created it)
  if (!autoCreated) {
    const verified = await verifyAssistantInVapi(assistantId);
    if (verified.ok === false) {
      if (verified.status === 404) {
        // Assistant deleted from Vapi dashboard — auto-recreate
        console.warn('[provision] Assistant not found in Vapi — recreating');
        const newId = await autoCreateAssistantFromSettings(supabase, organizationId);
        if (!newId) {
          return NextResponse.json(
            {
              error: 'Setup required',
              message: 'Your assistant was not found in Vapi. Please click Save in AI Center to recreate it, then try again.',
            },
            { status: 400 }
          );
        }
        assistantId = newId;
      } else {
        return NextResponse.json(
          { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
          { status: 500 }
        );
      }
    }
  }

  const { data: existingNumber } = await supabase
    .from('vapi_phone_numbers')
    .select('id, e164_number')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  if (existingNumber?.e164_number) {
    return NextResponse.json(
      {
        error: 'Already provisioned',
        message: `Your business already has a phone number: ${existingNumber.e164_number}. Contact support if you need to change it.`,
        phoneNumber: existingNumber.e164_number,
      },
      { status: 409 }
    );
  }

  let phoneId: string;
  let phoneNumber: string;
  let linkFailed: string | null = null;
  let linkNote: string | null = null;

  const areaCode = normalizeAreaCode(body?.areaCode);

  try {
    try {
      const created = await createVapiNumberWithAssistant(areaCode, assistantId);
      phoneId = created.id;
      phoneNumber = created.number;
      linkNote = 'Number created with assistant attached.';
    } catch (createErr) {
      console.warn('[POST /api/vapi/phone/provision] phoneNumbers.create failed, falling back to buy + update', createErr);
      const buyResult = await buyPhoneNumberLegacy(apiKey, areaCode);
      phoneId = buyResult.id;
      phoneNumber = buyResult.number;
      try {
        await patchPhoneAssistant(phoneId, assistantId);
        linkNote = 'Number purchased and linked via update.';
      } catch (linkErr) {
        linkFailed = linkErr instanceof Error ? linkErr.message : 'Failed to link assistant to phone number';
        console.error('[POST /api/vapi/phone/provision] link after buy failed', linkErr);
      }
    }
  } catch (e) {
    console.error('[POST /api/vapi/phone/provision] vapi error', e);
    const rawMessage = e instanceof Error ? e.message : GENERIC_ERROR_MESSAGE;

    const isBillingError =
      rawMessage.toLowerCase().includes('payment') ||
      rawMessage.toLowerCase().includes('billing') ||
      rawMessage.toLowerCase().includes('subscription') ||
      rawMessage.toLowerCase().includes('credit');

    const userMessage = isBillingError
      ? 'Phone number provisioning is temporarily unavailable. Our team has been notified. Please try again later or contact support.'
      : rawMessage;

    if (isBillingError) {
      console.error(
        '🚨 [BILLING] Vapi account needs a payment method or credits. ' +
          'Visit https://dashboard.vapi.ai/org/billing to resolve. Raw error:',
        rawMessage
      );
    }

    return NextResponse.json(
      { error: 'Provisioning failed', message: userMessage },
      { status: isBillingError ? 503 : 400 }
    );
  }

  const { data: existing } = await supabase
    .from('vapi_phone_numbers')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  const payload = {
    organization_id: organizationId,
    vapi_phone_number_id: phoneId,
    e164_number: phoneNumber,
    is_primary: true,
  };

  let row: { id: string; vapi_phone_number_id: string; e164_number: string; is_primary: boolean; created_at: string };
  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from('vapi_phone_numbers')
      .update({
        vapi_phone_number_id: phoneId,
        e164_number: phoneNumber,
      })
      .eq('id', existing.id)
      .select('id, vapi_phone_number_id, e164_number, is_primary, created_at')
      .single();
    if (updateError) {
      console.error('[POST /api/vapi/phone/provision] update error', updateError);
      return NextResponse.json(
        { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }
    row = updated;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('vapi_phone_numbers')
      .insert(payload)
      .select('id, vapi_phone_number_id, e164_number, is_primary, created_at')
      .single();
    if (insertError) {
      console.error('[POST /api/vapi/phone/provision] insert error', insertError);
      return NextResponse.json(
        { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }
    row = inserted;
  }

  return NextResponse.json({
    phoneNumber: row.e164_number,
    details: row,
    ...(autoCreated ? { note: 'AI assistant was automatically set up for you.' } : {}),
    ...(linkNote && !autoCreated ? { note: linkNote } : {}),
    ...(linkFailed
      ? {
          warning:
            'Number purchased and saved, but linking to your assistant failed. Try Save / Sync with Vapi, then provision again.',
          linkError: linkFailed,
        }
      : {}),
  });
}
