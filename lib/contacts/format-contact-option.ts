import { Contact } from '@/types';

/** Label for contact dropdowns: name plus phone and/or email. */
export function formatContactOption(contact: Contact): string {
  const name = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
  const email = (contact.email || '').trim();
  const phone = (contact.phone || '').trim();
  const parts = [phone, email].filter(Boolean);
  const detail = parts.join(' · ');
  if (name && detail) return `${name} · ${detail}`;
  return name || detail || 'Unnamed contact';
}
