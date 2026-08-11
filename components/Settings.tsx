'use client';

import React, { useState } from 'react';
import { Code, Globe, Users, CreditCard, Copy, Check, Facebook, Instagram, MessageCircle, Twitter, Linkedin, Video } from 'lucide-react';

export const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState('embeds');
    const [copied, setCopied] = useState('');
    const [connectedApps, setConnectedApps] = useState<Record<string, boolean>>({
        'Google Calendar': true,
        'Stripe': true
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
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Settings & Configuration</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your account, integrations, and website widgets.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
                {/* Settings Sidebar */}
                <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-2">
                    <nav className="space-y-1">
                        <button onClick={() => setActiveTab('embeds')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'embeds' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <Code className="w-4 h-4" /> Embeds & Widgets
                        </button>
                        <button onClick={() => setActiveTab('integrations')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'integrations' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <Globe className="w-4 h-4" /> Integrations
                        </button>
                        <button onClick={() => setActiveTab('team')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'team' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <Users className="w-4 h-4" /> Team Members
                        </button>
                        <button onClick={() => setActiveTab('billing')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'billing' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            <CreditCard className="w-4 h-4" /> Plan & Billing
                        </button>
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 p-5 sm:p-8 min-w-0">
                    {activeTab === 'embeds' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Website Widgets</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Copy these snippets to your website (WordPress, Webflow, Shopify) to enable LeadOps features.</p>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">AI Chat & Lead Capture Widget</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Adds the bottom-right chat bubble to your site.</p>
                                    </div>
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">Active</span>
                                </div>
                                <div className="relative">
                                    <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                                        {CHAT_WIDGET_CODE}
                                    </pre>
                                    <button
                                        onClick={() => handleCopy(CHAT_WIDGET_CODE, 'chat')}
                                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                    >
                                        {copied === 'chat' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Booking Calendar Embed</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Inline iframe for your "Book Now" page.</p>
                                    </div>
                                </div>
                                <div className="relative">
                                    <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                                        {BOOKING_WIDGET_CODE}
                                    </pre>
                                    <button
                                        onClick={() => handleCopy(BOOKING_WIDGET_CODE, 'booking')}
                                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                                    >
                                        {copied === 'booking' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'integrations' && (
                        <div className="space-y-8 animate-fade-in">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Social Channels</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Connect your accounts to unify messages into the inbox.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {[
                                    { name: 'Facebook Page', icon: Facebook, color: 'text-blue-600', desc: 'Sync Messenger & Comments' },
                                    { name: 'Instagram Business', icon: Instagram, color: 'text-pink-600', desc: 'Sync DMs & Story Replies' },
                                    { name: 'WhatsApp Business', icon: MessageCircle, color: 'text-green-500', desc: 'Official API Connection' },
                                    { name: 'TikTok Business', icon: Video, color: 'text-black dark:text-white', desc: 'Sync Comments & Direct Messages' }
                                ].map((app) => (
                                    <div key={app.name} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm transition-all hover:shadow-md">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 ${app.color}`}>
                                                <app.icon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100">{app.name}</h4>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{app.desc}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleConnection(app.name)}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${connectedApps[app.name]
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 hover:opacity-90'}`}
                                        >
                                            {connectedApps[app.name] ? 'Connected' : 'Connect'}
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Business Tools</h3>
                                <div className="space-y-4">
                                    {['Google Calendar', 'Stripe', 'Slack'].map(app => (
                                        <div key={app} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-slate-500">
                                                    {app[0]}
                                                </div>
                                                <span className="font-medium text-slate-700 dark:text-slate-200">{app}</span>
                                            </div>
                                            <button
                                                onClick={() => toggleConnection(app)}
                                                className={`px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${connectedApps[app]
                                                    ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-900/10 dark:text-green-400'
                                                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                {connectedApps[app] ? 'Connected' : 'Configure'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Team Members</h3>
                                <button className="px-3 py-1.5 bg-lime-600 text-white rounded-lg text-sm font-medium hover:bg-lime-700">Invite Member</button>
                            </div>
                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 md:hidden">
                                    {[
                                        { name: 'Dr. Smith (You)', role: 'Owner', status: 'Active' },
                                        { name: 'Sarah Reception', role: 'Admin', status: 'Active' },
                                    ].map((member) => (
                                        <div key={member.name} className="p-4">
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{member.name}</div>
                                            <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{member.role}</div>
                                            <span className="mt-3 inline-flex rounded px-2 py-0.5 text-xs bg-green-100 text-green-700">{member.status}</span>
                                        </div>
                                    ))}
                                </div>
                                <table className="hidden w-full text-sm text-left md:table">
                                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3 text-slate-500 dark:text-slate-400">Name</th>
                                            <th className="px-4 py-3 text-slate-500 dark:text-slate-400">Role</th>
                                            <th className="px-4 py-3 text-slate-500 dark:text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">Dr. Smith (You)</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Owner</td>
                                            <td className="px-4 py-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Active</span></td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">Sarah Reception</td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">Admin</td>
                                            <td className="px-4 py-3"><span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Active</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'billing' && (
                        <div className="animate-fade-in">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Current Plan: Pro</h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6">$249/month • Renews on Nov 1, 2026</p>
                            <button className="text-lime-600 font-medium hover:underline text-sm">Manage Subscription in Stripe</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
