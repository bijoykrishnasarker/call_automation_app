import { createHmac, timingSafeEqual } from 'node:crypto';

import type { CanonicalAuthContext } from '@/lib/vapi/types';

function getHeader(headers: Headers, ...names: string[]): string | null {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

function normalizeMode(): 'off' | 'optional' | 'required' {
  const raw = (process.env.VAPI_WEBHOOK_AUTH_MODE ?? 'optional').trim().toLowerCase();
  if (raw === 'off' || raw === 'required') return raw;
  return 'optional';
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyVapiWebhook(input: {
  headers: Headers;
  rawBody: string;
}): {
  accepted: boolean;
  shouldReject: boolean;
  authContext: CanonicalAuthContext;
} {
  const mode = normalizeMode();
  const sharedSecret = process.env.VAPI_WEBHOOK_SECRET?.trim() ?? '';
  const signingSecret = process.env.VAPI_WEBHOOK_SIGNING_SECRET?.trim() ?? '';

  const authorizationHeader = getHeader(input.headers, 'authorization');
  const sharedSecretHeader = getHeader(input.headers, 'x-vapi-secret', 'x-webhook-secret');
  const signatureHeader = getHeader(input.headers, 'x-vapi-signature', 'x-vapi-signature-256');
  const deliveryIdHeader = getHeader(input.headers, 'x-vapi-delivery-id', 'x-webhook-id');
  const forwardedProto = getHeader(input.headers, 'x-forwarded-proto');

  const authContext: CanonicalAuthContext = {
    mode,
    verified: false,
    method: 'none',
    status: 'skipped',
    header_trace: {
      authorization: authorizationHeader,
      x_vapi_secret: sharedSecretHeader,
      x_vapi_signature: signatureHeader,
      x_vapi_delivery_id: deliveryIdHeader,
      x_forwarded_proto: forwardedProto,
    },
  };

  const requireTls = (process.env.VAPI_WEBHOOK_REQUIRE_TLS ?? 'true').trim().toLowerCase() !== 'false';
  if (requireTls && forwardedProto && forwardedProto.toLowerCase() !== 'https') {
    authContext.status = 'failed';
    authContext.reason = 'tls_required';
    return {
      accepted: false,
      shouldReject: true,
      authContext,
    };
  }

  if (mode === 'off') {
    authContext.reason = 'auth_mode_off';
    return { accepted: true, shouldReject: false, authContext };
  }

  if (!sharedSecret && !signingSecret) {
    authContext.reason = 'no_server_secret_configured';
    return {
      accepted: true,
      shouldReject: false,
      authContext,
    };
  }

  if (sharedSecret) {
    const bearer = authorizationHeader?.startsWith('Bearer ') ? authorizationHeader.slice(7).trim() : null;
    const providedSecret = sharedSecretHeader ?? bearer;
    if (providedSecret && safeEquals(sharedSecret, providedSecret)) {
      authContext.verified = true;
      authContext.method = 'shared-secret';
      authContext.status = 'accepted';
      return {
        accepted: true,
        shouldReject: false,
        authContext,
      };
    }
  }

  if (signingSecret && signatureHeader) {
    const digest = createHmac('sha256', signingSecret).update(input.rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();
    if (provided && safeEquals(digest, provided)) {
      authContext.verified = true;
      authContext.method = 'signature';
      authContext.status = 'accepted';
      return {
        accepted: true,
        shouldReject: false,
        authContext,
      };
    }
  }

  authContext.status = 'failed';
  authContext.reason = 'signature_or_secret_mismatch';

  if (mode === 'required') {
    return {
      accepted: false,
      shouldReject: true,
      authContext,
    };
  }

  return {
    accepted: true,
    shouldReject: false,
    authContext,
  };
}
