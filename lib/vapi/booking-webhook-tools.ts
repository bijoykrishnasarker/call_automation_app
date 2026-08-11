import type { Vapi } from '@vapi-ai/server-sdk';

const WEBHOOK_TIMEOUT_SECONDS = 45;

function buildWebhookHeaders(): Record<string, unknown> | undefined {
  const sharedSecret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  if (!sharedSecret) return undefined;
  return {
    'x-vapi-secret': sharedSecret,
  };
}

export function buildVapiWebhookServer(baseUrl: string): Vapi.Server {
  const headers = buildWebhookHeaders();
  return {
    url: `${baseUrl.replace(/\/$/, '')}/api/vapi/webhook`,
    timeoutSeconds: WEBHOOK_TIMEOUT_SECONDS,
    headers,
    backoffPlan: {
      type: 'fixed',
      maxRetries: Number(process.env.VAPI_WEBHOOK_SERVER_MAX_RETRIES ?? '2'),
      baseDelaySeconds: Number(process.env.VAPI_WEBHOOK_SERVER_RETRY_DELAY_SECONDS ?? '2'),
    } as unknown as Vapi.BackoffPlan,
  };
}

/**
 * Vapi function tools with `server.url` → `/api/vapi/webhook` (`tool-calls` messages).
 * Azure OpenAI rejects MCP-derived tools when `tools[0].function.name` is empty; these
 * definitions always set `function.name` explicitly.
 */
export function buildBookingWebhookTools(
  baseUrl: string,
  options: { bookAppointments: boolean; takeMessages: boolean }
): Vapi.VapiModelToolsItem[] {
  const root = baseUrl.replace(/\/$/, '');
  const server = buildVapiWebhookServer(root);

  const tools: Vapi.VapiModelToolsItem[] = [];

  if (options.bookAppointments) {
    tools.push({
      type: 'function',
      server,
      function: {
        name: 'check_availability',
        description:
          'Check if a calendar slot is free. Call before booking. Use ISO8601 for times.',
        parameters: {
          type: 'object',
          properties: {
            requestedStartAt: {
              type: 'string',
              description: 'Requested slot start in ISO8601 format.',
            },
            durationMinutes: {
              type: 'number',
              description: 'Length of the appointment in minutes (default 30 if unknown).',
            },
            timezone: {
              type: 'string',
              description: 'IANA timezone for the appointment, for example Asia/Dhaka or America/New_York.',
            },
            requestedEndAt: {
              type: 'string',
              description: 'Optional explicit end time ISO8601.',
            },
          },
          required: ['requestedStartAt', 'durationMinutes', 'timezone'],
        },
      },
    });

    tools.push({
      type: 'function',
      server,
      function: {
        name: 'book_appointment',
        description:
          'Create a confirmed appointment after the caller agrees on a specific slot from check_availability.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: "Caller's name." },
            customerPhone: { type: 'string', description: "Caller's phone (E.164 preferred)." },
            customerEmail: { type: 'string', description: "Caller's email address." },
            startAt: { type: 'string', description: 'Confirmed start ISO8601.' },
            endAt: { type: 'string', description: 'Confirmed end ISO8601.' },
            timezone: {
              type: 'string',
              description: 'Original IANA timezone for the confirmed appointment.',
            },
            subject: { type: 'string', description: 'Appointment subject or service name.' },
            callNotes: {
              type: 'string',
              description: 'Short summary of what they booked.',
            },
          },
          required: ['customerName', 'customerPhone', 'customerEmail', 'startAt', 'endAt', 'timezone', 'subject'],
        },
      },
    });
  }

  if (options.takeMessages) {
    tools.push({
      type: 'function',
      server,
      function: {
        name: 'take_message',
        description:
          'Record a voicemail-style message. Provide at least one of message, note, or details with the text; include name and phone when known.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Primary message text to store.' },
            name: { type: 'string', description: "Caller's name if given." },
            phone: { type: 'string', description: "Caller's phone if given." },
            email: { type: 'string', description: "Caller's email if given." },
            note: { type: 'string', description: 'Same as message if you prefer this field.' },
            details: { type: 'string', description: 'Same as message if you prefer this field.' },
          },
          required: ['name', 'phone', 'email', 'message'],
        },
      },
    });
  }

  return tools;
}
