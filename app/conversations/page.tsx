'use client';

import { Conversations } from '@/components/Conversations';
import { useApp } from '@/contexts/AppContext';

export default function ConversationsPage() {
    const { contacts, messages } = useApp();
    return <Conversations contacts={contacts} initialMessages={messages} />;
}
