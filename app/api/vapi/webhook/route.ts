import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { handleVapiWebhook } from '@/lib/vapi/handle-webhook';

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: 'Bad Request', message: 'Content-Type must be application/json.' }, { status: 400 });
  }

  const rawBody = await request.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Bad Request', message: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const requestId = request.headers.get('x-request-id') || Math.random().toString();

  try {
    const response = await handleVapiWebhook({
      supabase,
      payload,
      rawBody,
      headers: request.headers,
      requestId,
    });
    return NextResponse.json(response.body, { status: response.status });
  } catch (error) {
    console.error('[Webhook Route Error]', error);
    return NextResponse.json(
      { error: 'Internal error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
