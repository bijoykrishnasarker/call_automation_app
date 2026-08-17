import { Contact, ContactStatus } from '@/types';
import { formatContactOption } from '@/lib/contacts/format-contact-option';

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function contactMatchesQuery(contact: Contact, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.company,
    formatContactOption(contact),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes(q)) return true;

  const qDigits = phoneDigits(q);
  if (qDigits.length >= 3) {
    const cDigits = phoneDigits(contact.phone || '');
    if (cDigits && (cDigits.includes(qDigits) || qDigits.includes(cDigits))) return true;
  }

  return false;
}

export function filterContactsByQuery(contacts: Contact[], query: string, limit = 8): Contact[] {
  const q = query.trim();
  const list = q ? contacts.filter(c => contactMatchesQuery(c, q)) : contacts;
  return list.slice(0, limit);
}

export function findContactByQuery(contacts: Contact[], query: string): Contact | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const matches = filterContactsByQuery(contacts, trimmed, 20);
  if (matches.length === 1) return matches[0];

  const qDigits = phoneDigits(trimmed);
  if (qDigits.length >= 7) {
    const phoneMatch = contacts.find(c => {
      const cDigits = phoneDigits(c.phone || '');
      return cDigits === qDigits || cDigits.endsWith(qDigits) || qDigits.endsWith(cDigits);
    });
    if (phoneMatch) return phoneMatch;
  }

  const lower = trimmed.toLowerCase();
  const exact = matches.find(c => formatContactOption(c).toLowerCase() === lower);
  return exact ?? null;
}

function splitName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function looksLikePhone(raw: string): boolean {
  const trimmed = raw.trim();
  const digits = phoneDigits(trimmed);
  return digits.length >= 7 && /^[\d+\s().-]+$/.test(trimmed);
}

export async function createContactFromTypedQuery(
  addContact: (contact: Contact) => Promise<Contact | null>,
  raw: string
): Promise<Contact | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (looksLikePhone(trimmed)) {
    const digits = phoneDigits(trimmed);
    const phone = trimmed.startsWith('+') ? trimmed : digits.startsWith('880') ? `+${digits}` : trimmed;
    return addContact({
      id: crypto.randomUUID(),
      firstName: 'Contact',
      lastName: digits.slice(-4) || 'New',
      email: '',
      phone,
      company: '',
      status: ContactStatus.NewLead,
      tags: ['Booking'],
      lastActivity: 'Just now',
      source: 'Calendar Booking',
      notes: [],
      tasks: [],
    });
  }

  const { firstName, lastName } = splitName(trimmed);
  if (!firstName) return null;

  return addContact({
    id: crypto.randomUUID(),
    firstName,
    lastName,
    email: trimmed.includes('@') ? trimmed : '',
    phone: '',
    company: '',
    status: ContactStatus.NewLead,
    tags: ['Booking'],
    lastActivity: 'Just now',
    source: 'Calendar Booking',
    notes: [],
    tasks: [],
  });
}

export async function resolveContactIdFromQuery(
  contacts: Contact[],
  query: string,
  addContact: (contact: Contact) => Promise<Contact | null>
): Promise<string | null> {
  const existing = findContactByQuery(contacts, query);
  if (existing) return existing.id;

  const created = await createContactFromTypedQuery(addContact, query);
  return created?.id ?? null;
}
