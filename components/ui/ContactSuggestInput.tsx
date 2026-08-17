'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Contact } from '@/types';
import { formatContactOption } from '@/lib/contacts/format-contact-option';
import {
  createContactFromTypedQuery,
  filterContactsByQuery,
} from '@/lib/contacts/resolve-contact-query';

export interface ContactSuggestInputProps {
  contacts: Contact[];
  contactId: string;
  onContactIdChange: (contactId: string) => void;
  onQueryChange?: (query: string) => void;
  onCreateContact?: (query: string) => Promise<Contact | null>;
  loading?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  emptyHint?: string;
}

export const ContactSuggestInput: React.FC<ContactSuggestInputProps> = ({
  contacts,
  contactId,
  onContactIdChange,
  onQueryChange,
  onCreateContact,
  loading = false,
  disabled = false,
  id = 'contact-suggest',
  placeholder = 'Type name, phone, or email…',
  emptyHint = 'Type phone or name — previous CRM contacts appear as suggestions',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => contacts.find(c => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  useEffect(() => {
    if (selected) {
      setQuery(formatContactOption(selected));
    }
  }, [selected]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const suggestions = useMemo(() => filterContactsByQuery(contacts, query), [contacts, query]);
  const trimmed = query.trim();
  const exactMatch = suggestions.some(
    c => formatContactOption(c).toLowerCase() === trimmed.toLowerCase()
  );
  const showCreate =
    Boolean(onCreateContact) &&
    trimmed.length >= 2 &&
    !exactMatch &&
    contactId === '';

  const pickContact = (contact: Contact) => {
    onContactIdChange(contact.id);
    setQuery(formatContactOption(contact));
    onQueryChange?.(formatContactOption(contact));
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!onCreateContact || !trimmed || creating) return;
    setCreating(true);
    try {
      const created = await onCreateContact(trimmed);
      if (created) {
        onContactIdChange(created.id);
        setQuery(formatContactOption(created));
        onQueryChange?.(formatContactOption(created));
        setOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  const handlePickFirstOrCreate = async () => {
    if (contactId) return;
    if (suggestions.length === 1) {
      pickContact(suggestions[0]);
      return;
    }
    if (showCreate) {
      await handleCreate();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={query}
        disabled={disabled || loading || creating}
        placeholder={loading ? 'Loading contacts…' : placeholder}
        onChange={e => {
          const next = e.target.value;
          setQuery(next);
          onQueryChange?.(next);
          onContactIdChange('');
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' && open && !contactId) {
            e.preventDefault();
            void handlePickFirstOrCreate();
          }
        }}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />

      {open && !loading && (
        <ul
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
        >
          {!trimmed && contacts.length > 0 && (
            <li className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Recent CRM contacts
            </li>
          )}

          {suggestions.length === 0 && !showCreate && (
            <li className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              {contacts.length === 0
                ? 'No contacts yet — type a phone or name, then press Enter or Create Booking.'
                : 'No match — press Enter or tap below to use this as a new contact.'}
            </li>
          )}

          {suggestions.map(contact => (
            <li key={contact.id}>
              <button
                type="button"
                role="option"
                aria-selected={contact.id === contactId}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pickContact(contact)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-900/20 ${
                  contact.id === contactId
                    ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                {formatContactOption(contact)}
              </button>
            </li>
          ))}

          {showCreate && (
            <li>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => void handleCreate()}
                disabled={creating}
                className="w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50 dark:border-slate-800 dark:text-violet-400 dark:hover:bg-violet-900/20"
              >
                {creating ? 'Saving contact…' : `+ Use "${trimmed}" as contact for this booking`}
              </button>
            </li>
          )}

          {suggestions.length > 0 && !trimmed && (
            <li className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400 dark:border-slate-800">
              {emptyHint}
            </li>
          )}
        </ul>
      )}
    </div>
  );
};

export { createContactFromTypedQuery as createContactFromTypedName };
