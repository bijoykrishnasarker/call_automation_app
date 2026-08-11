import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

// Create a high-level MCP server
const server = new McpServer({
  name: 'Bangladesh CRM',
  version: '1.0.0',
});

// FALLBACK_ORG_ID from the user's Vapi tool configuration
const AUTHORIZED_VAPI_ORG_ID = '2501843f-0f4c-4d2f-8fe8-9c061f5be22f';
const AUTHORIZED_VAPI_TOOL_ID = 'db6007aa-6b70-418a-85e4-4dfcb34dd65b';

// Helper to get organization ID from Vapi headers
// Vapi sends X-Call-Id and other headers which we can cross-reference
async function getOrganizationId(headers: Headers) {
  const supabase = createSupabaseServiceClient();
  const callId = headers.get('x-call-id');
  const vapiOrgId = headers.get('x-vapi-org-id');
  const vapiToolId = headers.get('x-vapi-tool-id');

  // Security: Check if the request is from our specific Vapi tool/org
  if (vapiOrgId && vapiOrgId !== AUTHORIZED_VAPI_ORG_ID) {
    console.warn('[MCP] Unauthorized Org ID:', vapiOrgId);
    // return null; // Uncomment to enforce org isolation
  }

  if (vapiToolId && vapiToolId !== AUTHORIZED_VAPI_TOOL_ID) {
    console.warn('[MCP] Tool ID mismatch:', vapiToolId);
  }

  // 1. Try to find organization via the call ID in the database
  if (callId) {
    const { data: callRow } = await supabase
      .from('calls')
      .select('organization_id')
      .eq('vapi_call_id', callId)
      .maybeSingle();
    
    if (callRow?.organization_id) return callRow.organization_id;
  }
  
  // 2. Try Authorization header (Bearer local_uuid) from Vapi Tools dashboard custom headers
  const auth = headers.get('authorization');
  if (auth?.startsWith('Bearer org_')) {
     return auth.replace('Bearer ', '');
  }

  // 3. Fallback: If it's a call from our specific Vapi Org, we might assign it a default local org for testing
  if (vapiOrgId === AUTHORIZED_VAPI_ORG_ID) {
    return '00000000-0000-0000-0000-000000000000'; // Replace with a real local org ID if you have one
  }

  return null;
}

function normalizePhone(raw: unknown): string {
  if (raw == null) return '';
  const value = typeof raw === 'string' ? raw : String(raw);
  const trimmed = value.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');

  // Basic US/E.164 normalization used throughout the app.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (trimmed.startsWith('+')) return trimmed;
  return trimmed;
}

async function getOwnerUserIdForOrganization(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  organizationId: string
): Promise<string | null> {
  // Preferred: organizations.owner_user_id
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('owner_user_id')
    .eq('id', organizationId)
    .maybeSingle();

  const ownerUserId = orgRow?.owner_user_id;
  if (typeof ownerUserId === 'string' && ownerUserId.trim()) return ownerUserId.trim();

  // Fallback: pick any profile in the org.
  const { data: profileRow } = await supabase
    .from('profiles')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const profileId = profileRow?.id;
  return typeof profileId === 'string' && profileId.trim() ? profileId.trim() : null;
}

function getUuid(): string {
  // Server-side runtime should have crypto, but keep a fallback for safety.
  return (globalThis.crypto as Crypto | undefined)?.randomUUID?.() ?? `id_${Date.now()}`;
}

async function upsertContactByPhone(params: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  userId: string;
  customerName?: string;
  customerPhone: string;
  email?: string;
  callNoteText?: string;
}) {
  const { supabase, userId, customerName, customerPhone, email, callNoteText } = params;

  const normalizedPhone = normalizePhone(customerPhone);
  if (!normalizedPhone) {
    throw new Error('Missing valid customer phone number.');
  }

  const fullName = (customerName ?? '').trim();
  const [firstName, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(' ').trim();

  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, notes, created_at')
    .eq('user_id', userId)
    .eq('phone', normalizedPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingNotes: any[] = Array.isArray(existing?.notes) ? existing!.notes : [];

  const shouldAddNote = typeof callNoteText === 'string' && callNoteText.trim();
  const newNote = shouldAddNote
    ? {
        id: getUuid(),
        text: callNoteText.trim(),
        createdAt: now,
        type: 'call-log' as const,
      }
    : null;

  const updatedNotes = newNote ? [...existingNotes, newNote] : existingNotes;

  if (existing?.id) {
    const updatePayload: Record<string, unknown> = {
      notes: updatedNotes,
      last_activity: now,
    };

    if (fullName && (!existing.first_name || !existing.last_name)) {
      updatePayload.first_name = firstName || existing.first_name || '';
      updatePayload.last_name = lastName || existing.last_name || '';
    }

    if (typeof email === 'string' && email.trim()) {
      updatePayload.email = email.trim();
    }

    const { data: updated, error } = await supabase
      .from('contacts')
      .update(updatePayload)
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('id, first_name, last_name, email, phone, notes, created_at')
      .maybeSingle();

    if (error) throw error;
    return updated;
  }

  const { data: inserted, error } = await supabase
    .from('contacts')
    .insert({
      user_id: userId,
      first_name: firstName || '',
      last_name: lastName || '',
      email: typeof email === 'string' ? email.trim() : '',
      phone: normalizedPhone,
      company: null,
      status: 'New Lead',
      tags: [],
      source: 'AI Receptionist',
      last_activity: now,
      notes: updatedNotes,
      tasks: [],
      address: null,
      city: null,
      state: null,
      zip: null,
    })
    .select('id, first_name, last_name, email, phone, notes, created_at')
    .maybeSingle();

  if (error) throw error;
  if (!inserted?.id) throw new Error('Failed to create contact.');
  return inserted;
}

async function checkAvailability(params: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  userId: string;
  requestedStartAt: string;
  durationMinutes: number;
  requestedEndAt?: string;
  suggestionsCount?: number;
  suggestionWindowDays?: number;
}): Promise<{
  isAvailable: boolean;
  suggestedSlots: Array<{ startAt: string; endAt: string }>;
}> {
  const {
    supabase,
    userId,
    requestedStartAt,
    durationMinutes,
    requestedEndAt,
    suggestionsCount = 3,
    suggestionWindowDays = 7,
  } = params;

  const start = new Date(requestedStartAt);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid requestedStartAt.');

  const durationMs = Math.max(1, Math.floor(durationMinutes)) * 60 * 1000;
  const end = requestedEndAt ? new Date(requestedEndAt) : new Date(start.getTime() + durationMs);
  if (Number.isNaN(end.getTime())) throw new Error('Invalid requestedEndAt.');

  const windowStart = start.toISOString();
  const windowEndDate = new Date(start.getTime() + suggestionWindowDays * 24 * 60 * 60 * 1000);
  const windowEnd = windowEndDate.toISOString();

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('start_at,end_at')
    .eq('user_id', userId)
    .lt('start_at', windowEnd)
    .gt('end_at', windowStart);

  if (error) throw error;

  const bookingIntervals = (bookings ?? []).map((b: any) => ({
    start: new Date(b.start_at).getTime(),
    end: new Date(b.end_at).getTime(),
  }));

  const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    aStart < bEnd && aEnd > bStart;

  const requestedOverlaps = bookingIntervals.some((i) => overlaps(start.getTime(), end.getTime(), i.start, i.end));
  const isAvailable = !requestedOverlaps;

  if (isAvailable) {
    return {
      isAvailable: true,
      suggestedSlots: [{ startAt: start.toISOString(), endAt: end.toISOString() }],
    };
  }

  // If busy: suggest the next available slots in 30-min increments.
  const suggestedSlots: Array<{ startAt: string; endAt: string }> = [];
  const incrementMs = 30 * 60 * 1000;

  let cursorMs = start.getTime() + incrementMs;
  while (suggestedSlots.length < suggestionsCount) {
    const candidateStart = new Date(cursorMs);
    const candidateEnd = new Date(cursorMs + durationMs);
    if (candidateEnd.getTime() > windowEndDate.getTime()) break;

    const candidateOverlaps = bookingIntervals.some((i) =>
      overlaps(candidateStart.getTime(), candidateEnd.getTime(), i.start, i.end)
    );

    if (!candidateOverlaps) {
      suggestedSlots.push({
        startAt: candidateStart.toISOString(),
        endAt: candidateEnd.toISOString(),
      });
    }

    cursorMs += incrementMs;
  }

  return { isAvailable: false, suggestedSlots };
}

async function bookAppointment(params: {
  supabase: ReturnType<typeof createSupabaseServiceClient>;
  userId: string;
  customerName: string;
  customerPhone: string;
  startAt: string;
  endAt: string;
  callNotes?: string;
}): Promise<{ bookingId: string }> {
  const { supabase, userId, customerName, customerPhone, startAt, endAt, callNotes } = params;

  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid startAt/endAt.');
  }

  // Safety check to avoid race-condition double-booking.
  const { data: conflicts, error: conflictError } = await supabase
    .from('bookings')
    .select('id,start_at,end_at')
    .eq('user_id', userId)
    .lt('start_at', end.toISOString())
    .gt('end_at', start.toISOString());

  if (conflictError) throw conflictError;
  if ((conflicts ?? []).length > 0) {
    const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / (60 * 1000)));
    const availability = await checkAvailability({
      supabase,
      userId,
      requestedStartAt: start.toISOString(),
      durationMinutes,
    });

    throw new Error(
      JSON.stringify({
        error: 'slot_unavailable',
        suggestedSlots: availability.suggestedSlots,
      })
    );
  }

  const contact = await upsertContactByPhone({
    supabase,
    userId,
    customerName,
    customerPhone,
    callNoteText: callNotes ?? '',
  });

  const { data: inserted, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      contact_id: contact.id,
      title: 'Appointment',
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      type: 'Service',
      status: 'Confirmed',
    })
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!inserted?.id) throw new Error('Failed to create booking.');
  return { bookingId: inserted.id };
}

// Register Tool: Take Message
server.tool(
  'take_message',
  {
    name: z.string().describe('The name of the customer.'),
    phone: z.string().describe('The phone number of the customer.'),
    message: z.string().describe('The message content.'),
  },
  async ({ name, phone, message }, extra) => {
    const supabase = createSupabaseServiceClient();
    const headers = (extra as any)?.requestInfo?.headers as Headers | undefined;
    if (!headers) return { content: [{ type: 'text', text: 'Error: Missing request headers.' }], isError: true };
    const organizationId = await getOrganizationId(headers);

    // For now, if no org found, we fallback to a default or error
    // In production, we'd want to enforce organizationId
    if (!organizationId) {
      console.warn('[MCP take_message] No organization found for request');
      // return { content: [{ type: 'text', text: 'Error: Unauthorized call.' }], isError: true };
    }

    const { error } = await supabase.from('receptionist_messages').insert({
      organization_id: organizationId || '00000000-0000-0000-0000-000000000000', // Placeholder for now
      customer_name: name,
      from_number: phone,
      message,
    });

    if (error) {
      return {
        content: [{ type: 'text', text: `Failed to save message: ${error.message}` }],
        isError: true,
      };
    }

    // Also upsert the contact (and attach call notes) so the CRM stays in sync.
    // We treat MCP tools as privileged server calls, so we use the resolved org -> owner_user_id mapping.
    if (organizationId) {
      const ownerUserId = await getOwnerUserIdForOrganization(supabase, organizationId);
      if (ownerUserId) {
        await upsertContactByPhone({
          supabase,
          userId: ownerUserId,
          customerName: name,
          customerPhone: phone,
          callNoteText: message,
        });
      }
    }

    return {
      content: [{ type: 'text', text: 'Message successfully recorded in the CRM.' }],
    };
  }
);

// Register Tool: Check Availability
server.tool(
  'check_availability',
  {
    requestedStartAt: z.string().describe('ISO8601 start time requested by the caller.'),
    durationMinutes: z.number().describe('Duration in minutes for the appointment slot.'),
    requestedEndAt: z.string().optional().describe('Optional ISO8601 end time. If provided, durationMinutes can be ignored.'),
  },
  async ({ requestedStartAt, durationMinutes, requestedEndAt }, extra) => {
    const supabase = createSupabaseServiceClient();
    const headers = (extra as any)?.requestInfo?.headers as Headers | undefined;
    if (!headers) return { content: [{ type: 'text', text: 'Error: Missing request headers.' }], isError: true };
    const organizationId = await getOrganizationId(headers);
    if (!organizationId) {
      return { content: [{ type: 'text', text: 'Error: Unauthorized call.' }], isError: true };
    }

    const ownerUserId = await getOwnerUserIdForOrganization(supabase, organizationId);
    if (!ownerUserId) {
      return { content: [{ type: 'text', text: 'Error: No user mapping for organization.' }], isError: true };
    }

    try {
      const result = await checkAvailability({
        supabase,
        userId: ownerUserId,
        requestedStartAt,
        durationMinutes,
        requestedEndAt,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to check availability';
      return { content: [{ type: 'text', text: message }], isError: true };
    }
  }
);

// Register Tool: Book Appointment
server.tool(
  'book_appointment',
  {
    customerName: z.string().describe('Caller/customer full name.'),
    customerPhone: z.string().describe('Caller/customer phone number (ideally E.164).'),
    startAt: z.string().describe('ISO8601 slot start time to book.'),
    endAt: z.string().describe('ISO8601 slot end time to book.'),
    callNotes: z.string().optional().describe('Short call summary to attach to the contact as a note.'),
  },
  async ({ customerName, customerPhone, startAt, endAt, callNotes }, extra) => {
    const supabase = createSupabaseServiceClient();
    const headers = (extra as any)?.requestInfo?.headers as Headers | undefined;
    if (!headers) return { content: [{ type: 'text', text: 'Error: Missing request headers.' }], isError: true };
    const organizationId = await getOrganizationId(headers);
    if (!organizationId) {
      return { content: [{ type: 'text', text: 'Error: Unauthorized call.' }], isError: true };
    }

    const ownerUserId = await getOwnerUserIdForOrganization(supabase, organizationId);
    if (!ownerUserId) {
      return { content: [{ type: 'text', text: 'Error: No user mapping for organization.' }], isError: true };
    }

    try {
      const result = await bookAppointment({
        supabase,
        userId: ownerUserId,
        customerName,
        customerPhone,
        startAt,
        endAt,
        callNotes,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify({ booked: true, ...result }) }],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to book appointment';
      return { content: [{ type: 'text', text: message }], isError: true };
    }
  }
);

// Register Tool: Search Projects
server.tool(
  'search_projects',
  {
    query: z.string().describe('Search query for project name or address.'),
  },
  async ({ query }) => {
    const supabase = createSupabaseServiceClient();
    
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, name, status, address')
      .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
      .limit(5);

    if (error) {
      return {
        content: [{ type: 'text', text: `Error searching projects: ${error.message}` }],
        isError: true,
      };
    }

    if (!projects || projects.length === 0) {
      return {
        content: [{ type: 'text', text: 'No matching projects found.' }],
      };
    }

    const projectText = projects.map(p => 
      `- ${p.name}\n  Status: ${p.status}\n  Address: ${p.address || 'N/A'}\n  ID: ${p.id}`
    ).join('\n\n');

    return {
      content: [{ type: 'text', text: `Found ${projects.length} project(s):\n\n${projectText}` }],
    };
  }
);

// Register Tool: Get Project Details
server.tool(
  'get_project_details',
  {
    projectId: z.string().describe('The unique ID of the project.'),
  },
  async ({ projectId }) => {
    const supabase = createSupabaseServiceClient();
    
    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      return {
        content: [{ type: 'text', text: `Error fetching project: ${error.message}` }],
        isError: true,
      };
    }

    if (!project) {
      return {
        content: [{ type: 'text', text: 'Project not found.' }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
    };
  }
);

// Setup the transport for Next.js App Router
const transport = new WebStandardStreamableHTTPServerTransport();

// Reusable handler to ensure server is connected to transport
async function handleMcp(request: Request) {
  // If not already connected, connect it. 
  // In serverless, we might need to do this per request or check if it's already connected.
  if (!server.isConnected()) {
    await server.connect(transport);
  }
  return await transport.handleRequest(request);
}

export async function GET(request: Request) {
  return await handleMcp(request);
}

export async function POST(request: Request) {
  return await handleMcp(request);
}

export async function DELETE(request: Request) {
  return await handleMcp(request);
}

// OPTIONS for CORS (Vapi needs this)
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
