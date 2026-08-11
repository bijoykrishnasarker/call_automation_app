import { describe, expect, it } from 'vitest';

import { normalizeVapiWebhook } from '@/lib/vapi/normalize-webhook';

const authContext = {
  mode: 'optional' as const,
  verified: false,
  method: 'none' as const,
  status: 'skipped' as const,
  header_trace: {},
};

describe('normalizeVapiWebhook', () => {
  it('normalizes full tool-call payload into canonical contact and appointment', () => {
    const payload = {
      message: {
        type: 'tool-calls',
        call: {
          id: 'call_001',
          direction: 'inbound',
          from: { number: '+15551231234' },
          to: { number: '+15557654321' },
          assistantId: 'asst_001',
          metadata: { organization_id: 'org_001' },
        },
        toolCallList: [
          {
            id: 'tool_001',
            name: 'book_appointment',
            parameters: {
              customerName: 'Dan Milcher',
              customerPhone: '+1 (555) 123-1234',
              customerEmail: 'Dan@Gmail.com',
              startAt: '2026-04-20T16:00:00-04:00',
              endAt: '2026-04-20T16:30:00-04:00',
              timezone: 'America/New_York',
              subject: 'Consultation for plumbing',
            },
          },
        ],
      },
    };

    const envelope = normalizeVapiWebhook({
      payload,
      rawBody: JSON.stringify(payload),
      receivedAt: '2026-04-20T19:00:00.000Z',
      authContext,
      headers: new Headers({ 'x-vapi-delivery-id': 'delivery_001' }),
    });

    expect(envelope.provider_delivery_id).toBe('delivery_001');
    expect(envelope.provider_call_id).toBe('call_001');
    expect(envelope.organization_id).toBe('org_001');
    expect(envelope.tool_calls).toHaveLength(1);

    const toolCall = envelope.tool_calls[0]!;
    expect(toolCall.contact?.external_contact_id).toContain('org_001');
    expect(toolCall.contact?.primary_phone).toBe('+15551231234');
    expect(toolCall.contact?.email).toBe('dan@gmail.com');
    expect(toolCall.appointment?.start_time_utc).toBe('2026-04-20T20:00:00.000Z');
    expect(toolCall.appointment?.end_time_utc).toBe('2026-04-20T20:30:00.000Z');
    expect(toolCall.validation_errors).toHaveLength(0);
  });

  it('accepts partial payload with optional fields missing', () => {
    const payload = {
      message: {
        type: 'tool-calls',
        call: {
          id: 'call_002',
          direction: 'inbound',
          metadata: { organization_id: 'org_001' },
        },
        toolCallList: [
          {
            id: 'tool_002',
            name: 'take_message',
            parameters: {
              name: 'Caller',
              phone: '1234567899',
              message: 'Need callback tomorrow morning',
            },
          },
        ],
      },
    };

    const envelope = normalizeVapiWebhook({
      payload,
      rawBody: JSON.stringify(payload),
      receivedAt: '2026-04-20T19:00:00.000Z',
      authContext,
      headers: new Headers(),
    });

    const toolCall = envelope.tool_calls[0]!;
    expect(toolCall.contact?.first_name).toBe('Caller');
    expect(toolCall.contact?.email).toBeNull();
    expect(toolCall.contact?.source).toBe('Vapi tool:take_message');
    expect(toolCall.validation_errors).toHaveLength(0);
  });

  it('reports validation errors for invalid appointment time', () => {
    const payload = {
      message: {
        type: 'tool-calls',
        call: {
          id: 'call_003',
          metadata: { organization_id: 'org_001' },
        },
        toolCallList: [
          {
            id: 'tool_003',
            name: 'book_appointment',
            parameters: {
              customerName: 'Dan Milcher',
              customerPhone: '+15551231234',
              customerEmail: 'dan@gmail.com',
              startAt: 'not-a-date',
              endAt: '2026-04-20T16:30:00-04:00',
              timezone: 'America/New_York',
              subject: 'Consultation',
            },
          },
        ],
      },
    };

    const envelope = normalizeVapiWebhook({
      payload,
      rawBody: JSON.stringify(payload),
      receivedAt: '2026-04-20T19:00:00.000Z',
      authContext,
      headers: new Headers(),
    });

    const toolCall = envelope.tool_calls[0]!;
    expect(toolCall.appointment).toBeNull();
    expect(toolCall.validation_errors.some(issue => issue.code === 'invalid_appointment_window')).toBe(true);
  });
});
