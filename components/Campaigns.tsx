'use client';

import React, { useState } from 'react';
import { Campaign, CampaignChannel } from '@/types';
import { Plus, Mail, Smartphone, Bell, Share2, Calendar, ChevronRight, Check, X, Sparkles, Send, Clock, Eye, MousePointer2, DollarSign, MessageSquare } from 'lucide-react';
import { suggestEmailDraft } from '@/services/geminiService';
import { StatCard } from '@/components/ui/StatCard';

const MOCK_CAMPAIGNS: Campaign[] = [
    {
        id: '1',
        name: 'Q3 Product Launch Announcement',
        status: 'Sending',
        channels: ['email'],
        audienceTags: ['Enterprise', 'VIP'],
        scheduledDate: new Date(),
        stats: { sent: 22500, delivered: 22500, opened: 945, clicked: 1200 }
    },
    {
        id: '2',
        name: 'Flash Sale Reminder (VIPs)',
        status: 'Completed',
        channels: ['email', 'sms'],
        audienceTags: ['VIP'],
        scheduledDate: new Date(Date.now() - 86400000 * 2),
        stats: { sent: 2504, delivered: 2504, opened: 1277, clicked: 98 }
    },
    {
        id: '3',
        name: 'Weekly Newsletter Vol. 42',
        status: 'Scheduled',
        channels: ['email'],
        audienceTags: ['Newsletter'],
        scheduledDate: new Date(new Date().getFullYear(), 7, 17, 9, 0, 0),
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
    }
];

const formatCount = (n: number) => {
    if (n >= 1000) {
        const value = n / 1000;
        return `${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}K`;
    }
    return n.toLocaleString();
};

const formatPct = (part: number, total: number) => {
    if (!total) return '0%';
    const pct = (part / total) * 100;
    return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(1)}%`;
};

const channelIcon = (channel: CampaignChannel) => {
    if (channel === 'email') return Mail;
    if (channel === 'sms') return Smartphone;
    if (channel === 'push') return Bell;
    return Share2;
};

const statusDot = (status: Campaign['status']) => {
    if (status === 'Sending') return 'bg-emerald-400';
    if (status === 'Completed') return 'bg-zinc-500';
    if (status === 'Scheduled') return 'bg-sky-400';
    return 'bg-zinc-600';
};

export const Campaigns: React.FC = () => {
    const [view, setView] = useState<'list' | 'create'>('list');
    const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);

    // Create Mode State
    const [step, setStep] = useState(1);
    const [newCampaign, setNewCampaign] = useState<{
        name: string;
        tags: string[];
        channels: CampaignChannel[];
        content: { email: string; sms: string; push: string; social: string };
        schedule: 'now' | 'later';
        scheduledDate: string;
    }>({
        name: '',
        tags: [],
        channels: [],
        content: { email: '', sms: '', push: '', social: '' },
        schedule: 'now',
        scheduledDate: ''
    });

    const [aiLoading, setAiLoading] = useState(false);

    const handleCreateCampaign = () => {
        const campaign: Campaign = {
            id: Date.now().toString(),
            name: newCampaign.name,
            status: newCampaign.schedule === 'now' ? 'Sending' : 'Scheduled',
            channels: newCampaign.channels,
            audienceTags: newCampaign.tags,
            scheduledDate: newCampaign.schedule === 'now' ? new Date() : new Date(newCampaign.scheduledDate),
            stats: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
        };
        setCampaigns([campaign, ...campaigns]);
        setView('list');
        setStep(1);
        // Reset form
        setNewCampaign({
            name: '',
            tags: [],
            channels: [],
            content: { email: '', sms: '', push: '', social: '' },
            schedule: 'now',
            scheduledDate: ''
        });
    };

    const generateAIContent = async (channel: CampaignChannel) => {
        setAiLoading(true);
        let prompt = "";
        if (channel === 'email') prompt = "Write a promotional email for a summer sale. Keep it short.";
        if (channel === 'sms') prompt = "Write a catchy SMS under 160 chars for a flash sale.";
        if (channel === 'push') prompt = "Write a push notification title and body for a new offer.";
        if (channel === 'social') prompt = "Write a social media post with hashtags for a new service launch.";

        const content = await suggestEmailDraft("Audience", prompt);

        setNewCampaign(prev => ({
            ...prev,
            content: { ...prev.content, [channel]: content }
        }));
        setAiLoading(false);
    };

    const scheduledCampaigns = campaigns.filter(c => c.status === 'Scheduled');

    const renderList = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Total Sent (30d)" value="35,750" icon={Send} trend="12.5%" />
                <StatCard title="Avg Open Rate" value="42.8%" icon={Eye} trend="2.1%" />
                <StatCard title="Avg Click Rate" value="12.4%" icon={MousePointer2} trend="0.5%" />
                <StatCard
                    title="Conversions"
                    value="498"
                    icon={DollarSign}
                    iconClassName="bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                    trend="18.2%"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section>
                    <div className="mb-4 flex items-center gap-3">
                        <h3 className="text-lg font-bold text-white">Active Campaigns</h3>
                        <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                            {campaigns.length} Total
                        </span>
                    </div>
                    <div className="space-y-4">
                        {campaigns.map(c => {
                            const Icon = channelIcon(c.channels[0] || 'email');
                            const openRate = formatPct(c.stats.opened, c.stats.delivered);
                            return (
                                <article key={c.id} className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                                            {c.channels.includes('sms') && !c.channels.includes('email') ? <MessageSquare className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 className="truncate font-semibold text-white">{c.name}</h4>
                                            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                                                    {c.status}
                                                </span>
                                                <span>•</span>
                                                <span className="uppercase">{c.channels.join(', ')}</span>
                                                {c.audienceTags.length > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{c.audienceTags.join(', ')}</span>
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-4">
                                        <div>
                                            <p className="text-[11px] font-medium text-zinc-500">Delivered</p>
                                            <p className="mt-1 text-lg font-bold text-white">{formatCount(c.stats.delivered)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-zinc-500">Open Rate</p>
                                            <p className="mt-1 text-lg font-bold text-white">{openRate}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-medium text-zinc-500">Clicks</p>
                                            <p className="mt-1 text-lg font-bold text-emerald-400">{formatCount(c.stats.clicked)}</p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <aside className="space-y-4">
                    <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/15 via-[#141416] to-[#141416] p-5 shadow-[0_0_40px_rgba(139,92,246,0.12)]">
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                            <Sparkles className="h-4 w-4 text-violet-300" />
                            AI Campaign Insights
                        </h3>
                        <p className="text-sm leading-relaxed text-zinc-300">
                            Your email campaigns sent on Tuesday mornings have an 18% higher conversion rate. Consider scheduling your next blast between 9:00 AM – 11:00 AM.
                        </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
                        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Scheduled Queue</h3>
                        {scheduledCampaigns.length === 0 ? (
                            <p className="text-sm text-zinc-500">No scheduled campaigns.</p>
                        ) : (
                            <div className="space-y-3">
                                {scheduledCampaigns.map(c => (
                                    <div key={c.id} className="flex items-start gap-3">
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                                            <p className="mt-0.5 text-xs text-zinc-500">
                                                {c.scheduledDate
                                                    ? c.scheduledDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                    : 'Unscheduled'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );

    const renderWizard = () => (
        <div className="max-w-4xl mx-auto animate-slide-in-right">
            {/* Wizard Steps */}
            <div className="mb-8 relative overflow-x-auto pb-2">
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-zinc-800 -z-10" />
                <div className="flex min-w-max items-center justify-between gap-6">
                    {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s ? 'bg-violet-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#141416] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#111214] p-6">
                    <h3 className="text-xl font-bold text-white">
                        {step === 1 && "Campaign Details"}
                        {step === 2 && "Select Audience"}
                        {step === 3 && "Choose Channels"}
                        {step === 4 && "Design Content"}
                        {step === 5 && "Review & Schedule"}
                    </h3>
                    <button onClick={() => setView('list')} className="text-zinc-400 hover:text-zinc-200"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8">
                    {step === 1 && (
                        <div className="space-y-6 max-w-lg mx-auto">
                            <div>
                                <label className="block text-sm font-bold text-zinc-200 mb-2">Campaign Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Summer Sale 2026"
                                    value={newCampaign.name}
                                    onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                    className="w-full rounded-lg border border-zinc-800 bg-[#0B0C0E] p-3 text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-zinc-200 mb-2">Campaign Goal</label>
                                <select className="w-full rounded-lg border border-zinc-800 bg-[#0B0C0E] p-3 text-white outline-none focus:ring-2 focus:ring-violet-500">
                                    <option>Drive Sales</option>
                                    <option>Get Reviews</option>
                                    <option>Event Registration</option>
                                    <option>Brand Awareness</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Who should receive this campaign? Select tags to include.</p>
                            <div className="flex flex-wrap gap-3">
                                {['VIP', 'New Lead', 'Past Customers', 'Newsletter', 'Mobile App Users', 'High Value', 'Cold Leads'].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => {
                                            const tags = newCampaign.tags.includes(tag)
                                                ? newCampaign.tags.filter(t => t !== tag)
                                                : [...newCampaign.tags, tag];
                                            setNewCampaign({ ...newCampaign, tags });
                                        }}
                                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${newCampaign.tags.includes(tag) ? 'bg-violet-100 border-violet-500 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'}`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 text-center">
                                <p className="text-blue-800 dark:text-blue-300 font-bold text-lg">
                                    {newCampaign.tags.length > 0 ? (newCampaign.tags.length * 142) : 0}
                                </p>
                                <p className="text-blue-600 dark:text-blue-400 text-sm">Estimated Audience Size</p>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {[
                                { id: 'email', label: 'Email Marketing', icon: Mail, desc: 'High ROI, detailed content.' },
                                { id: 'sms', label: 'SMS Blast', icon: Smartphone, desc: '98% open rate, urgent updates.' },
                                { id: 'push', label: 'Web Push', icon: Bell, desc: 'Instant browser notifications.' },
                                { id: 'social', label: 'Social Post', icon: Share2, desc: 'Post to connected pages.' }
                            ].map(c => {
                                const Icon = c.icon;
                                const isSelected = newCampaign.channels.includes(c.id as CampaignChannel);
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => {
                                            const channels = isSelected
                                                ? newCampaign.channels.filter(ch => ch !== c.id)
                                                : [...newCampaign.channels, c.id as CampaignChannel];
                                            setNewCampaign({ ...newCampaign, channels });
                                        }}
                                        className={`p-6 rounded-xl border-2 text-left transition-all group ${isSelected ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 bg-slate-50 dark:bg-slate-800'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${isSelected ? 'bg-violet-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-400 group-hover:text-violet-500'}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <h4 className={`font-bold ${isSelected ? 'text-violet-900 dark:text-violet-300' : 'text-slate-700 dark:text-slate-200'}`}>{c.label}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{c.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-8">
                            {newCampaign.channels.map(channel => (
                                <div key={channel} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 uppercase text-sm">
                                            {channel === 'email' && <Mail className="w-4 h-4" />}
                                            {channel === 'sms' && <Smartphone className="w-4 h-4" />}
                                            {channel === 'push' && <Bell className="w-4 h-4" />}
                                            {channel === 'social' && <Share2 className="w-4 h-4" />}
                                            {channel} Content
                                        </h4>
                                        <button
                                            onClick={() => generateAIContent(channel)}
                                            disabled={aiLoading}
                                            className="text-xs flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-100 dark:hover:bg-purple-900/30 px-3 py-1.5 rounded-lg transition-colors"
                                        >
                                            {aiLoading ? <Sparkles className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                            AI Draft
                                        </button>
                                    </div>
                                    <textarea
                                        rows={channel === 'email' ? 6 : 3}
                                        placeholder={`Enter your ${channel} content here...`}
                                        value={(newCampaign.content as any)[channel]}
                                        onChange={e => setNewCampaign({ ...newCampaign, content: { ...newCampaign.content, [channel]: e.target.value } })}
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                                    />
                                </div>
                            ))}
                            {newCampaign.channels.length === 0 && (
                                <div className="text-center text-slate-500 py-10">No channels selected. Go back to step 3.</div>
                            )}
                        </div>
                    )}

                    {step === 5 && (
                        <div className="space-y-6 max-w-lg mx-auto">
                            <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{newCampaign.name}</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                                    Ready to send to <strong className="text-violet-600">{newCampaign.tags.length * 142} contacts</strong> via
                                    <strong className="uppercase ml-1">{newCampaign.channels.join(', ')}</strong>.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button type="button" className={`w-full p-4 border rounded-xl transition-all flex items-center justify-between text-left ${newCampaign.schedule === 'now' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => setNewCampaign({ ...newCampaign, schedule: 'now' })}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${newCampaign.schedule === 'now' ? 'bg-violet-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}><Send className="w-5 h-5" /></div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">Send Immediately</h4>
                                            <p className="text-xs text-slate-500">Launch campaign as soon as possible.</p>
                                        </div>
                                    </div>
                                    {newCampaign.schedule === 'now' && <Check className="w-5 h-5 text-violet-600" />}
                                </button>

                                <div
                                    role="button"
                                    tabIndex={0}
                                    className={`w-full p-4 border rounded-xl transition-all text-left ${newCampaign.schedule === 'later' ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20' : 'border-slate-200 dark:border-slate-700'}`}
                                    onClick={() => setNewCampaign({ ...newCampaign, schedule: 'later' })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setNewCampaign({ ...newCampaign, schedule: 'later' });
                                        }
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-full ${newCampaign.schedule === 'later' ? 'bg-violet-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}><Calendar className="w-5 h-5" /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200">Schedule for Later</h4>
                                                <p className="text-xs text-slate-500">Pick a future date and time.</p>
                                            </div>
                                        </div>
                                        {newCampaign.schedule === 'later' && <Check className="w-5 h-5 text-violet-600" />}
                                    </div>
                                    {newCampaign.schedule === 'later' && (
                                        <input
                                            type="datetime-local"
                                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                            value={newCampaign.scheduledDate}
                                            onChange={e => setNewCampaign({ ...newCampaign, scheduledDate: e.target.value })}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-[#111214] p-6 sm:flex-row sm:justify-between">
                    <button
                        onClick={() => setStep(Math.max(1, step - 1))}
                        disabled={step === 1}
                        className="rounded-lg border border-zinc-700 px-6 py-2.5 font-medium text-zinc-300 transition-colors hover:bg-white/[0.04] disabled:opacity-50"
                    >
                        Back
                    </button>
                    {step < 5 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="flex items-center gap-2 rounded-lg bg-violet-500 px-6 py-2.5 font-bold text-white transition-colors hover:bg-violet-400"
                        >
                            Next Step <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateCampaign}
                            className="flex items-center gap-2 rounded-lg bg-violet-500 px-8 py-2.5 font-bold text-white shadow-lg shadow-violet-500/20 transition-colors hover:bg-violet-400"
                        >
                            {newCampaign.schedule === 'now' ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            {newCampaign.schedule === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <div className="mb-6 flex flex-shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="mb-1 text-[11px] font-medium text-zinc-500">
                        Marketing Operations <span className="text-zinc-600">›</span> Campaigns
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Campaign Management</h2>
                    <p className="mt-1 text-sm text-zinc-500">Monitor, analyze, and automate your multi-channel outreach.</p>
                </div>
                {view === 'list' && (
                    <button
                        type="button"
                        onClick={() => setView('create')}
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400"
                    >
                        <Plus className="h-4 w-4" /> Create Campaign
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                {view === 'list' ? renderList() : renderWizard()}
            </div>
        </div>
    );
};
