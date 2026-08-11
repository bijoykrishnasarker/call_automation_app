'use client';

import React, { useState } from 'react';
import { Campaign, CampaignChannel } from '@/types';
import { Megaphone, Plus, Mail, Smartphone, Bell, Share2, Calendar, Users, BarChart3, ChevronRight, Check, X, Sparkles, Send, Clock, Edit2 } from 'lucide-react';
import { suggestEmailDraft } from '@/services/geminiService';

const MOCK_CAMPAIGNS: Campaign[] = [
    {
        id: '1',
        name: 'Summer Sale Blast',
        status: 'Completed',
        channels: ['email', 'sms'],
        audienceTags: ['VIP', 'Past Customers'],
        scheduledDate: new Date(Date.now() - 86400000 * 5),
        stats: { sent: 1200, delivered: 1180, opened: 850, clicked: 320 }
    },
    {
        id: '2',
        name: 'Weekly Newsletter',
        status: 'Scheduled',
        channels: ['email'],
        audienceTags: ['Newsletter'],
        scheduledDate: new Date(Date.now() + 86400000),
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
    },
    {
        id: '3',
        name: 'Flash Deal Alert',
        status: 'Draft',
        channels: ['sms', 'push'],
        audienceTags: ['Mobile App Users'],
        stats: { sent: 0, delivered: 0, opened: 0, clicked: 0 }
    }
];

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

    const renderList = () => (
        <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Send className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">12.5k</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Messages Sent</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-4 rounded-full bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">42%</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Open Rate</p>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                    <div className="p-4 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                        <BarChart3 className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100">8.4%</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Click Rate</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                    {campaigns.map(c => (
                        <div key={c.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {c.scheduledDate ? c.scheduledDate.toLocaleDateString() : 'Unscheduled'}
                                    </div>
                                </div>
                                <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${c.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : c.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : c.status === 'Sending' ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400 animate-pulse' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                    {c.status}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {c.channels.includes('email') && <Mail className="w-4 h-4 text-amber-500" />}
                                {c.channels.includes('sms') && <Smartphone className="w-4 h-4 text-blue-500" />}
                                {c.channels.includes('push') && <Bell className="w-4 h-4 text-purple-500" />}
                                {c.channels.includes('social') && <Share2 className="w-4 h-4 text-pink-500" />}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {c.audienceTags.map(tag => (
                                    <span key={tag} className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">{tag}</span>
                                ))}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                {c.status === 'Completed' ? <><span className="font-bold text-slate-900 dark:text-slate-200">{c.stats.opened}</span> Opens</> : 'No stats yet'}
                            </div>
                        </div>
                    ))}
                </div>

                <table className="hidden w-full text-sm text-left md:table">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Campaign Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Channels</th>
                            <th className="px-6 py-4">Audience</th>
                            <th className="px-6 py-4 text-right">Stats</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {campaigns.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800 dark:text-slate-100">{c.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {c.scheduledDate ? c.scheduledDate.toLocaleDateString() : 'Unscheduled'}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                        ${c.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            c.status === 'Scheduled' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                c.status === 'Sending' ? 'bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-400 animate-pulse' :
                                                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                        {c.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                        {c.channels.includes('email') && <Mail className="w-4 h-4 text-amber-500" />}
                                        {c.channels.includes('sms') && <Smartphone className="w-4 h-4 text-blue-500" />}
                                        {c.channels.includes('push') && <Bell className="w-4 h-4 text-purple-500" />}
                                        {c.channels.includes('social') && <Share2 className="w-4 h-4 text-pink-500" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex gap-1 flex-wrap">
                                        {c.audienceTags.map(tag => (
                                            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">{tag}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {c.status === 'Completed' ? (
                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                            <span className="font-bold text-slate-900 dark:text-slate-200">{c.stats.opened}</span> Opens
                                        </div>
                                    ) : (
                                        <span className="text-xs text-slate-400">-</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const renderWizard = () => (
        <div className="max-w-4xl mx-auto animate-slide-in-right">
            {/* Wizard Steps */}
            <div className="mb-8 relative overflow-x-auto pb-2">
                <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 dark:bg-slate-800 -z-10" />
                <div className="flex min-w-max items-center justify-between gap-6">
                    {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= s ? 'bg-lime-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        {step === 1 && "Campaign Details"}
                        {step === 2 && "Select Audience"}
                        {step === 3 && "Choose Channels"}
                        {step === 4 && "Design Content"}
                        {step === 5 && "Review & Schedule"}
                    </h3>
                    <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-8">
                    {step === 1 && (
                        <div className="space-y-6 max-w-lg mx-auto">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Campaign Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Summer Sale 2026"
                                    value={newCampaign.name}
                                    onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Campaign Goal</label>
                                <select className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-lime-500 focus:outline-none">
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
                                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${newCampaign.tags.includes(tag) ? 'bg-lime-100 border-lime-500 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-lime-300'}`}
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
                                        className={`p-6 rounded-xl border-2 text-left transition-all group ${isSelected ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-lime-300 bg-slate-50 dark:bg-slate-800'}`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${isSelected ? 'bg-lime-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-400 group-hover:text-lime-500'}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <h4 className={`font-bold ${isSelected ? 'text-lime-900 dark:text-lime-300' : 'text-slate-700 dark:text-slate-200'}`}>{c.label}</h4>
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
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-lime-500 focus:outline-none resize-none"
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
                                    Ready to send to <strong className="text-lime-600">{newCampaign.tags.length * 142} contacts</strong> via
                                    <strong className="uppercase ml-1">{newCampaign.channels.join(', ')}</strong>.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button type="button" className={`w-full p-4 border rounded-xl transition-all flex items-center justify-between text-left ${newCampaign.schedule === 'now' ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20' : 'border-slate-200 dark:border-slate-700'}`} onClick={() => setNewCampaign({ ...newCampaign, schedule: 'now' })}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${newCampaign.schedule === 'now' ? 'bg-lime-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}><Send className="w-5 h-5" /></div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 dark:text-slate-200">Send Immediately</h4>
                                            <p className="text-xs text-slate-500">Launch campaign as soon as possible.</p>
                                        </div>
                                    </div>
                                    {newCampaign.schedule === 'now' && <Check className="w-5 h-5 text-lime-600" />}
                                </button>

                                <div
                                    role="button"
                                    tabIndex={0}
                                    className={`w-full p-4 border rounded-xl transition-all text-left ${newCampaign.schedule === 'later' ? 'border-lime-500 bg-lime-50 dark:bg-lime-900/20' : 'border-slate-200 dark:border-slate-700'}`}
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
                                            <div className={`p-2 rounded-full ${newCampaign.schedule === 'later' ? 'bg-lime-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}><Calendar className="w-5 h-5" /></div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-200">Schedule for Later</h4>
                                                <p className="text-xs text-slate-500">Pick a future date and time.</p>
                                            </div>
                                        </div>
                                        {newCampaign.schedule === 'later' && <Check className="w-5 h-5 text-lime-600" />}
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

                <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:justify-between">
                    <button
                        onClick={() => setStep(Math.max(1, step - 1))}
                        disabled={step === 1}
                        className="px-6 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                        Back
                    </button>
                    {step < 5 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            className="px-6 py-2.5 bg-slate-800 dark:bg-white text-white dark:text-slate-900 rounded-lg font-bold hover:opacity-90 transition-colors flex items-center gap-2"
                        >
                            Next Step <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleCreateCampaign}
                            className="px-8 py-2.5 bg-lime-600 text-white rounded-lg font-bold hover:bg-lime-700 transition-colors shadow-lg shadow-lime-600/20 flex items-center gap-2"
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
            <div className="flex justify-between items-center mb-6 flex-shrink-0 px-2">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Multi-Channel Campaigns</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Orchestrate marketing across Email, SMS, Push & Social.</p>
                </div>
                {view === 'list' && (
                    <button
                        onClick={() => setView('create')}
                        className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-medium hover:bg-lime-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Create Campaign
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
                {view === 'list' ? renderList() : renderWizard()}
            </div>
        </div>
    );
};
