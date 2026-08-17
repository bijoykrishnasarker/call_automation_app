import { Contact, ContactStatus, Note, Task } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { isMissingColumnError } from '@/lib/ai-receptionist/supabase-errors';

/** DB row shape (snake_case) */
interface ContactRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: string;
  tags: string[];
  source: string | null;
  last_activity: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: unknown;
  tasks: unknown;
  created_at: string;
  updated_at: string;
}

function parseTask(t: unknown): Task {
  if (t && typeof t === 'object' && 'id' in t && 'title' in t && 'dueDate' in t && 'completed' in t) {
    const o = t as { id: string; title: string; dueDate: string | Date; completed: boolean };
    return {
      id: o.id,
      title: o.title,
      dueDate: typeof o.dueDate === 'string' ? new Date(o.dueDate) : o.dueDate,
      completed: o.completed,
    };
  }
  return { id: '', title: '', dueDate: new Date(), completed: false };
}

function parseNote(n: unknown): Note {
  if (n && typeof n === 'object' && 'id' in n && 'text' in n && 'createdAt' in n && 'type' in n) {
    const o = n as { id: string; text: string; createdAt: string; type: Note['type'] };
    return { id: o.id, text: o.text, createdAt: o.createdAt, type: o.type };
  }
  return { id: '', text: '', createdAt: '', type: 'note' };
}

export function rowToContact(row: ContactRow): Contact {
  const notes = Array.isArray(row.notes) ? row.notes.map(parseNote) : [];
  const tasks = Array.isArray(row.tasks) ? row.tasks.map(parseTask) : [];
  const status = Object.values(ContactStatus).includes(row.status as ContactStatus)
    ? (row.status as ContactStatus)
    : ContactStatus.NewLead;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone ?? '',
    company: row.company ?? undefined,
    status,
    tags: Array.isArray(row.tags) ? row.tags : [],
    source: row.source ?? 'Manual Entry',
    lastActivity: row.last_activity ?? 'Just now',
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    zip: row.zip ?? undefined,
    notes,
    tasks,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
  };
}

function contactToPayload(contact: Partial<Contact>): Record<string, unknown> {
  return {
    first_name: contact.firstName?.trim() || 'Unknown',
    last_name: contact.lastName?.trim() || '—',
    email: contact.email?.trim() || '',
    phone: contact.phone?.trim() ?? '',
    company: contact.company?.trim() || null,
    status: contact.status ?? ContactStatus.NewLead,
    tags: contact.tags ?? [],
    source: contact.source ?? 'Manual Entry',
    last_activity: contact.lastActivity ?? 'Just now',
    address: contact.address ?? null,
    city: contact.city ?? null,
    state: contact.state ?? null,
    zip: contact.zip ?? null,
    notes: contact.notes ?? [],
    tasks: Array.isArray(contact.tasks)
      ? contact.tasks.map(t => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : t.dueDate,
          completed: t.completed,
        }))
      : [],
  };
}

export async function fetchContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message || 'Failed to load contacts');
  return (data ?? []).map(rowToContact);
}

export async function createContact(userId: string, contact: Omit<Contact, 'id'> | Contact): Promise<Contact> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sign in to add contacts.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        status: contact.status,
        tags: contact.tags,
        source: contact.source,
        lastActivity: contact.lastActivity,
        notes: contact.notes,
        tasks: Array.isArray(contact.tasks)
          ? contact.tasks.map(t => ({
              id: t.id,
              title: t.title,
              dueDate: t.dueDate instanceof Date ? t.dueDate.toISOString() : t.dueDate,
              completed: t.completed,
            }))
          : [],
        address: contact.address,
        city: contact.city,
        state: contact.state,
        zip: contact.zip,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({})) as { contact?: ContactRow; message?: string };
    if (!res.ok || !data.contact) {
      throw new Error(data.message || 'Failed to add contact');
    }
    return rowToContact(data.contact);
  } catch (err) {
    if (
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      throw new Error('Saving the contact took too long. Please try again.');
    }
    throw err instanceof Error ? err : new Error('Failed to add contact');
  } finally {
    clearTimeout(timer);
  }
}

export async function updateContact(userId: string, contact: Contact): Promise<Contact> {
  const payload = contactToPayload(contact);
  const phone = contact.phone?.trim() || '';
  const withPhone = { ...payload, primary_phone: phone || null, updated_at: new Date().toISOString() };

  let { data, error } = await supabase
    .from('contacts')
    .update(withPhone)
    .eq('id', contact.id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error && isMissingColumnError(error)) {
    const retry = await supabase
      .from('contacts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', contact.id)
      .eq('user_id', userId)
      .select('*')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(error.message || 'Failed to update contact');
  return rowToContact(data as ContactRow);
}

export async function deleteContact(_userId: string, contactId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sign in to delete contacts.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('/api/contacts', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id: contactId }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({})) as { message?: string };
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete contact');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Delete took too long. Please try again.');
    }
    throw err instanceof Error ? err : new Error('Failed to delete contact');
  } finally {
    clearTimeout(timer);
  }
}
