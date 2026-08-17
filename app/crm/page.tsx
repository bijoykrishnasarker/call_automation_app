'use client';

import { CRM } from '@/components/CRM';
import { useApp } from '@/contexts/AppContext';

export default function CRMPage() {
    const { contacts, contactsLoading, contactsError, clearContactsError, addContact, updateContact, deleteContact, crmAction } = useApp();
    return (
        <CRM
            contacts={contacts}
            contactsLoading={contactsLoading}
            contactsError={contactsError}
            onClearContactsError={clearContactsError}
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            actionRequest={crmAction}
        />
    );
}
