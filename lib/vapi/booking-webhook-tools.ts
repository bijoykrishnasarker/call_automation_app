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
          'Look up the live business calendar in Supabase. Call this BEFORE offering or booking a time. Returns isAvailable, suggestedSlots, and today. If isAvailable is false, that time is already booked — tell the caller and offer suggestedSlots display times.',
        parameters: {
          type: 'object',
          properties: {
            requestedStartAt: {
              type: 'string',
              description: 'Requested slot start. ISO8601 with offset, or local datetime like 2026-08-16T15:00.',
            },
            durationMinutes: {
              type: 'number',
              description: 'Length of the appointment in minutes (default 30 if unknown).',
            },
            timezone: {
              type: 'string',
              description: 'IANA timezone, for example Asia/Dhaka. Required so 3pm is the caller local time.',
            },
            localDate: {
              type: 'string',
              description: 'Optional calendar date YYYY-MM-DD if you do not have ISO requestedStartAt.',
            },
            localTime: {
              type: 'string',
              description: 'Optional local time HH:mm (24-hour), for example 15:00 for 3:00 PM.',
            },
            requestedEndAt: {
              type: 'string',
              description: 'Optional explicit end time ISO8601.',
            },
          },
          required: ['durationMinutes', 'timezone'],
        },
      },
    });

    tools.push({
      type: 'function',
      server,
      function: {
        name: 'book_appointment',
        description:
          'Save the appointment to the live calendar (Supabase bookings). The event then appears on the Calendar page. Only call after check_availability says the slot is free and the caller confirmed the time.',
        parameters: {
          type: 'object',
          properties: {
            customerName: { type: 'string', description: "Caller's name." },
            customerPhone: { type: 'string', description: "Caller's phone (E.164 preferred)." },
            customerEmail: { type: 'string', description: "Caller's email address." },
            startAt: {
              type: 'string',
              description: 'Confirmed start ISO8601 with offset. Must use the current calendar year unless the caller named another year.',
            },
            endAt: { type: 'string', description: 'Confirmed end ISO8601 with offset.' },
            localDate: {
              type: 'string',
              description: 'Preferred if ISO is uncertain. Calendar date YYYY-MM-DD in the current year, for example 2026-08-16.',
            },
            localTime: {
              type: 'string',
              description: 'Local time HH:mm (24-hour), for example 15:00 for 3:00 PM.',
            },
            timezone: {
              type: 'string',
              description: 'Original IANA timezone for the confirmed appointment, usually Asia/Dhaka.',
            },
            subject: { type: 'string', description: 'Appointment subject or service name.' },
            callNotes: {
              type: 'string',
              description: 'Short summary of what they booked.',
            },
          },
            required: ['customerName', 'timezone', 'subject'],
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
