'use client';

import { Conversations } from '@/components/Conversations';
import { useApp } from '@/contexts/AppContext';

export default function ConversationsPage() {
    const { contacts, updateContact, addContact, setCrmAction } = useApp();
    return (
        <Conversations
            contacts={contacts}
            updateContact={updateContact}
            addContact={addContact}
            setCrmAction={setCrmAction}
        />
    );
}
