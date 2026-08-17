'use client';

import React, { useState } from 'react';
import { Code, Globe, Users, CreditCard, Copy, Check, Facebook, CalendarDays, Phone, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

const TAB_CLASS = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
            ? 'bg-violet-500/15 text-violet-300'
            : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
    }`;

export const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('embeds');
    const [copied, setCopied] = useState('');
    const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({
        'Google Calendar': true,
        'Stripe': true,
        'Twilio': true,
        'Facebook Lead Ads': false,
    });

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(''), 2000);
    };

    const toggleConnection = (app: string) => {
        setConnectedApps(prev => ({
            ...prev,
            [app]: !prev[app]
        }));
    };

    const CHAT_WIDGET_CODE = `<script src="https://cdn.leadops.ai/widget.js" data-id="12345"></script>`;
    const BOOKING_WIDGET_CODE = `<iframe src="https://leadops.ai/book/12345" width="100%" height="600" frameborder="0"></iframe>`;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <PageHeader
                breadcrumbs={[
                    { label: 'Preferences' },
                    { label: 'Settings' },
                ]}
                title="Platform Settings"
                subtitle="Manage web embeds, integrations, team access, and billing tier."
            />

            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#141416] md:flex-row">
                <div className="w-full shrink-0 space-y-1 border-b border-white/[0.06] bg-[#111214] p-3 md:w-56 md:border-b-0 md:border-r">
                    <button type="button" onClick={() => setActiveTab('embeds')} className={TAB_CLASS(activeTab === 'embeds')}>
                        <Code className="h-4 w-4" /> Embeds &amp; Widgets
                    </button>
                    <button type="button" onClick={() => setActiveTab('integrations')} className={TAB_CLASS(activeTab === 'integrations')}>
                        <Globe className="h-4 w-4" /> Integrations
                    </button>
                    <button type="button" onClick={() => setActiveTab('team')} className={TAB_CLASS(activeTab === 'team')}>
                        <Users className="h-4 w-4" /> Team Members
                    </button>
                    <button type="button" onClick={() => setActiveTab('billing')} className={TAB_CLASS(activeTab === 'billing')}>
                        <CreditCard className="h-4 w-4" /> Plan &amp; Billing
                    </button>
                </div>

                <div className="min-w-0 flex-1 p-5 sm:p-8">
                    {activeTab === 'embeds' && (
                        <div className="animate-fade-in space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white">Website Snippets</h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Copy and paste these snippets to your site (WordPress, Webflow, Shopify, HTML).
                                </p>
                            </div>

                            <div className="rounded-xl border border-white/[0.06] bg-black p-5">
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-white">AI Chat &amp; Lead Capture Widget</h4>
                                        <p className="mt-1 text-sm text-zinc-500">Adds interactive floating AI assistant chat bubble.</p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                                        active
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0B0C0E] px-3 py-3">
                                    <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-zinc-300">
                                        {CHAT_WIDGET_CODE}
                                    </pre>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(CHAT_WIDGET_CODE, 'chat')}
                                        className="shrink-0 rounded-md p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                                        aria-label="Copy chat widget snippet"
                                    >
                                        {copied === 'chat' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.06] bg-black p-5">
                                <div className="mb-4">
                                    <h4 className="font-bold text-white">Booking Calendar IFrame</h4>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        Embed live scheduling widget directly into your &apos;Book Consultation&apos; page.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#0B0C0E] px-3 py-3">
                                    <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs text-zinc-300">
                                        {BOOKING_WIDGET_CODE}
                                    </pre>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(BOOKING_WIDGET_CODE, 'booking')}
                                        className="shrink-0 rounded-md p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                                        aria-label="Copy booking iframe snippet"
                                    >
                                        {copied === 'booking' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="animate-fade-in space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white">Connected Integrations</h3>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Connect third-party calendars, payment processors, and ad channels.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {[
                                    { name: 'Google Calendar', icon: CalendarDays, desc: 'Sync consultations and appointments in real-time.' },
                                    { name: 'Stripe', icon: CreditCard, desc: 'Accept deposit payments during automated call bookings.' },
                                    { name: 'Twilio', icon: Phone, desc: 'Provision business phone lines and handle SMS forwarding.' },
                                    { name: 'Facebook Lead Ads', icon: Facebook, desc: 'Auto-import new ad leads into your CRM instant pipeline.' },
                                ].map((app) => {
                                    const connected = Boolean(connectedApps[app.name]);
                                    return (
                                        <div key={app.name} className="flex flex-col rounded-xl border border-white/[0.06] bg-black p-5">
                                            <div className="mb-3 flex items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                                                    <app.icon className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-white">{app.name}</h4>
                                                    <p className={`text-sm font-medium ${connected ? 'text-emerald-400' : 'text-zinc-500'}`}>
                                                        {connected ? 'Connected' : 'Disconnected'}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="mb-5 flex-1 text-sm text-zinc-500">{app.desc}</p>
                                            <button
                                                type="button"
                                                onClick={() => toggleConnection(app.name)}
                                                className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                                                    connected
                                                        ? 'border border-zinc-700 bg-[#111214] text-zinc-200 hover:bg-white/[0.04]'
                                                        : 'bg-violet-500 text-white hover:bg-violet-400'
                                                }`}
                                            >
                                                {connected ? 'Disconnect' : 'Connect Account'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="animate-fade-in space-y-6">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Team Management</h3>
                                    <p className="mt-1 text-sm text-zinc-500">Invite sales reps, support staff, and account managers.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const email = window.prompt('Invite email address');
                                        if (!email?.trim()) return;
                                        window.alert(`Invite sent to ${email.trim()} (they will appear after they accept).`);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-400"
                                >
                                    <Plus className="h-4 w-4" />
                                    Invite Member
                                </button>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { initials: 'A', name: 'Admin Account (You)', email: 'owner@leadops.ai', role: 'Owner' },
                                    { initials: 'S', name: 'Sarah Miller', email: 'sarah@leadops.ai', role: 'sales manager' },
                                ].map((member) => (
                                    <div key={member.email} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black px-4 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-sm font-bold text-violet-300">
                                                {member.initials}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-semibold text-white">{member.name}</p>
                                                <p className="truncate text-sm text-zinc-500">{member.email}</p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                                            {member.role}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="animate-fade-in space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-white">Subscription &amp; Usage</h3>
                                <p className="mt-1 text-sm text-zinc-500">Manage your active tier and credit balance.</p>
                            </div>

                            <div className="rounded-xl border border-violet-500/30 bg-black p-5">
                                <div className="mb-5 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Active Plan</p>
                                        <h4 className="mt-1 text-xl font-bold text-white">LeadOps Pro Scale</h4>
                                        <p className="mt-1 text-sm text-zinc-500">$149 / month • Renews on Sep 1, 2024</p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                                        Active
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-white/[0.06] bg-[#0B0C0E] p-4">
                                        <p className="text-xs text-zinc-500">Voice Call Minutes</p>
                                        <p className="mt-1 text-lg font-bold text-white">842 / 2,000</p>
                                    </div>
                                    <div className="rounded-lg border border-white/[0.06] bg-[#0B0C0E] p-4">
                                        <p className="text-xs text-zinc-500">SMS Broadcasts</p>
                                        <p className="mt-1 text-lg font-bold text-white">4,350 / 10,000</p>
                                    </div>
                                    <div className="rounded-lg border border-white/[0.06] bg-[#0B0C0E] p-4">
                                        <p className="text-xs text-zinc-500">Active Pipelines</p>
                                        <p className="mt-1 text-lg font-bold text-emerald-400">Unlimited</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    window.alert('Stripe billing portal is not connected yet. Manage your plan from Stripe Dashboard, or contact support to enable the customer portal.');
                                }}
                                className="text-sm font-medium text-violet-400 hover:underline"
                            >
                                Manage Subscription in Stripe
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
