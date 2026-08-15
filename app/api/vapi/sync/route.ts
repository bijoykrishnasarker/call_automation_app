import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';
import { vapi } from '@/lib/vapi/client';
import type { AiReceptionistSettingsRow } from '@/lib/ai-receptionist/types';
import { AI_RECEPTIONIST_SELECT_COLUMNS } from '@/lib/ai-receptionist/types';
import { normalizeServicesInput } from '@/lib/ai-receptionist/validate-settings';
import { getAppBaseUrl } from '@/lib/vapi/app-base-url';
import { buildBookingWebhookTools, buildVapiWebhookServer } from '@/lib/vapi/booking-webhook-tools';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

const VOICE_MAP: Record<string, string> = {
  sarah: 'Emma',
  mike: 'Elliot',
  emma: 'Emma',
};

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

interface SyncBody {
  agentName?: string;
  voiceModel?: string;
  voiceSpeed?: number;
  businessName?: string;
  businessType?: string;
  businessAddress?: string;
  businessHours?: string;
  services?: string[];
  additionalInfo?: string;
  greetingMessage?: string;
  answerQuestions?: boolean;
  bookAppointments?: boolean;
  takeMessages?: boolean;
  transferEnabled?: boolean;
  transferNumber?: string;
  afterHoursOnly?: boolean;
  phoneNumber?: string;
}

function compileSystemPrompt(body: SyncBody): string {
  const sections: string[] = [];

  const agentName = (body.agentName ?? '').trim() || 'the receptionist';
  const businessName = (body.businessName ?? '').trim() || 'this business';
  const businessType = (body.businessType ?? '').trim();
  const businessAddress = (body.businessAddress ?? '').trim();
  const businessHours = (body.businessHours ?? '').trim();
  const services = Array.isArray(body.services) ? body.services.filter((s) => typeof s === 'string' && s.trim()) : [];
  const additionalInfo = (body.additionalInfo ?? '').trim();
  const answerQuestions = body.answerQuestions !== false;
  const bookAppointments = Boolean(body.bookAppointments);
  const takeMessages = body.takeMessages !== false;
  const transferEnabled = Boolean(body.transferEnabled);
  const transferNumber = (body.transferNumber ?? '').trim();
  const afterHoursOnly = Boolean(body.afterHoursOnly);

  sections.push(`# Role\nYou are ${agentName}, an AI phone receptionist for a small business. Speak in a warm, professional tone. Keep answers short and clear.`);

  sections.push(`# Business\n- Name: ${businessName}${businessType ? `\n- Type: ${businessType}` : ''}${businessAddress ? `\n- Address: ${businessAddress}` : ''}${businessHours ? `\n- Business hours: ${businessHours}` : ''}`);

  if (services.length > 0) {
    sections.push(`# Services offered\n${services.map((s) => `- ${s.trim()}`).join('\n')}`);
  }

  if (additionalInfo) {
    sections.push(`# Additional context\n${additionalInfo}`);
  }

  const capabilities: string[] = [];
  if (answerQuestions) capabilities.push('answer common customer questions');
  if (bookAppointments) capabilities.push('book appointments when the caller is ready');
  if (takeMessages) capabilities.push('take a clear message from the caller');
  if (capabilities.length > 0) {
    sections.push(`# Capabilities\nYou are allowed to: ${capabilities.join('; ')}. If unsure, offer to take a message instead of guessing.`);
  }

  sections.push(
    `# Contact info collection — REQUIRED\n` +
    `You MUST collect the following information from the caller during the conversation:\n` +
    `- Full name (first and last)\n` +
    `- Phone number\n` +
    `- Email address (CRITICAL: Never assume the email from one phrase. Ask the caller to spell the part before the at sign if needed, and ask the domain separately if needed.)\n` +
    `- Requested service (if applicable)\n` +
    `- Preferred appointment date/time (if applicable)\n` +
    `- Message/call reason\n\n` +
    `For capturing email specifically:\n` +
    `- Convert spoken words: "at" = "@", "dot" = ".", "gmail dot com" = "gmail.com"\n` +
    `- Repeat the email back clearly: "I heard your email as dudley at gmail dot com. Is that correct?"\n` +
    `- Only treat emailConfirmed as true after the caller clearly confirms.\n` +
    `- If the email is missing @, missing domain, has spaces, or sounds ambiguous, ask again.\n\n` +
    `Do not say the contact has been saved unless the backend/tool actually confirmed saving it.`
  );

  if (!bookAppointments) {
    sections.push(`# Message Taking\nIf the caller wants to book an appointment or service, take a message and collect their contact details instead.`);
  }

  if (bookAppointments) {
    sections.push(
      `# Appointment booking workflow\n` +
      `The business calendar is the source of truth. Never guess whether a time is free.\n` +
      `When the caller wants an appointment:\n` +
      `1) Collect name, phone, and email, plus the requested date and time.\n` +
      `2) Call \`check_availability\` with timezone "Asia/Dhaka" unless the caller said another timezone. Use requestedStartAt or localDate+localTime. durationMinutes defaults to 30.\n` +
      `3) If isAvailable is false, say clearly: that time is already booked, please choose another time. Read the suggestedSlots display times (example: 3:30 PM) and wait for the caller to pick one.\n` +
      `4) Never say a booking is confirmed until \`book_appointment\` returns booked=true.\n` +
      `5) After the caller confirms an open slot, call \`book_appointment\`. That writes the event to the calendar.\n` +
      `6) If book_appointment returns booked=false / slot_unavailable, tell the caller the time was just taken and offer the new suggestedSlots.`
    );
  }

  if (afterHoursOnly && businessHours) {
    sections.push(`# After-hours rule\nThis line is for calls outside business hours (${businessHours}). If the caller is within business hours, politely say this line is for after-hours only and use the transfer call tool immediately.`);
  }

  if (transferEnabled && transferNumber) {
    sections.push(`# Urgent / transfer\nIf the caller says the matter is urgent or asks for a real person, use the transfer call tool to reach the live number immediately.`);
  }

  sections.push(
    `# DATA CAPTURE TARGETS\n` +
    `- fullName\n` +
    `- phone\n` +
    `- email\n` +
    `- emailSpoken\n` +
    `- emailConfirmed\n` +
    `- requestedService\n` +
    `- preferredDate\n` +
    `- preferredTime\n` +
    `- message\n` +
    `- callReason\n\n` +
    `Always confirm key details (e.g. appointment time, caller full name, email address, phone number) by repeating them back before ending the call.`
  );

  return sections.join('\n\n');
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

  let body: SyncBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (body == null || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Request body must be a JSON object' },
      { status: 400 }
    );
  }

  const agentName = typeof body.agentName === 'string' ? body.agentName.trim() : '';
  const voiceModel = typeof body.voiceModel === 'string' ? body.voiceModel.trim() : '';
  const voiceSpeed = typeof body.voiceSpeed === 'number' ? body.voiceSpeed : Number(body.voiceSpeed);

  if (!agentName || !voiceModel) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'Agent name and voice model are required' },
      { status: 400 }
    );
  }

  const speed = Number.isNaN(Number(voiceSpeed)) || Number(voiceSpeed) < 0.5 || Number(voiceSpeed) > 2
    ? 1
    : Number(voiceSpeed);
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';

  const servicesResult = normalizeServicesInput(body.services);
  if (servicesResult.ok === false) {
    return NextResponse.json(
      { error: 'Validation failed', message: servicesResult.message },
      { status: 400 }
    );
  }
  const services = servicesResult.services;

  const additionalInfoStr = typeof body.additionalInfo === 'string' ? body.additionalInfo.trim() : '';
  if (additionalInfoStr.length > 10000) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'additional_business_info must be at most 10000 characters' },
      { status: 400 }
    );
  }
  const additional_business_info = additionalInfoStr || null;

  const greetingRaw = typeof body.greetingMessage === 'string' ? body.greetingMessage.trim() : '';
  if (greetingRaw.length > 2000) {
    return NextResponse.json(
      { error: 'Validation failed', message: 'greeting_message must be at most 2000 characters' },
      { status: 400 }
    );
  }
  const greeting_message = greetingRaw || null;
  const firstMessage = greetingRaw
    ? greetingRaw
    : `Hello, thank you for calling ${businessName || 'our business'}. How can I help you today?`;

  const liveTransferNumber = normalizeLiveTransferNumber(body.transferNumber);
  const voiceId = VOICE_MAP[voiceModel] ?? 'Emma';
  const systemPrompt = compileSystemPrompt({ ...body, services });
  const now = new Date().toISOString();

  const receptionistPayload = {
    agent_name: agentName,
    voice: voiceModel,
    speed,
    live_transfer_number: liveTransferNumber,
    answer_after_hours_only: Boolean(body.afterHoursOnly),
    business_name: businessName || null,
    business_type: typeof body.businessType === 'string' ? body.businessType.trim() || null : null,
    business_address: typeof body.businessAddress === 'string' ? body.businessAddress.trim() || null : null,
    business_hours: typeof body.businessHours === 'string' ? body.businessHours.trim() || null : null,
    can_answer_questions: body.answerQuestions !== false,
    can_take_messages: body.takeMessages !== false,
    can_book_appointments: Boolean(body.bookAppointments),
    transfer_urgent_calls: Boolean(body.transferEnabled),
    services,
    additional_business_info,
    greeting_message,
    updated_at: now,
  };

  try {
    const { data: existingAssistant } = await supabase
      .from('vapi_assistants')
      .select('id, vapi_assistant_id')
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .maybeSingle();

    const appBaseUrl = getAppBaseUrl();
    const tools = appBaseUrl
      ? buildBookingWebhookTools(appBaseUrl, {
          bookAppointments: Boolean(body.bookAppointments),
          takeMessages: body.takeMessages !== false,
        })
      : [];
    const webhookServer = appBaseUrl ? buildVapiWebhookServer(appBaseUrl) : null;
    const assistantMetadata = {
      organization_id: organizationId,
      webhook_auth_mode: process.env.VAPI_WEBHOOK_AUTH_MODE ?? 'optional',
      synced_at: now,
      webhook_url: webhookServer?.url ?? null,
      calendar_tools_connected: tools.length > 0 && Boolean(body.bookAppointments),
    };

    const structuredDataSchema = {
      type: "object",
      properties: {
        contact: {
          type: "object",
          properties: {
            fullName: { type: "string", description: "The caller's full name." },
            phone: { type: "string", description: "The caller's phone number. Prefer E.164 format if clear." },
            email: { type: "string", description: "The caller's email converted from spoken form. Example: 'dudley at gmail dot com' becomes 'dudley@gmail.com'. Return null if uncertain." },
            emailSpoken: { type: "string", description: "The exact spoken version of the email from the transcript." },
            emailConfirmed: { type: "boolean", description: "True only if the assistant repeated the email and the caller confirmed it." }
          },
          required: ["fullName", "phone", "emailConfirmed"]
        },
        lead: {
          type: "object",
          properties: {
            callReason: { type: "string", description: "Why the caller contacted the business." },
            requestedService: { type: "string", description: "The requested service, if any." },
            message: { type: "string", description: "A short message or notes from the caller." }
          }
        },
        appointment: {
          type: "object",
          properties: {
            preferredDate: { type: "string", description: "The preferred appointment date if provided." },
            preferredTime: { type: "string", description: "The preferred appointment time if provided." },
            appointmentRequested: { type: "boolean", description: "True if the caller requested an appointment." }
          }
        },
        quality: {
          type: "object",
          properties: {
            contactComplete: { type: "boolean", description: "True only if name, phone, and a confirmed valid email were collected." },
            needsHumanReview: { type: "boolean", description: "True if contact info is missing, email is ambiguous, or caller needs follow-up." },
            missingFields: { type: "array", items: { type: "string" }, description: "List of missing or uncertain fields." }
          }
        }
      },
      required: ["contact", "quality"]
    };

    const assistantPayload = {
      name: agentName,
      firstMessage,
      transcriber: {
        model: 'nova-3' as const,
        provider: 'deepgram' as const,
        language: 'en',
      },
      model: {
        provider: 'openai' as const,
        model: 'gpt-4o-mini' as const,
        messages: [{ role: 'system' as const, content: systemPrompt }],
        tools,
      },
      metadata: assistantMetadata,
      voice: {
        provider: 'vapi' as const,
        voiceId,
      },
      analysisPlan: {
        structuredDataPlan: {
          schema: structuredDataSchema,
        },
        structuredDataPrompt: "You are an expert CRM data extractor. Extract caller contact and lead information from the full call transcript. Convert spoken emails like 'john at gmail dot com' into 'john@gmail.com'. Only set emailConfirmed=true if the assistant repeated the email and the caller confirmed it. If the email is ambiguous, missing @, missing domain, or not confirmed, set email to null or emailConfirmed=false and add the issue to missingFields. Return clean JSON only.",
      },
      ...(webhookServer ? { server: webhookServer } : {}),
    };

    let vapiAssistantId: string;

    if (existingAssistant?.vapi_assistant_id) {
      try {
        const updated = await vapi.assistants.update({
          id: existingAssistant.vapi_assistant_id,
          ...assistantPayload,
        } as Parameters<typeof vapi.assistants.update>[0]);
        vapiAssistantId = updated.id;
      } catch (updateErr) {
        const statusCode = (updateErr as { statusCode?: number })?.statusCode;
        if (statusCode === 404) {
          console.warn('[POST /api/vapi/sync] Assistant not found on Vapi, creating a new one');
          const created = await vapi.assistants.create(assistantPayload as Parameters<typeof vapi.assistants.create>[0]);
          vapiAssistantId = created.id;
        } else {
          throw updateErr;
        }
      }
    } else {
      const created = await vapi.assistants.create(assistantPayload as Parameters<typeof vapi.assistants.create>[0]);
      vapiAssistantId = created.id;
    }

    const { data: existingReceptionist } = await supabase
      .from('ai_receptionists')
      .select('id')
      .eq('organization_id', organizationId)
      .maybeSingle();

    let settingsRow: AiReceptionistSettingsRow;

    if (existingReceptionist?.id) {
      const { data, error } = await supabase
        .from('ai_receptionists')
        .update(receptionistPayload)
        .eq('organization_id', organizationId)
        .select(AI_RECEPTIONIST_SELECT_COLUMNS.join(', '))
        .single();

      if (error) {
        console.error('[POST /api/vapi/sync] update ai_receptionists', error);
        return NextResponse.json(
          { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
          { status: 500 }
        );
      }
      settingsRow = data as unknown as AiReceptionistSettingsRow;
    } else {
      const { data, error } = await supabase
        .from('ai_receptionists')
        .insert({
          organization_id: organizationId,
          ...receptionistPayload,
        })
        .select(AI_RECEPTIONIST_SELECT_COLUMNS.join(', '))
        .single();

      if (error) {
        console.error('[POST /api/vapi/sync] insert ai_receptionists', error);
        return NextResponse.json(
          { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
          { status: 500 }
        );
      }
      settingsRow = data as unknown as AiReceptionistSettingsRow;
    }

    if (existingAssistant?.id) {
      await supabase
        .from('vapi_assistants')
        .update({
          vapi_assistant_id: vapiAssistantId,
          name: agentName,
          assistant_metadata: assistantMetadata,
          webhook_auth_mode: process.env.VAPI_WEBHOOK_AUTH_MODE ?? 'optional',
          last_synced_at: now,
        })
        .eq('id', existingAssistant.id);
    } else {
      await supabase.from('vapi_assistants').insert({
        organization_id: organizationId,
        vapi_assistant_id: vapiAssistantId,
        name: agentName,
        assistant_metadata: assistantMetadata,
        webhook_auth_mode: process.env.VAPI_WEBHOOK_AUTH_MODE ?? 'optional',
        is_primary: true,
        last_synced_at: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: tools.length > 0 && body.bookAppointments
        ? 'Configuration saved and synced with Vapi. Calendar booking tools are connected.'
        : body.bookAppointments
          ? 'Settings saved, but calendar tools were NOT attached. Set APP_BASE_URL on Vercel and Sync again.'
          : 'Configuration saved and synced with Vapi.',
      settings: settingsRow,
      webhookUrl: webhookServer?.url ?? null,
      calendarToolsConnected: tools.length > 0 && Boolean(body.bookAppointments),
    });
  } catch (e) {
    console.error('[POST /api/vapi/sync]', e);

    const status =
      (e as { statusCode?: number })?.statusCode ??
      (e as { status?: number })?.status;

    if (status === 401) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Vapi authentication failed. Check VAPI_PRIVATE_KEY.' },
        { status: 401 }
      );
    }

    if (status === 400) {
      const body = (e as { body?: { message?: string | string[] } })?.body;
      const msg = Array.isArray(body?.message) ? body.message[0] : body?.message;
      return NextResponse.json(
        { error: 'Bad Request', message: typeof msg === 'string' ? msg : 'Invalid request to Vapi' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}
