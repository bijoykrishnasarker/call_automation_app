'use client';

import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Users, Calendar, TrendingUp, MessageSquare } from 'lucide-react';
import { Contact, ContactStatus } from '@/types';

interface DashboardProps {
  contacts: Contact[];
}

const StatCard = ({ title, value, subtext, icon: Icon, color, delay }: any) => (
  <div
    className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-start justify-between transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group animate-fade-in"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 group-hover:scale-105 transition-transform origin-left">{value}</h3>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{subtext}</p>
    </div>
    <div className={`p-3 rounded-lg ${color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ contacts }) => {
  const [timeRange, setTimeRange] = useState('Last 7 Days');

  // Filter contacts based on time range
  const filteredContacts = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();

    if (timeRange === 'Last 7 Days') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === 'Last 30 Days') {
      cutoff.setDate(now.getDate() - 30);
    } else if (timeRange === 'This Month') {
      cutoff.setDate(1); // 1st of month
    }

    return contacts.filter(c => {
      if (!c.createdAt) return true; // Fallback if no date
      return new Date(c.createdAt) >= cutoff;
    });
  }, [contacts, timeRange]);

  // Dynamically aggregate lead sources based on filtered data
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredContacts.forEach(c => {
      const source = c.source || 'Direct';
      counts[source] = (counts[source] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredContacts]);

  // Generate mock chart data that changes based on selection to show interactivity
  const activityData = useMemo(() => {
    if (timeRange === 'Last 7 Days') {
      return [
        { name: 'Mon', leads: 4, bookings: 2 },
        { name: 'Tue', leads: 7, bookings: 3 },
        { name: 'Wed', leads: 5, bookings: 4 },
        { name: 'Thu', leads: 9, bookings: 6 },
        { name: 'Fri', leads: 12, bookings: 8 },
        { name: 'Sat', leads: 8, bookings: 5 },
        { name: 'Sun', leads: 3, bookings: 1 },
      ];
    }
    if (timeRange === 'Last 30 Days') {
      return [
        { name: 'Week 1', leads: 25, bookings: 10 },
        { name: 'Week 2', leads: 32, bookings: 15 },
        { name: 'Week 3', leads: 28, bookings: 12 },
        { name: 'Week 4', leads: 45, bookings: 20 },
      ];
    }
    // This Month
    return [
      { name: 'Week 1', leads: 15, bookings: 5 },
      { name: 'Week 2', leads: 22, bookings: 8 },
      { name: 'Week 3', leads: 35, bookings: 18 },
      { name: 'Week 4', leads: 20, bookings: 9 },
    ];
  }, [timeRange]);

  // Calculate dynamic stats based on filtered contacts
  const newLeadsCount = filteredContacts.filter(c => c.status === ContactStatus.NewLead).length;
  // For Booked, we show total booked contacts that were created in this period (as a proxy for recent activity)
  const bookedCount = filteredContacts.filter(c => c.status === ContactStatus.Booked).length;

  // Mock Revenue scaling
  const estimatedRevenue = (bookedCount * 450) + (newLeadsCount * 50);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg p-2.5 focus:ring-lime-500 focus:border-lime-500 transition-shadow hover:shadow-sm cursor-pointer"
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="New Leads"
          value={newLeadsCount}
          subtext="In selected period"
          icon={Users}
          color="bg-blue-500"
          delay={0}
        />
        <StatCard
          title="Booked Appts"
          value={bookedCount}
          subtext="Scheduled recently"
          icon={Calendar}
          color="bg-lime-500"
          delay={100}
        />
        <StatCard
          title="Revenue (Est)"
          value={`$${estimatedRevenue.toLocaleString()}`}
          subtext="Based on pipeline"
          icon={TrendingUp}
          color="bg-emerald-500"
          delay={200}
        />
        <StatCard
          title="AI Interactions"
          value={filteredContacts.length * 3 + 12}
          subtext="Auto-replies sent"
          icon={MessageSquare}
          color="bg-purple-500"
          delay={300}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: '400ms' }}>
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Lead Velocity & Bookings ({timeRange})</h3>
          <div className="h-64 w-full min-h-[256px] min-w-0">
            <ResponsiveContainer width="100%" height={256}>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#84cc16" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  animationDuration={200}
                />
                <Area type="monotone" dataKey="leads" stroke="#84cc16" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" animationDuration={1000} />
                <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" animationDuration={1000} animationBegin={200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Lead Sources</h3>
          <div className="h-64 w-full min-h-[256px] min-w-0">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#64748b" radius={[0, 4, 4, 0]} barSize={20} animationDuration={1000} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p className="text-sm">No data for this period.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};