import type { SupabaseClient } from '@supabase/supabase-js';

import type { CanonicalVapiWebhookEnvelope } from '@/lib/vapi/types';

function computeNextRetryAt(attempts: number): string | null {
  const maxAttempts = Number(process.env.VAPI_WEBHOOK_MAX_ATTEMPTS ?? '5');
  if (attempts >= maxAttempts) return null;
  const baseSeconds = Number(process.env.VAPI_WEBHOOK_RETRY_BASE_SECONDS ?? '30');
  const seconds = Math.max(1, baseSeconds) * Math.pow(2, Math.max(0, attempts - 1));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export async function beginWebhookReceipt(
  supabase: SupabaseClient,
  envelope: CanonicalVapiWebhookEnvelope
): Promise<
  | { kind: 'ready'; receiptId: string; attempts: number }
  | { kind: 'duplicate' }
  | { kind: 'conflict' }
> {
  const { data: existing } = await supabase
    .from('vapi_webhook_receipts')
    .select('id, raw_payload_sha256, status, attempts')
    .eq('provider_delivery_id', envelope.provider_delivery_id)
    .maybeSingle();

  if (existing?.id) {
    if (existing.raw_payload_sha256 !== envelope.raw_payload_sha256) {
      return { kind: 'conflict' };
    }

    if (existing.status === 'processed') {
      return { kind: 'duplicate' };
    }

    const attempts = Number(existing.attempts ?? 0) + 1;
    await supabase
      .from('vapi_webhook_receipts')
      .update({
        provider_event_type: envelope.provider_event_type,
        provider_call_id: envelope.provider_call_id,
        provider_assistant_id: envelope.provider_assistant_id,
        organization_id: envelope.organization_id,
        auth_verified: envelope.auth_context.verified,
        auth_mode: envelope.auth_context.mode,
        auth_method: envelope.auth_context.method,
        auth_context: envelope.auth_context,
        headers: envelope.auth_context.header_trace,
        raw_payload: envelope.raw_payload,
        last_received_at: envelope.received_at,
        status: 'processing',
        attempts,
      })
      .eq('id', existing.id);

    return { kind: 'ready', receiptId: existing.id, attempts };
  }

  const { data: inserted } = await supabase
    .from('vapi_webhook_receipts')
    .insert({
      provider: envelope.provider,
      provider_delivery_id: envelope.provider_delivery_id,
      provider_event_type: envelope.provider_event_type,
      provider_call_id: envelope.provider_call_id,
      provider_assistant_id: envelope.provider_assistant_id,
      organization_id: envelope.organization_id,
      auth_verified: envelope.auth_context.verified,
      auth_mode: envelope.auth_context.mode,
      auth_method: envelope.auth_context.method,
      auth_context: envelope.auth_context,
      headers: envelope.auth_context.header_trace,
      raw_payload: envelope.raw_payload,
      raw_payload_sha256: envelope.raw_payload_sha256,
      first_received_at: envelope.received_at,
      last_received_at: envelope.received_at,
      status: 'processing',
      attempts: 1,
    })
    .select('id')
    .single();

  return {
    kind: 'ready',
    receiptId: inserted.id as string,
    attempts: 1,
  };
}

export async function completeWebhookReceipt(
  supabase: SupabaseClient,
  receiptId: string,
  detail: Record<string, unknown> = {}
) {
  await supabase
    .from('vapi_webhook_receipts')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
      last_error: detail,
      next_retry_at: null,
    })
    .eq('id', receiptId);
}

export async function failWebhookReceipt(
  supabase: SupabaseClient,
  receiptId: string,
  attempts: number,
  detail: Record<string, unknown>
) {
  const nextRetryAt = computeNextRetryAt(attempts);
  const status = nextRetryAt ? 'failed' : 'dead_letter';

  await supabase
    .from('vapi_webhook_receipts')
    .update({
      status,
      last_error: detail,
      next_retry_at: nextRetryAt,
    })
    .eq('id', receiptId);

  if (!nextRetryAt) {
    await supabase.from('vapi_webhook_dead_letters').insert({
      receipt_id: receiptId,
      provider_delivery_id: detail.provider_delivery_id,
      organization_id: detail.organization_id,
      provider_call_id: detail.provider_call_id,
      error_snapshot: detail,
      raw_payload: detail.raw_payload,
    });
  }
}

export async function registerProjection(
  supabase: SupabaseClient,
  input: {
    providerDeliveryId: string;
    organizationId: string | null;
    providerCallId: string | null;
    projectionKey: string;
    externalResourceId: string | null;
    resourceType: string;
    operation: string;
    outcome?: string;
    detail?: Record<string, unknown>;
  }
): Promise<'inserted' | 'duplicate'> {
  const { data: existing } = await supabase
    .from('vapi_event_projections')
    .select('id')
    .eq('projection_key', input.projectionKey)
    .maybeSingle();

  if (existing?.id) return 'duplicate';

  await supabase.from('vapi_event_projections').insert({
    provider_delivery_id: input.providerDeliveryId,
    organization_id: input.organizationId,
    provider_call_id: input.providerCallId,
    projection_key: input.projectionKey,
    external_resource_id: input.externalResourceId,
    resource_type: input.resourceType,
    operation: input.operation,
    outcome: input.outcome ?? 'created',
    detail: input.detail ?? {},
  });

  return 'inserted';
}
