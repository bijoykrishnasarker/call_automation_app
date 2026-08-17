import { Contact, ContactStatus, Message, Note } from '@/types';
import { normalizePhone } from '@/lib/vapi/conversation';

export type CallRow = {
  id: string;
  direction?: string | null;
  from_number?: string | null;
  caller_phone?: string | null;
  full_name?: string | null;
  email?: string | null;
  message?: string | null;
  summary?: string | null;
  transcript?: string | null;
  call_reason?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  needs_human_review?: boolean | null;
};

export type ReceptionistMessageRow = {
  id: string;
  from_number?: string | null;
  customer_name?: string | null;
  message: string;
  created_at: string;
};

export function phoneKey(phone?: string | null): string {
  const normalized = normalizePhone(phone ?? '');
  const digits = (normalized || phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function findContactForCaller(
  contacts: Contact[],
  phone?: string | null,
  email?: string | null,
): Contact | undefined {
  const key = phoneKey(phone);
  if (key) {
    const byPhone = contacts.find((c) => phoneKey(c.phone) === key);
    if (byPhone) return byPhone;
  }
  const em = email?.trim().toLowerCase();
  if (em) return contacts.find((c) => c.email?.trim().toLowerCase() === em);
  return undefined;
}

function clip(text: string, max = 800): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function parseNoteDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function messagesFromContactNotes(contact: Contact): Message[] {
  return contact.notes
    .filter((note) => note.text && ['call-log', 'ai-summary', 'sms', 'email'].includes(note.type))
    .map((note: Note): Message => {
      const outbound = note.type === 'sms' || note.type === 'email';
      const channel: Message['channel'] = note.type === 'email' ? 'email' : note.type === 'sms' ? 'sms' : 'call';
      return {
        id: note.id || `note-${contact.id}-${note.createdAt}`,
        contactId: contact.id,
        text: note.text,
        createdAt: parseNoteDate(note.createdAt),
        direction: outbound ? 'outbound' : 'inbound',
        channel,
        read: outbound || note.type === 'call-log',
      };
    });
}

export function syntheticContact(params: {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Contact {
  const name = (params.name || 'Caller').trim();
  const parts = name.split(/\s+/);
  return {
    id: params.id,
    firstName: parts[0] || 'Caller',
    lastName: parts.slice(1).join(' '),
    email: params.email || '',
    phone: params.phone || '',
    tags: ['lead'],
    status: ContactStatus.NewLead,
    notes: [],
    tasks: [],
    source: 'AI Receptionist',
    lastActivity: 'Inbox',
  };
}

export function messagesFromCalls(calls: CallRow[], contacts: Contact[]): { extraContacts: Contact[]; messages: Message[] } {
  const extraContacts: Contact[] = [];
  const messages: Message[] = [];
  const seenGhostPhones = new Set<string>();

  for (const call of calls) {
    const phone = call.caller_phone || call.from_number || '';
    let contact = findContactForCaller(contacts, phone, call.email);
    if (!contact) {
      const key = phoneKey(phone) || call.id;
      const ghostId = `ghost-call-${key}`;
      contact = extraContacts.find((c) => c.id === ghostId);
      if (!contact) {
        contact = syntheticContact({
          id: ghostId,
          name: call.full_name,
          phone,
          email: call.email,
        });
        if (!seenGhostPhones.has(ghostId)) {
          extraContacts.push(contact);
          seenGhostPhones.add(ghostId);
        }
      }
    }

    const text = clip(call.message || call.summary || call.transcript || call.call_reason || 'Voice call');
    messages.push({
      id: `call-${call.id}`,
      contactId: contact.id,
      text,
      createdAt: new Date(call.started_at || call.created_at || Date.now()),
      direction: call.direction === 'outbound' ? 'outbound' : 'inbound',
      channel: 'call',
      read: !call.needs_human_review,
    });
  }

  return { extraContacts, messages };
}

export function messagesFromReceptionist(
  rows: ReceptionistMessageRow[],
  contacts: Contact[],
): { extraContacts: Contact[]; messages: Message[] } {
  const extraContacts: Contact[] = [];
  const messages: Message[] = [];

  for (const row of rows) {
    let contact = findContactForCaller(contacts, row.from_number, null);
    if (!contact) {
      const key = phoneKey(row.from_number) || row.id;
      const ghostId = `ghost-msg-${key}`;
      contact = extraContacts.find((c) => c.id === ghostId) ?? syntheticContact({
        id: ghostId,
        name: row.customer_name,
        phone: row.from_number,
      });
      if (!extraContacts.some((c) => c.id === contact!.id)) extraContacts.push(contact);
    }

    messages.push({
      id: `rm-${row.id}`,
      contactId: contact.id,
      text: row.message,
      createdAt: new Date(row.created_at),
      direction: 'inbound',
      channel: 'sms',
      read: false,
    });
  }

  return { extraContacts, messages };
}

export function mergeInboxContacts(crmContacts: Contact[], extras: Contact[]): Contact[] {
  const merged = [...crmContacts];
  for (const extra of extras) {
    const exists = findContactForCaller(merged, extra.phone, extra.email) || merged.some((c) => c.id === extra.id);
    if (!exists) merged.push(extra);
  }
  return merged;
}
