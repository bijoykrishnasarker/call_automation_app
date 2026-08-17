'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, Calendar, BadgeCheck, Clock } from 'lucide-react';
import { Contact, ContactStatus } from '@/types';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';

interface DashboardProps {
  contacts: Contact[];
  bookedCount?: number;
  wonDealsCount?: number;
}

const DEFAULT_SOURCES = [
  { name: 'Organic Search', pct: 45, bar: 'bg-violet-400' },
  { name: 'Referral', pct: 25, bar: 'bg-emerald-400' },
  { name: 'Social Media', pct: 20, bar: 'bg-violet-500' },
  { name: 'Direct', pct: 10, bar: 'bg-violet-300' },
];

const SOURCE_BAR_COLORS = ['bg-violet-400', 'bg-emerald-400', 'bg-violet-500', 'bg-violet-300'];

export const Dashboard: React.FC<DashboardProps> = ({
  contacts,
  bookedCount: bookedCountProp,
  wonDealsCount = 0,
}) => {
  const [timeRange, setTimeRange] = useState('Last 7 Days');

  const filteredContacts = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();

    if (timeRange === 'Last 7 Days') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === 'Last 30 Days') {
      cutoff.setDate(now.getDate() - 30);
    } else if (timeRange === 'This Month') {
      cutoff.setDate(1);
    }

    return contacts.filter((c) => {
      if (!c.createdAt) return true;
      return new Date(c.createdAt) >= cutoff;
    });
  }, [contacts, timeRange]);

  const sourceData = useMemo(() => {
    if (filteredContacts.length === 0) return DEFAULT_SOURCES;

    const counts: Record<string, number> = {};
    filteredContacts.forEach((c) => {
      const source = c.source || 'Direct';
      counts[source] = (counts[source] || 0) + 1;
    });

    const total = filteredContacts.length || 1;
    return Object.entries(counts)
      .map(([name, value], index) => ({
        name,
        pct: Math.round((value / total) * 100),
        bar: SOURCE_BAR_COLORS[index % SOURCE_BAR_COLORS.length],
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [filteredContacts]);

  const activityData = useMemo(() => {
    if (timeRange === 'Last 7 Days') {
      return [
        { name: 'Day 1', bookings: 18, velocity: 10 },
        { name: 'Day 2', bookings: 22, velocity: 12 },
        { name: 'Day 3', bookings: 16, velocity: 9 },
        { name: 'Day 4', bookings: 28, velocity: 14 },
        { name: 'Day 5', bookings: 24, velocity: 11 },
        { name: 'Day 6', bookings: 20, velocity: 10 },
        { name: 'Day 7', bookings: 14, velocity: 8 },
      ];
    }
    if (timeRange === 'Last 30 Days') {
      return [
        { name: 'Week 1', bookings: 25, velocity: 10 },
        { name: 'Week 2', bookings: 32, velocity: 15 },
        { name: 'Week 3', bookings: 28, velocity: 12 },
        { name: 'Week 4', bookings: 45, velocity: 20 },
      ];
    }
    return [
      { name: 'Week 1', bookings: 15, velocity: 5 },
      { name: 'Week 2', bookings: 22, velocity: 8 },
      { name: 'Week 3', bookings: 35, velocity: 18 },
      { name: 'Week 4', bookings: 20, velocity: 9 },
    ];
  }, [timeRange]);

  const newLeadsCount = filteredContacts.filter((c) => c.status === ContactStatus.NewLead).length;
  const bookedCount =
    bookedCountProp ??
    filteredContacts.filter((c) => c.status === ContactStatus.Booked).length;
  const wonCount =
    wonDealsCount ||
    filteredContacts.filter((c) => c.status === ContactStatus.Won).length;

  const recentContacts = useMemo(
    () =>
      [...contacts]
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5),
    [contacts],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Contacts"
          value={contacts.length}
          icon={Users}
          trend="+12%"
          trendLabel="vs last 30 days"
          delay={0}
        />
        <StatCard
          title="New Leads"
          value={newLeadsCount}
          icon={UserPlus}
          trend="+8.4%"
          trendLabel="vs last 7 days"
          delay={80}
        />
        <StatCard
          title="Booked Appointments"
          value={bookedCount}
          icon={Calendar}
          trend="+5.2%"
          trendLabel="vs last 7 days"
          delay={160}
        />
        <StatCard
          title="Won Deals"
          value={wonCount}
          icon={BadgeCheck}
          trend="+15%"
          trendLabel="conversion rate"
          delay={240}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard
          title="Lead Velocity & Bookings"
          className="animate-fade-in lg:col-span-2"
          action={
            <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-violet-400" />
                Bookings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-500" />
                Velocity
              </span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="ml-1 cursor-pointer rounded-lg border border-white/[0.08] bg-[#111214] px-2 py-1 text-xs text-zinc-400 outline-none focus:border-violet-500"
              >
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>This Month</option>
              </select>
            </div>
          }
        >
          <div className="h-72 w-full min-h-[288px] min-w-0">
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={activityData} barGap={4} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    borderRadius: '0.75rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: '#141416',
                    color: '#f4f4f5',
                  }}
                />
                <Bar dataKey="bookings" stackId="a" fill="#a78bfa" radius={[0, 0, 0, 0]} />
                <Bar dataKey="velocity" stackId="a" fill="#52525b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard title="Lead Sources" className="animate-fade-in">
            <ul className="space-y-4">
              {sourceData.map((source) => (
                <li key={source.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-300">{source.name}</span>
                    <span className="font-semibold text-zinc-200">{source.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${source.bar} transition-all duration-700`}
                      style={{ width: `${Math.max(source.pct, 4)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard
            title="Recent Activity"
            action={<span className="text-xs font-medium text-zinc-500">{contacts.length} total</span>}
            className="animate-fade-in flex-1"
          >
            {recentContacts.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">No contacts added yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {recentContacts.map((contact) => (
                  <li key={contact.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-300">
                      {contact.firstName[0]}
                      {contact.lastName[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {contact.source || 'Direct'} · {contact.status}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1 text-[11px] text-zinc-500 sm:flex">
                      <Clock className="h-3 w-3" />
                      {contact.lastActivity}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
