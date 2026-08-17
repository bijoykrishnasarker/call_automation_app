'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Contact, Message } from '@/types';
import {
    Search, Phone, Video, Info, Send, Paperclip, Smile, Sparkles, Mail, Smartphone,
    Check, CheckCheck, Facebook, Instagram, MessageCircle, Inbox, SendHorizontal,
    FileText, Star, Trash2,
} from 'lucide-react';
import { suggestEmailDraft } from '@/services/geminiService';

interface ConversationsProps {
    contacts: Contact[];
    initialMessages: Message[];
}

type MailboxFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash';
type SmartTag = 'all' | 'crm' | 'vip' | 'urgent';

export const Conversations: React.FC<ConversationsProps> = ({ contacts, initialMessages }) => {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [activeChannel, setActiveChannel] = useState<'sms' | 'email' | 'facebook' | 'instagram' | 'whatsapp' | 'tiktok'>('sms');
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [threadSearch, setThreadSearch] = useState('');
    const [mailbox, setMailbox] = useState<MailboxFolder>('inbox');
    const [smartTag, setSmartTag] = useState<SmartTag>('all');
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const threads = contacts.map(contact => {
        const contactMessages = messages.filter(m => m.contactId === contact.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const lastMessage = contactMessages[0];
        const unreadCount = contactMessages.filter(m => !m.read && m.direction === 'inbound').length;
        return {
            contact,
            lastMessage,
            unreadCount
        };
    }).filter(t => t.lastMessage)
        .sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());

    const sentCount = threads.filter(t => t.lastMessage.direction === 'outbound').length;

    let folderThreads = threads;
    if (mailbox === 'sent') folderThreads = threads.filter(t => t.lastMessage.direction === 'outbound');
    if (mailbox === 'drafts' || mailbox === 'starred' || mailbox === 'trash') folderThreads = [];

    if (smartTag === 'crm') {
        folderThreads = folderThreads.filter(t =>
            t.contact.status.toLowerCase().includes('lead') || t.contact.tags?.some(tag => tag.toLowerCase().includes('lead'))
        );
    } else if (smartTag === 'vip') {
        folderThreads = folderThreads.filter(t => t.contact.tags?.some(tag => tag.toLowerCase().includes('vip')));
    } else if (smartTag === 'urgent') {
        folderThreads = folderThreads.filter(t => t.unreadCount > 0);
    }

    const searchedThreads = threadSearch.trim()
        ? folderThreads.filter(t => {
            const q = threadSearch.toLowerCase();
            const name = `${t.contact.firstName} ${t.contact.lastName}`.toLowerCase();
            return name.includes(q) || t.lastMessage.text.toLowerCase().includes(q);
        })
        : folderThreads;

    const filteredThreads = filter === 'all' ? searchedThreads : searchedThreads.filter(t => t.unreadCount > 0);
    const activeThread = threads.find(t => t.contact.id === selectedContactId);
    const activeMessages = messages.filter(m => m.contactId === selectedContactId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeMessages, selectedContactId]);

    useEffect(() => {
        if (activeThread?.lastMessage) {
            if (activeThread.lastMessage.direction === 'inbound') {
                setActiveChannel(activeThread.lastMessage.channel);
            }
        }
    }, [selectedContactId]);

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim() || !selectedContactId) return;

        const msg: Message = {
            id: Date.now().toString(),
            contactId: selectedContactId,
            text: newMessage,
            createdAt: new Date(),
            direction: 'outbound',
            channel: activeChannel,
            read: true
        };

        setMessages([...messages, msg]);
        setNewMessage('');
    };

    const handleSmartReply = async () => {
        if (!activeThread) return;
        setIsAiGenerating(true);
        const lastInbound = activeMessages.filter(m => m.direction === 'inbound').pop();
        const context = lastInbound ? `Reply to: "${lastInbound.text}"` : 'General follow up';

        const reply = await suggestEmailDraft(activeThread.contact.firstName, context);
        setNewMessage(reply);
        setIsAiGenerating(false);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        if (date.toDateString() === today.toDateString()) return formatTime(date);
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getChannelIcon = (channel: string, className = "w-3 h-3") => {
        switch (channel) {
            case 'sms': return <Smartphone className={className} />;
            case 'email': return <Mail className={className} />;
            case 'facebook': return <Facebook className={className} />;
            case 'instagram': return <Instagram className={className} />;
            case 'whatsapp': return <MessageCircle className={className} />;
            case 'tiktok': return <Video className={className} />;
            default: return <Smartphone className={className} />;
        }
    };

    const mailboxItems: { id: MailboxFolder; label: string; icon: typeof Inbox; count?: number }[] = [
        { id: 'inbox', label: 'Inbox', icon: Inbox, count: threads.length },
        { id: 'sent', label: 'Sent', icon: SendHorizontal, count: sentCount || undefined },
        { id: 'drafts', label: 'Drafts', icon: FileText },
        { id: 'starred', label: 'Starred', icon: Star },
        { id: 'trash', label: 'Trash', icon: Trash2 },
    ];

    const tagItems: { id: SmartTag; label: string; color: string }[] = [
        { id: 'crm', label: 'CRM Leads', color: 'bg-violet-400' },
        { id: 'vip', label: 'VIP Clients', color: 'bg-emerald-400' },
        { id: 'urgent', label: 'Urgent Follow-up', color: 'bg-red-400' },
    ];

    return (
        <div className="flex min-h-[70dvh] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0B0C0E] animate-fade-in lg:h-[calc(100dvh-10rem)]">
            {/* Mailbox & tags */}
            <aside className={`w-56 shrink-0 flex-col border-r border-white/[0.06] bg-[#0B0C0E] ${selectedContactId ? 'hidden lg:flex' : 'hidden md:flex'}`}>
                <div className="px-4 pt-5 pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Mailbox</p>
                </div>
                <nav className="space-y-0.5 px-2">
                    {mailboxItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = mailbox === item.id;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setMailbox(item.id);
                                    setSelectedContactId(null);
                                }}
                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                                    isActive
                                        ? 'bg-violet-500/10 text-violet-400'
                                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                                }`}
                            >
                                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                                <span className="flex-1 text-left">{item.label}</span>
                                {item.count !== undefined && item.count > 0 && (
                                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-violet-500/20 text-violet-300' : 'bg-zinc-800 text-zinc-400'}`}>
                                        {item.count}
                                    </span>
                                )}
                                {item.id === 'inbox' && (item.count === 0 || item.count === undefined) && (
                                    <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">0</span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="mt-6 px-4 pb-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Smart Tags</p>
                </div>
                <nav className="space-y-0.5 px-2">
                    {tagItems.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSmartTag(smartTag === item.id ? 'all' : item.id)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                                smartTag === item.id
                                    ? 'bg-white/[0.04] text-zinc-100'
                                    : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                            }`}
                        >
                            <span className={`h-2 w-2 rounded-full ${item.color}`} />
                            {item.label}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Conversation list */}
            <div className={`w-full md:w-80 shrink-0 flex-col border-r border-white/[0.06] bg-[#0B0C0E] ${selectedContactId ? 'hidden md:flex' : 'flex'}`}>
                <div className="border-b border-white/[0.06] p-4 space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={threadSearch}
                            onChange={(e) => setThreadSearch(e.target.value)}
                            placeholder="Search conversations..."
                            className="w-full rounded-xl border border-white/[0.08] bg-[#141416] py-2 pl-9 pr-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === 'all' ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('unread')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === 'unread' ? 'bg-violet-500/15 text-violet-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            Unread
                        </button>
                        <span className="ml-auto text-[11px] text-zinc-500">{filteredThreads.length} conversations</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredThreads.length === 0 ? (
                        <div className="flex h-full min-h-[240px] items-center justify-center px-6 text-center">
                            <p className="text-sm text-zinc-500">No conversations found.</p>
                        </div>
                    ) : (
                        filteredThreads.map(({ contact, lastMessage, unreadCount }) => (
                            <button
                                key={contact.id}
                                type="button"
                                onClick={() => setSelectedContactId(contact.id)}
                                className={`w-full border-b border-white/[0.06] p-4 text-left transition-colors hover:bg-white/[0.03] ${selectedContactId === contact.id ? 'bg-violet-500/10' : ''}`}
                            >
                                <div className="mb-1 flex items-start justify-between">
                                    <h4 className={`text-sm font-bold ${unreadCount > 0 ? 'text-white' : 'text-zinc-200'}`}>
                                        {contact.firstName} {contact.lastName}
                                    </h4>
                                    <span className="text-[10px] text-zinc-500">{formatDate(lastMessage.createdAt)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={`max-w-[180px] truncate text-xs ${unreadCount > 0 ? 'font-semibold text-zinc-200' : 'text-zinc-500'}`}>
                                        {lastMessage.direction === 'outbound' && <span className="mr-1 text-zinc-600">You:</span>}
                                        {lastMessage.text}
                                    </p>
                                    {unreadCount > 0 && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold text-white">
                                            {unreadCount}
                                        </span>
                                    )}
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Detail pane */}
            {activeThread ? (
                <div className={`flex-1 flex-col bg-[#0B0C0E] ${selectedContactId ? 'flex' : 'hidden md:flex'}`}>
                    <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-white/[0.06] bg-[#111214] p-4 sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedContactId(null)}
                                className="rounded-full p-2 text-zinc-400 hover:bg-white/[0.04] md:hidden"
                                aria-label="Back to conversations"
                            >
                                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                                    <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 font-bold text-violet-300">
                                {activeThread.contact.firstName[0]}
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate font-bold text-white">{activeThread.contact.firstName} {activeThread.contact.lastName}</h3>
                                <p className="truncate text-xs text-zinc-500">{activeThread.contact.phone} • {activeThread.contact.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button type="button" className="rounded-full p-2 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"><Phone className="h-4 w-4" /></button>
                            <button type="button" className="rounded-full p-2 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"><Video className="h-4 w-4" /></button>
                            <button type="button" className="rounded-full p-2 text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"><Info className="h-4 w-4" /></button>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto p-4">
                        {activeMessages.map((msg, index) => {
                            const showTime = index === 0 || (msg.createdAt.getTime() - activeMessages[index - 1].createdAt.getTime() > 30 * 60000);
                            return (
                                <div key={msg.id} className="animate-pop-in origin-bottom">
                                    {showTime && (
                                        <div className="my-4 flex justify-center">
                                            <span className="rounded-full bg-[#141416] px-2 py-1 text-[10px] font-medium text-zinc-500">
                                                {msg.createdAt.toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm ${
                                            msg.direction === 'outbound'
                                                ? 'rounded-br-sm bg-violet-600 text-white'
                                                : 'rounded-bl-sm border border-white/[0.08] bg-[#141416] text-zinc-200'
                                        }`}>
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
                                            <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70 ${msg.direction === 'outbound' ? 'text-violet-100' : 'text-zinc-500'}`}>
                                                {getChannelIcon(msg.channel, "w-3 h-3 mr-0.5")}
                                                {formatTime(msg.createdAt)}
                                                {msg.direction === 'outbound' && (
                                                    msg.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="flex-shrink-0 border-t border-white/[0.06] bg-[#111214] p-4">
                        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
                            {([
                                { id: 'sms' as const, label: 'SMS', icon: Smartphone },
                                { id: 'email' as const, label: 'Email', icon: Mail },
                                { id: 'instagram' as const, label: 'DM', icon: Instagram },
                                { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
                                { id: 'tiktok' as const, label: 'TikTok', icon: Video },
                            ]).map((ch) => (
                                <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => setActiveChannel(ch.id)}
                                    className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                                        activeChannel === ch.id
                                            ? 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/40'
                                            : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                                    }`}
                                >
                                    <ch.icon className="h-3 w-3" /> {ch.label}
                                </button>
                            ))}
                            <div className="flex-1" />
                            <button
                                type="button"
                                onClick={handleSmartReply}
                                disabled={isAiGenerating}
                                className="flex shrink-0 items-center gap-1 rounded-full bg-violet-500 px-3 py-1 text-xs font-bold text-white hover:bg-violet-400 disabled:opacity-50"
                            >
                                {isAiGenerating ? <Sparkles className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                AI Smart Reply
                            </button>
                        </div>
                        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                            <div className="relative flex-1">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={`Type a ${activeChannel.toUpperCase()} message...`}
                                    className="h-12 min-h-[48px] max-h-32 w-full resize-none rounded-xl border border-white/[0.08] bg-[#0B0C0E] p-3 pr-10 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-violet-500/20"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <div className="absolute bottom-2.5 right-2 flex gap-1">
                                    <button type="button" className="p-1 text-zinc-500 hover:text-zinc-300"><Paperclip className="h-4 w-4" /></button>
                                    <button type="button" className="p-1 text-zinc-500 hover:text-zinc-300"><Smile className="h-4 w-4" /></button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="rounded-xl bg-violet-500 p-3 text-white hover:bg-violet-400 disabled:opacity-50"
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="hidden flex-1 flex-col items-center justify-center bg-[#0B0C0E] md:flex">
                    <p className="text-sm text-zinc-500">Select a contact to view the conversation.</p>
                </div>
            )}
        </div>
    );
};
