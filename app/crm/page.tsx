'use client';

import { CRM } from '@/components/CRM';
import { useApp } from '@/contexts/AppContext';

export default function CRMPage() {
    const { contacts, contactsLoading, contactsError, addContact, updateContact, deleteContact, crmAction } = useApp();
    return (
        <CRM
            contacts={contacts}
            contactsLoading={contactsLoading}
            contactsError={contactsError}
            onAddContact={addContact}
            onUpdateContact={updateContact}
            onDeleteContact={deleteContact}
            actionRequest={crmAction}
        />
    );
}
