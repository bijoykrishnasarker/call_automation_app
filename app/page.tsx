'use client';

import { Dashboard } from '@/components/Dashboard';
import { useApp } from '@/contexts/AppContext';

export default function DashboardPage() {
    const { contacts } = useApp();
    return <Dashboard contacts={contacts} />;
}
