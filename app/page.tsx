'use client';

import { Dashboard } from '@/components/Dashboard';
import { useApp } from '@/contexts/AppContext';
import { ContactStatus } from '@/types';

export default function DashboardPage() {
    const { contacts, bookings, deals } = useApp();
    const bookedCount = bookings.length;
    const wonDealsCount = deals.length > 0
        ? deals.length
        : contacts.filter((c) => c.status === ContactStatus.Won).length;

    return (
        <Dashboard
            contacts={contacts}
            bookedCount={bookedCount}
            wonDealsCount={wonDealsCount}
        />
    );
}
