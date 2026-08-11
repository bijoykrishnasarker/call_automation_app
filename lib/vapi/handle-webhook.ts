import type { SupabaseClient } from '@supabase/supabase-js';

import {
  beginWebhookReceipt,
  completeWebhookReceipt,
  failWebhookReceipt,
} from '@/lib/vapi/idempotency';
import { logVapiError, logVapiInfo, logVapiWarn, recordVapiMetric } from '@/lib/vapi/logger';
import { applyResolvedOrganizationIds, normalizeVapiWebhook } from '@/lib/vapi/normalize-webhook';
import { persistEnvelope, resolveOrganizationIdForEnvelope } from '@/lib/vapi/persist-projections';
import type { VapiWebhookResponse } from '@/lib/vapi/types';
import { verifyVapiWebhook } from '@/lib/vapi/verify-webhook';

const GENERIC_ERROR_MESSAGE = 'An unexpected error occurred.';

export async function handleVapiWebhook(input: {
  supabase: SupabaseClient;
  payload: Record<string, unknown>;
  rawBody: string;
  headers: Headers;
  requestId: string;
}): Promise<VapiWebhookResponse> {
  const startedAt = Date.now();
  recordVapiMetric('webhook_received', 1, { request_id: input.requestId });

  const verification = verifyVapiWebhook({
    headers: input.headers,
    rawBody: input.rawBody,
  });

  if (verification.shouldReject) {
    recordVapiMetric('signature_failures', 1, { request_id: input.requestId });
    return {
      status: verification.authContext.method === 'none' ? 401 : 403,
      body: {
        error: 'Forbidden',
        message: 'Webhook authentication failed.',
      },
    };
  }

  let envelope = normalizeVapiWebhook({
    payload: input.payload,
    rawBody: input.rawBody,
    receivedAt: new Date().toISOString(),
    authContext: verification.authContext,
    headers: input.headers,
  });

  const organizationId = await resolveOrganizationIdForEnvelope(input.supabase, envelope);
  if (organizationId) {
    envelope = applyResolvedOrganizationIds(envelope, organizationId);
  }

  const receipt = await beginWebhookReceipt(input.supabase, envelope);
  if (receipt.kind === 'duplicate') {
    recordVapiMetric('duplicate_deliveries', 1, {
      provider_delivery_id: envelope.provider_delivery_id,
      request_id: input.requestId,
    });
    return {
      status: 200,
      body:
        envelope.provider_event_type === 'tool-calls' || envelope.tool_calls.length > 0
          ? {
              results: envelope.tool_calls.map(toolCall => ({
                toolCallId: toolCall.id,
                result: 'duplicate',
              })),
            }
          : {
              ok: true,
              duplicate: true,
            },
    };
  }

  if (receipt.kind === 'conflict') {
    return {
      status: 409,
      body: {
        error: 'Conflict',
        message: 'Duplicate delivery id received with a different payload.',
      },
    };
  }

  if (!organizationId) {
    await input.supabase
      .from('vapi_webhook_receipts')
      .update({
        status: 'validation_failed',
        last_error: {
          errors: [{ path: 'organization_id', code: 'organization_unresolved', message: 'Organization could not be resolved.' }],
        },
      })
      .eq('id', receipt.receiptId);
    recordVapiMetric('normalization_failures', 1, {
      provider_delivery_id: envelope.provider_delivery_id,
      request_id: input.requestId,
    });
    return {
      status: 422,
      body: {
        error: 'Validation failed',
        message: 'Organization could not be resolved.',
        issues: [{ path: 'organization_id', code: 'organization_unresolved', message: 'Organization could not be resolved.' }],
      },
    };
  }

  if (envelope.validation_errors.length > 0 && envelope.tool_calls.length === 0) {
    await input.supabase
      .from('vapi_webhook_receipts')
      .update({
        status: 'validation_failed',
        last_error: { errors: envelope.validation_errors },
      })
      .eq('id', receipt.receiptId);
    recordVapiMetric('normalization_failures', 1, {
      provider_delivery_id: envelope.provider_delivery_id,
      request_id: input.requestId,
    });
    return {
      status: 422,
      body: {
        error: 'Validation failed',
        message: 'Canonical validation failed.',
        issues: envelope.validation_errors,
      },
    };
  }

  try {
    const persisted = await persistEnvelope({
      supabase: input.supabase,
      envelope,
      organizationId,
      validationErrors: envelope.validation_errors,
    });

    await completeWebhookReceipt(input.supabase, receipt.receiptId, {
      call_id: persisted.callId,
      organization_id: organizationId,
      outcome: 'processed',
    });

    if (persisted.contactResult) {
      recordVapiMetric('contact_upserts', 1, {
        organization_id: organizationId,
        provider_call_id: envelope.provider_call_id,
      });
    }
    if (persisted.appointmentResult) {
      recordVapiMetric('appointment_upserts', 1, {
        organization_id: organizationId,
        provider_call_id: envelope.provider_call_id,
      });
    }

    const latency = Date.now() - startedAt;
    logVapiInfo('vapi.webhook.processed', {
      request_id: input.requestId,
      provider_delivery_id: envelope.provider_delivery_id,
      provider_call_id: envelope.provider_call_id,
      organization_id: organizationId,
      normalized_event_type: envelope.provider_event_type,
      processing_outcome: 'processed',
      latency_ms: latency,
      warnings: envelope.warnings,
      auth_verified: envelope.auth_context.verified,
    });

    return {
      status: 200,
      body:
        envelope.provider_event_type === 'tool-calls' || envelope.tool_calls.length > 0
          ? { results: persisted.toolResults }
          : {
              received: true,
              provider_delivery_id: envelope.provider_delivery_id,
              provider_call_id: envelope.provider_call_id,
              latency_ms: latency,
            },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE;
    await failWebhookReceipt(input.supabase, receipt.receiptId, receipt.attempts, {
      provider_delivery_id: envelope.provider_delivery_id,
      provider_call_id: envelope.provider_call_id,
      organization_id: organizationId,
      raw_payload: envelope.raw_payload,
      message,
    });

    if (message.includes('slot_unavailable')) {
      logVapiWarn('vapi.webhook.slot_conflict', {
        request_id: input.requestId,
        provider_delivery_id: envelope.provider_delivery_id,
        provider_call_id: envelope.provider_call_id,
        organization_id: organizationId,
        message,
      });
    } else {
      logVapiError('vapi.webhook.failed', {
        request_id: input.requestId,
        provider_delivery_id: envelope.provider_delivery_id,
        provider_call_id: envelope.provider_call_id,
        organization_id: organizationId,
        message,
      });
    }

    const isConflict = message.includes('slot_unavailable');
    if (isConflict) {
      return {
        status: 409,
        body: {
          error: 'Conflict',
          message,
        },
      };
    }

    recordVapiMetric('dead_letter_count', 1, {
      provider_delivery_id: envelope.provider_delivery_id,
      request_id: input.requestId,
    });
    return {
      status: 500,
      body: {
        error: 'Internal error',
        message: GENERIC_ERROR_MESSAGE,
      },
    };
  }
}
