import { NextRequest, NextResponse } from 'next/server';
import { VapiError } from '@vapi-ai/server-sdk';
import { createSupabaseClientForUser } from '@/lib/supabase/server';
import { getOrganizationIdForUser } from '@/lib/auth/get-organization-id';
import { vapi } from '@/lib/vapi/client';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

function getAccessToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/**
 * PATCH the org's primary Vapi number to use the org's primary assistant.
 * Use when the number exists but the dashboard shows no/wrong assistant.
 */
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

  const { data: phoneRow } = await supabase
    .from('vapi_phone_numbers')
    .select('vapi_phone_number_id')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!phoneRow?.vapi_phone_number_id) {
    return NextResponse.json(
      { error: 'Bad Request', message: 'No provisioned phone number found for this organization.' },
      { status: 400 }
    );
  }

  const { data: asstRow } = await supabase
    .from('vapi_assistants')
    .select('vapi_assistant_id')
    .eq('organization_id', organizationId)
    .eq('is_primary', true)
    .maybeSingle();

  const assistantId = asstRow?.vapi_assistant_id ?? null;
  if (!assistantId) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'No assistant on file. Use Save or Sync with Vapi in AI Center first.',
      },
      { status: 400 }
    );
  }

  try {
    await vapi.assistants.get({ id: assistantId });
  } catch (e) {
    const code = e instanceof VapiError ? e.statusCode : undefined;
    if (code === 404) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message:
            'Your saved assistant ID is not found in Vapi. Save or Sync with Vapi again to refresh it.',
        },
        { status: 400 }
      );
    }
    console.error('[POST /api/vapi/phone/link-assistant] assistants.get', e);
    return NextResponse.json(
      { error: 'Internal error', message: GENERIC_ERROR_MESSAGE },
      { status: 500 }
    );
  }

  try {
    await vapi.phoneNumbers.update({
      id: phoneRow.vapi_phone_number_id,
      body: { assistantId },
    });
  } catch (e) {
    console.error('[POST /api/vapi/phone/link-assistant] phoneNumbers.update', e);
    const msg =
      e instanceof VapiError
        ? (typeof e.body === 'object' && e.body && 'message' in e.body
            ? String((e.body as { message?: string }).message)
            : e.message)
        : GENERIC_ERROR_MESSAGE;
    return NextResponse.json(
      { error: 'Bad Request', message: msg || 'Failed to link assistant to phone number.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, message: 'Phone number linked to your assistant.' });
}
