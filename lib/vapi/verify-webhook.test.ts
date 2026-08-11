import { afterEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';

import { verifyVapiWebhook } from '@/lib/vapi/verify-webhook';

const originalEnv = {
  mode: process.env.VAPI_WEBHOOK_AUTH_MODE,
  secret: process.env.VAPI_WEBHOOK_SECRET,
  signing: process.env.VAPI_WEBHOOK_SIGNING_SECRET,
};

afterEach(() => {
  if (originalEnv.mode === undefined) delete process.env.VAPI_WEBHOOK_AUTH_MODE;
  else process.env.VAPI_WEBHOOK_AUTH_MODE = originalEnv.mode;

  if (originalEnv.secret === undefined) delete process.env.VAPI_WEBHOOK_SECRET;
  else process.env.VAPI_WEBHOOK_SECRET = originalEnv.secret;

  if (originalEnv.signing === undefined) delete process.env.VAPI_WEBHOOK_SIGNING_SECRET;
  else process.env.VAPI_WEBHOOK_SIGNING_SECRET = originalEnv.signing;
});

describe('verifyVapiWebhook', () => {
  it('accepts valid shared secret in required mode', () => {
    process.env.VAPI_WEBHOOK_AUTH_MODE = 'required';
    process.env.VAPI_WEBHOOK_SECRET = 'secret_123';
    delete process.env.VAPI_WEBHOOK_SIGNING_SECRET;

    const result = verifyVapiWebhook({
      headers: new Headers({ 'x-vapi-secret': 'secret_123' }),
      rawBody: '{"ok":true}',
    });

    expect(result.accepted).toBe(true);
    expect(result.shouldReject).toBe(false);
    expect(result.authContext.verified).toBe(true);
    expect(result.authContext.method).toBe('shared-secret');
  });

  it('rejects invalid shared secret in required mode', () => {
    process.env.VAPI_WEBHOOK_AUTH_MODE = 'required';
    process.env.VAPI_WEBHOOK_SECRET = 'secret_123';

    const result = verifyVapiWebhook({
      headers: new Headers({ 'x-vapi-secret': 'wrong_secret' }),
      rawBody: '{"ok":true}',
    });

    expect(result.accepted).toBe(false);
    expect(result.shouldReject).toBe(true);
    expect(result.authContext.status).toBe('failed');
  });

  it('accepts valid signature', () => {
    process.env.VAPI_WEBHOOK_AUTH_MODE = 'required';
    delete process.env.VAPI_WEBHOOK_SECRET;
    process.env.VAPI_WEBHOOK_SIGNING_SECRET = 'signing_456';
    const rawBody = '{"event":"test"}';
    const digest = createHmac('sha256', 'signing_456').update(rawBody).digest('hex');

    const result = verifyVapiWebhook({
      headers: new Headers({ 'x-vapi-signature': `sha256=${digest}` }),
      rawBody,
    });

    expect(result.accepted).toBe(true);
    expect(result.shouldReject).toBe(false);
    expect(result.authContext.verified).toBe(true);
    expect(result.authContext.method).toBe('signature');
  });
});
