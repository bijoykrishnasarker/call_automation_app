'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Contact, Message } from '@/types';
import { Search, Phone, Video, Info, Send, Paperclip, Smile, Sparkles, Mail, Smartphone, Check, CheckCheck, Facebook, Instagram, MessageCircle } from 'lucide-react';
import { suggestEmailDraft } from '@/services/geminiService';

interface ConversationsProps {
    contacts: Contact[];
    initialMessages: Message[];
}

export const Conversations: React.FC<ConversationsProps> = ({ contacts, initialMessages }) => {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [activeChannel, setActiveChannel] = useState<'sms' | 'email' | 'facebook' | 'instagram' | 'whatsapp' | 'tiktok'>('sms');
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Derive Thread Data
    const threads = contacts.map(contact => {
        const contactMessages = messages.filter(m => m.contactId === contact.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const lastMessage = contactMessages[0];
        const unreadCount = contactMessages.filter(m => !m.read && m.direction === 'inbound').length;
        return {
            contact,
            lastMessage,
            unreadCount
        };
    }).filter(t => t.lastMessage) // Only show contacts with messages
        .sort((a, b) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());

    const filteredThreads = filter === 'all' ? threads : threads.filter(t => t.unreadCount > 0);
    const activeThread = threads.find(t => t.contact.id === selectedContactId);
    const activeMessages = messages.filter(m => m.contactId === selectedContactId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeMessages, selectedContactId]);

    // Set default channel when thread changes
    useEffect(() => {
        if (activeThread?.lastMessage) {
            // If the last message was inbound, reply on that channel by default
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
        // Use the last inbound message as context
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

    const getChannelColor = (channel: string) => {
        switch (channel) {
            case 'sms': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900';
            case 'email': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900';
            case 'facebook': return 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
            case 'instagram': return 'text-pink-600 bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800';
            case 'whatsapp': return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
            case 'tiktok': return 'text-slate-900 bg-slate-100 dark:bg-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700';
            default: return 'text-slate-600 bg-slate-50 dark:bg-slate-900/50 border-slate-200';
        }
    };

    return (
        <div className="flex min-h-[70dvh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-fade-in lg:h-[calc(100dvh-10rem)] dark:border-slate-800 dark:bg-slate-900">
            {/* Sidebar List */}
            <div className={`w-full md:w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 ${selectedContactId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-4">
                        <button
                            onClick={() => setFilter('all')}
                            className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${filter === 'all' ? 'border-lime-500 text-slate-800 dark:text-slate-100' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
                        >
                            All Messages
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${filter === 'unread' ? 'border-lime-500 text-slate-800 dark:text-slate-100' : 'border-transparent text-slate-500 dark:text-slate-400'}`}
                        >
                            Unread
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lime-500 transition-shadow"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredThreads.map(({ contact, lastMessage, unreadCount }) => (
                        <button
                            key={contact.id}
                            type="button"
                            onClick={() => setSelectedContactId(contact.id)}
                            className={`w-full p-4 text-left border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedContactId === contact.id ? 'bg-lime-50 dark:bg-lime-900/10' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h4 className={`text-sm font-bold ${unreadCount > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {contact.firstName} {contact.lastName}
                                </h4>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(lastMessage.createdAt)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className={`text-xs truncate max-w-[180px] ${unreadCount > 0 ? 'font-semibold text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {lastMessage.direction === 'outbound' && <span className="text-slate-400 mr-1">You:</span>}
                                    {lastMessage.text}
                                </p>
                                {unreadCount > 0 && (
                                    <span className="w-5 h-5 bg-lime-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce-sm">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${getChannelColor(lastMessage.channel)}`}>
                                    {getChannelIcon(lastMessage.channel)}
                                    {lastMessage.channel.toUpperCase()}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            {activeThread ? (
                <div className={`flex-1 flex-col h-full bg-slate-50 dark:bg-slate-950/50 ${selectedContactId ? 'flex' : 'hidden md:flex'}`}>
                    {/* Header */}
                    <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSelectedContactId(null)}
                                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
                                aria-label="Back to conversations"
                            >
                                <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                                    <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold animate-pop-in">
                                {activeThread.contact.firstName[0]}
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate font-bold text-slate-800 dark:text-slate-100">{activeThread.contact.firstName} {activeThread.contact.lastName}</h3>
                                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{activeThread.contact.phone} • {activeThread.contact.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-95">
                                <Phone className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-95">
                                <Video className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors active:scale-95">
                                <Info className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {activeMessages.map((msg, index) => {
                            const showTime = index === 0 || (msg.createdAt.getTime() - activeMessages[index - 1].createdAt.getTime() > 30 * 60000);
                            return (
                                <div key={msg.id} className="animate-pop-in origin-bottom">
                                    {showTime && (
                                        <div className="flex justify-center my-4">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                                                {msg.createdAt.toLocaleDateString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm relative group transition-transform hover:scale-[1.01]
                                        ${msg.direction === 'outbound'
                                                ? 'bg-lime-600 text-white rounded-br-sm'
                                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-sm'
                                            }`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                            <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 opacity-70 ${msg.direction === 'outbound' ? 'text-lime-100' : 'text-slate-400'}`}>
                                                {getChannelIcon(msg.channel, "w-3 h-3 mr-0.5")}
                                                {formatTime(msg.createdAt)}
                                                {msg.direction === 'outbound' && (
                                                    msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Composer */}
                    <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                            <button
                                onClick={() => setActiveChannel('sms')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1 flex-shrink-0 ${activeChannel === 'sms' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Smartphone className="w-3 h-3" /> SMS
                            </button>
                            <button
                                onClick={() => setActiveChannel('email')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1 flex-shrink-0 ${activeChannel === 'email' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Mail className="w-3 h-3" /> Email
                            </button>
                            <button
                                onClick={() => setActiveChannel('instagram')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1 flex-shrink-0 ${activeChannel === 'instagram' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 ring-1 ring-pink-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Instagram className="w-3 h-3" /> DM
                            </button>
                            <button
                                onClick={() => setActiveChannel('whatsapp')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1 flex-shrink-0 ${activeChannel === 'whatsapp' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-1 ring-green-500' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                            </button>
                            <button
                                onClick={() => setActiveChannel('tiktok')}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1 flex-shrink-0 ${activeChannel === 'tiktok' ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ring-1 ring-slate-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                <Video className="w-3 h-3" /> TikTok
                            </button>

                            <div className="flex-1"></div>
                            <button
                                onClick={handleSmartReply}
                                disabled={isAiGenerating}
                                className="px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full text-xs font-bold hover:shadow-md transition-all flex items-center gap-1 disabled:opacity-50 active:scale-95 flex-shrink-0"
                            >
                                {isAiGenerating ? <Sparkles className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                AI Smart Reply
                            </button>
                        </div>
                        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                            <div className="flex-1 relative">
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder={`Type a ${activeChannel.toUpperCase()} message...`}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 pr-10 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none h-12 min-h-[48px] max-h-32 transition-shadow"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSendMessage();
                                        }
                                    }}
                                />
                                <div className="absolute right-2 bottom-2.5 flex gap-1">
                                    <button type="button" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors active:scale-90">
                                        <Paperclip className="w-4 h-4" />
                                    </button>
                                    <button type="button" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors active:scale-90">
                                        <Smile className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="p-3 bg-lime-600 text-white rounded-xl hover:bg-lime-700 disabled:opacity-50 disabled:hover:bg-lime-600 transition-all shadow-sm active:scale-90 hover:shadow-md"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-slate-50 dark:bg-slate-950/50 text-slate-400 dark:text-slate-500">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 animate-bounce-sm">
                        <Mail className="w-8 h-8 opacity-50" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300">Select a conversation</h3>
                    <p className="text-sm">Choose a contact from the list to start chatting.</p>
                </div>
            )}
        </div>
    );
};
