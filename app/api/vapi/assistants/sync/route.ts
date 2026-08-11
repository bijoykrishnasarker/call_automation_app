import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';
import { vapi } from '@/lib/vapi/client';
import { AI_RECEPTIONIST_SELECT_COLUMNS, type AiReceptionistSettingsRow } from '@/lib/ai-receptionist/types';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

// Map our internal voice ids (stored in ai_receptionists.voice) to
// the actual Vapi voiceId values.
const VOICE_MAP: Record<string, string> = {
  sarah: 'Emma', // warm & professional
  mike: 'Elliot', // direct & clear male
  emma: 'Emma',
};

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

// Helper to build a system prompt from receptionist settings.
function buildSystemPrompt(settings: {
  agent_name: string;
  business_name: string | null;
  business_type: string | null;
  business_address: string | null;
  business_hours: string | null;
  can_answer_questions: boolean;
  can_take_messages: boolean;
  can_book_appointments: boolean;
  transfer_urgent_calls: boolean;
  live_transfer_number: string | null;
  answer_after_hours_only: boolean;
}) {
  const parts: string[] = [];

  parts.push(
    `You are ${settings.agent_name}, an AI phone receptionist for this small business. ` +
      `Speak in a warm, professional tone and keep answers short and clear.`
  );

  const businessName = settings.business_name || 'this business';
  const businessType = settings.business_type || '';
  const address = settings.business_address || '';
  const hours = settings.business_hours || '';

  parts.push(
    `Business name: ${businessName}.` +
      (businessType ? ` Business type: ${businessType}.` : '') +
      (address ? ` Address: ${address}.` : '') +
      (hours ? ` Normal business hours: ${hours}.` : '')
  );

  const abilities: string[] = [];
  if (settings.can_answer_questions) abilities.push('answer common customer questions');
  if (settings.can_book_appointments) abilities.push('book appointments when the caller is ready');
  if (settings.can_take_messages) abilities.push('take a clear message with name, number, and reason for calling');

  if (abilities.length > 0) {
    parts.push(
      `You are allowed to ${abilities.join(
        ', '
      )}. If you are not sure about something, stay honest and offer to take a message instead of guessing.`
    );
  }

  if (settings.can_book_appointments) {
    parts.push(
      `# Appointment booking workflow\n` +
        `When the caller asks to book an appointment (or mentions a preferred date/time), do this:\n` +
        `1) Extract requestedStartAt as an ISO8601 string and estimate durationMinutes (default 30 if not specified).\n` +
        `2) Call the tool \`check_availability\` with { "requestedStartAt": "<iso>", "durationMinutes": <number> }.\n` +
        `3) If isAvailable is false, present suggestedSlots and ask the caller to confirm one of them.\n` +
        `4) After confirmation, call the tool \`book_appointment\` with:\n` +
        `   { "customerName": "<caller name>", "customerPhone": "<caller phone>", "startAt": "<confirmed start iso>", "endAt": "<confirmed end iso>", "callNotes": "<short summary>" }.\n` +
        `5) If booking fails because the slot is no longer available, call \`check_availability\` again and ask the caller to pick from the updated suggestedSlots.\n` +
        `For v1, create the booking with type='Service' and title='Appointment'.`
    );
  }

  if (settings.transfer_urgent_calls && settings.live_transfer_number) {
    parts.push(
      `If a caller says the matter is urgent or asks to speak with a real person, use the transfer call tool to reach the live transfer number immediately.`
    );
  }

  if (settings.answer_after_hours_only && hours) {
    parts.push(
      `This line is meant to handle calls **outside** normal business hours (${hours}). ` +
        `If the caller indicates it is within normal business hours, or if you can otherwise infer that it is within hours, ` +
        `politely explain that this line is for after-hours only and use the transfer call tool right away so the call goes to the main office.`
    );
  }

  parts.push(
    'Always confirm key details (like appointment times and caller contact info) by repeating them back before ending the call.'
  );

  return parts.join('\n\n');
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

  // Load current receptionist settings for this org.
  const { data: settings, error } = await supabase
    .from('ai_receptionists')
    .select(AI_RECEPTIONIST_SELECT_COLUMNS.join(', '))
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('[POST /api/vapi/assistants/sync] load settings', error);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  if (!settings) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'Please save your AI receptionist settings before syncing with Vapi.' },
      { status: 400 }
    );
  }

  const receptionistSettings = settings as unknown as AiReceptionistSettingsRow;
  // Determine which Vapi voice to use based on saved voice id.
  const voiceId = VOICE_MAP[receptionistSettings.voice] ?? 'Emma';

  try {
    // Check if a primary assistant already exists for this org.
    const { data: existingAssistant, error: existingError } = await supabase
      .from('vapi_assistants')
      .select('id, vapi_assistant_id')
      .eq('organization_id', organizationId)
      .eq('is_primary', true)
      .maybeSingle();

    if (existingError) {
      console.error('[POST /api/vapi/assistants/sync] load existing assistant error', existingError);
      return NextResponse.json(
        { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
        { status: 500 }
      );
    }

    let vapiAssistantId: string;

    if (existingAssistant?.vapi_assistant_id) {
      // Update existing assistant in Vapi. SDK expects a single object with id and fields.
      const updated = await vapi.assistants.update({
        id: existingAssistant.vapi_assistant_id,
        name: receptionistSettings.agent_name,
        firstMessage: 'Hi, this is your AI receptionist. How can I help you today?',
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(receptionistSettings),
            },
          ],
        },
        voice: {
          provider: 'vapi',
          voiceId: voiceId as Parameters<typeof vapi.assistants.update>[0]['voice'] extends { voiceId: infer V } ? V : never,
        },
      });

      vapiAssistantId = updated.id;
    } else {
      // Create a new assistant in Vapi.
      const created = await vapi.assistants.create({
        name: receptionistSettings.agent_name,
        firstMessage: 'Hi, this is your AI receptionist. How can I help you today?',
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(receptionistSettings),
            },
          ],
        },
        voice: {
          provider: 'vapi',
          voiceId: voiceId as Parameters<typeof vapi.assistants.create>[0]['voice'] extends { voiceId: infer V } ? V : never,
        },
      });

      vapiAssistantId = created.id;
    }

    // Persist the primary assistant record for this org without relying on ON CONFLICT.
    let rowResult;
    if (existingAssistant?.id) {
      const { data: updatedRow, error: updateError } = await supabase
        .from('vapi_assistants')
        .update({
          vapi_assistant_id: vapiAssistantId,
          name: receptionistSettings.agent_name,
          is_primary: true,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', existingAssistant.id)
        .select('id, vapi_assistant_id, name, is_primary, last_synced_at')
        .single();

      if (updateError) {
        console.error('[POST /api/vapi/assistants/sync] update assistant row error', updateError);
        return NextResponse.json(
          { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
          { status: 500 }
        );
      }

      rowResult = updatedRow;
    } else {
      const { data: insertedRow, error: insertError } = await supabase
        .from('vapi_assistants')
        .insert({
          organization_id: organizationId,
          vapi_assistant_id: vapiAssistantId,
          name: receptionistSettings.agent_name,
          is_primary: true,
          last_synced_at: new Date().toISOString(),
        })
        .select('id, vapi_assistant_id, name, is_primary, last_synced_at')
        .single();

      if (insertError) {
        console.error('[POST /api/vapi/assistants/sync] insert assistant row error', insertError);
        return NextResponse.json(
          { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
          { status: 500 }
        );
      }

      rowResult = insertedRow;
    }

    return NextResponse.json({ assistant: rowResult });
  } catch (e) {
    console.error('[POST /api/vapi/assistants/sync] vapi error', e);

    const status =
      (e as any)?.statusCode ??
      (e as any)?.status ??
      (e as any)?.response?.status ??
      (e as any)?.cause?.statusCode ??
      (e as any)?.cause?.status;

    if (status === 401) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Vapi authentication failed. Please check your VAPI_PRIVATE_KEY configuration.',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}

