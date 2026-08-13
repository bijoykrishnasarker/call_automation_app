'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Mic, MessageSquare, Save, Play, Upload, FileText, CheckCircle, Smartphone, Star, Zap, Volume2, Clock, Trash2, Sliders, Square, Loader2 } from 'lucide-react';
import Vapi from '@vapi-ai/web';
import { AIReviewConfig, AIChatConfig } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { fetchAiReceptionistSettings } from '@/lib/api/ai-receptionist-settings';

interface ReceptionistFormData {
    isEnabled: boolean;
    agentName: string;
    voiceModel: string;
    voiceSpeed: number;

    businessName: string;
    businessType: string;
    businessAddress: string;
    businessHours: string;

    services: string[];
    additionalInfo: string;

    greetingMessage: string;

    answerQuestions: boolean;
    bookAppointments: boolean;
    takeMessages: boolean;
    transferEnabled: boolean;
    transferNumber: string;

    afterHoursOnly: boolean;

    phoneNumber: string;

    newServiceName: string;
    captureName: boolean;
    capturePhone: boolean;
    captureEmail: boolean;
    requireEmailConfirmation: boolean;
    saveIncompleteAsReview: boolean;
}

const FORM_DEFAULTS: ReceptionistFormData = {
    isEnabled: true,
    agentName: 'Sarah',
    voiceModel: 'sarah',
    voiceSpeed: 1.0,

    businessName: 'LeadOps AI Services',
    businessType: 'Consulting & Services',
    businessAddress: '123 Main Street',
    businessHours: '09:00 AM – 06:00 PM',

    services: ['Consultation', 'Service Call', 'Checkup'],
    additionalInfo: 'Polite, professional receptionist. Answers questions and books appointments for clients.',

    greetingMessage: 'Hello! Thank you for calling. How can I assist you today?',

    answerQuestions: true,
    bookAppointments: true,
    takeMessages: true,
    transferEnabled: false,
    transferNumber: '',

    afterHoursOnly: false,

    phoneNumber: '',

    newServiceName: '',
    captureName: true,
    capturePhone: true,
    captureEmail: true,
    requireEmailConfirmation: true,
    saveIncompleteAsReview: true,
};

// Map form voiceModel values to Vapi Web SDK voiceId (must match Vapi's allowed list).
const WEB_VOICE_MAP: Record<string, string> = {
    sarah: 'Emma',
    mike: 'Elliot',
    emma: 'Emma',
};

// 30-minute time options in 12-hour format with leading zeros (e.g. "09:00 AM").
const TIME_OPTIONS: string[] = (() => {
    const times: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (const m of [0, 30]) {
            const hour12 = h % 12 === 0 ? 12 : h % 12;
            const period = h < 12 ? 'AM' : 'PM';
            times.push(`${String(hour12).padStart(2, '0')}:${m === 0 ? '00' : '30'} ${period}`);
        }
    }
    return times;
})();

export const AICenter: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'voice' | 'chat' | 'reviews' | 'knowledge'>('voice');

    // Voice tab: receptionist creation form state
    const [formData, setFormData] = useState<ReceptionistFormData>(FORM_DEFAULTS);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isSyncingAssistant, setIsSyncingAssistant] = useState(false);
    const [isProvisioningPhone, setIsProvisioningPhone] = useState(false);
    const [isLinkingAssistantToPhone, setIsLinkingAssistantToPhone] = useState(false);
    const [calls, setCalls] = useState<any[]>([]);

    // Simulated State for Reviews AI
    const [reviewConfig, setReviewConfig] = useState<AIReviewConfig>({
        enabled: false,
        autoReply5Star: true,
        autoReply4Star: false,
        delayHours: 2
    });

    // Simulated State for Chat AI
    const [chatConfig, setChatConfig] = useState<AIChatConfig>({
        enabled: true,
        tone: 'Friendly',
        knowledgeBaseFiles: ['Pricing_2026.pdf', 'Service_Menu.docx']
    });

    const [isTestingVoice, setIsTestingVoice] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [vapiAssistantId, setVapiAssistantId] = useState<string | null>(null);
    const vapiRef = useRef<InstanceType<typeof Vapi> | null>(null);

    // Load voice settings on mount
    useEffect(() => {
        let cancelled = false;
        setError(null);
        setIsLoadingInitial(true);

        // Safety fallback: Never keep the user waiting more than 2.5s on "Loading configuration..."
        const safetyTimer = setTimeout(() => {
            if (!cancelled) {
                setIsLoadingInitial(false);
            }
        }, 2500);

        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) {
                    if (!cancelled) {
                        setFormData(FORM_DEFAULTS);
                    }
                    return;
                }
                const { settings, connected_phone_number, vapi_assistant_id } = await fetchAiReceptionistSettings(session.access_token);
                if (!cancelled) {
                    setVapiAssistantId(vapi_assistant_id);
                    if (settings === null) {
                        setFormData(FORM_DEFAULTS);
                    } else {
                        setFormData({
                            ...FORM_DEFAULTS,
                            isEnabled: settings.is_enabled,
                            agentName: settings.agent_name,
                            voiceModel: settings.voice,
                            voiceSpeed: settings.speed,
                            transferNumber: settings.live_transfer_number ?? '',
                            afterHoursOnly: settings.answer_after_hours_only ?? false,
                            businessName: settings.business_name ?? '',
                            businessType: settings.business_type ?? '',
                            businessAddress: settings.business_address ?? '',
                            businessHours: settings.business_hours ?? '',
                            answerQuestions: settings.can_answer_questions ?? true,
                            takeMessages: settings.can_take_messages ?? true,
                            bookAppointments: settings.can_book_appointments ?? true,
                            transferEnabled: settings.transfer_urgent_calls ?? false,
                            services: Array.isArray(settings.services) ? settings.services : [],
                            additionalInfo: settings.additional_business_info ?? '',
                            greetingMessage: settings.greeting_message ?? '',
                            phoneNumber: connected_phone_number ?? '',
                            captureName: true,
                            capturePhone: true,
                            captureEmail: true,
                            requireEmailConfirmation: true,
                            saveIncompleteAsReview: true,
                        });
                    }
                }
            } catch (e) {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load settings');
            } finally {
                clearTimeout(safetyTimer);
                if (!cancelled) setIsLoadingInitial(false);
            }
        })();

        return () => {
            cancelled = true;
            clearTimeout(safetyTimer);
        };
    }, []);

    // Initialize Vapi Web SDK once (client-side only) and wire call state to UI.
    useEffect(() => {
        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
        if (!publicKey || typeof window === 'undefined') return;

        const vapi = new Vapi(publicKey);
        vapiRef.current = vapi;

        const onStart = () => {
            setError(null);
            setIsTestingVoice(true);
        };
        const onEnd = () => setIsTestingVoice(false);
        const onError = (err: any) => {
            console.error('Vapi Web SDK Error:', err);
            const msg = err?.message || err?.error || 'Vapi voice connection failed. Please check microphone permissions or try again.';
            setError(`Vapi Error: ${msg}`);
            setIsTestingVoice(false);
        };

        vapi.on('call-start', onStart);
        vapi.on('call-end', onEnd);
        vapi.on('error', onError);

        return () => {
            vapi.removeListener('call-start', onStart);
            vapi.removeListener('call-end', onEnd);
            vapi.removeListener('error', onError);
            vapiRef.current = null;
        };
    }, []);

    /** Persist receptionist row to Supabase, then full Vapi assistant sync (same pipeline as Save). */
    const persistReceptionistAndVapi = useCallback(async (accessToken: string): Promise<string> => {
        const settingsRes = await fetch('/api/ai-receptionist/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                is_enabled: formData.isEnabled,
                agent_name: formData.agentName,
                voice: formData.voiceModel,
                speed: formData.voiceSpeed,
                live_transfer_number: formData.transferNumber,
                answer_after_hours_only: formData.afterHoursOnly,
                business_name: formData.businessName,
                business_type: formData.businessType,
                business_address: formData.businessAddress,
                business_hours: formData.businessHours,
                can_answer_questions: formData.answerQuestions,
                can_take_messages: formData.takeMessages,
                can_book_appointments: formData.bookAppointments,
                transfer_urgent_calls: formData.transferEnabled,
                services: formData.services,
                additional_business_info: formData.additionalInfo,
                greeting_message: formData.greetingMessage,
            }),
        });
        const settingsData = await settingsRes.json().catch(() => ({}));
        if (!settingsRes.ok) {
            const msg = (settingsData as { message?: string }).message ?? 'Failed to save settings';
            throw new Error(msg);
        }

        let vapiMessage = 'Settings saved.';
        try {
            const vapiRes = await fetch('/api/vapi/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    agentName: formData.agentName,
                    voiceModel: formData.voiceModel,
                    voiceSpeed: formData.voiceSpeed,
                    businessName: formData.businessName,
                    businessType: formData.businessType,
                    businessAddress: formData.businessAddress,
                    businessHours: formData.businessHours,
                    services: formData.services,
                    additionalInfo: formData.additionalInfo,
                    greetingMessage: formData.greetingMessage,
                    answerQuestions: formData.answerQuestions,
                    bookAppointments: formData.bookAppointments,
                    takeMessages: formData.takeMessages,
                    transferEnabled: formData.transferEnabled,
                    transferNumber: formData.transferNumber,
                    afterHoursOnly: formData.afterHoursOnly,
                    phoneNumber: formData.phoneNumber,
                }),
            });
            const vapiData = await vapiRes.json().catch(() => ({}));
            if (vapiRes.ok) {
                vapiMessage = (vapiData as { message?: string }).message ?? 'Settings saved and synced with Vapi.';
                try {
                    const fresh = await fetchAiReceptionistSettings(accessToken);
                    setVapiAssistantId(fresh.vapi_assistant_id);
                } catch (e) {
                    console.warn('Failed to reload fresh settings:', e);
                }
            } else {
                const vapiErr = (vapiData as { message?: string }).message ?? 'sync failed';
                vapiMessage = `Settings saved. Vapi sync warning: ${vapiErr}`;
            }
        } catch {
            vapiMessage = 'Settings saved. Vapi sync could not be reached.';
        }
        return vapiMessage;
    }, [formData]);

    const handleSave = useCallback(async () => {
        setError(null);
        setSuccessMessage(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError('Authentication required');
            return;
        }
        setIsSaving(true);
        try {
            const vapiMessage = await persistReceptionistAndVapi(session.access_token);
            setSuccessMessage(vapiMessage);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    }, [persistReceptionistAndVapi]);

    const loadRecentCalls = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        try {
            const res = await fetch('/api/calls', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && Array.isArray((data as any).calls)) {
                setCalls((data as any).calls);
            }
        } catch {
            // silently ignore for now
        }
    }, []);

    useEffect(() => {
        // Load initial call activity; ignore errors in UI.
        loadRecentCalls();
    }, [loadRecentCalls]);

    /** Same as Save: writes Supabase first, then `/api/vapi/sync` (full prompt + MCP). Avoids `/api/vapi/assistants/sync`, which requires an existing row and omits services/greeting. */
    const handleSyncAssistant = useCallback(async () => {
        setError(null);
        setSuccessMessage(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError('Authentication required');
            return;
        }
        setIsSyncingAssistant(true);
        try {
            const vapiMessage = await persistReceptionistAndVapi(session.access_token);
            setSuccessMessage(vapiMessage);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to sync assistant');
        } finally {
            setIsSyncingAssistant(false);
        }
    }, [persistReceptionistAndVapi]);

    const handleProvisionPhone = useCallback(async () => {
        setError(null);
        setSuccessMessage(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError('Authentication required');
            return;
        }
        setIsProvisioningPhone(true);
        try {
            const res = await fetch('/api/vapi/phone/provision', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                // If org already has a number (409), just adopt it in the UI
                if (res.status === 409 && (data as any).phoneNumber) {
                    setFormData((prev) => ({
                        ...prev,
                        phoneNumber: (data as any).phoneNumber,
                    }));
                    setSuccessMessage('Your phone number is already active.');
                    setTimeout(() => setSuccessMessage(null), 3000);
                } else {
                    // Sanitize: never expose external dashboard URLs to SaaS clients
                    let msg = (data as { message?: string }).message ?? 'Failed to provision phone number';
                    msg = msg.replace(/https?:\/\/[^\s]+/g, '').trim();
                    setError(msg || 'Phone number provisioning is temporarily unavailable. Please contact support.');
                }
            } else {
                const provisionedNumber =
                    (data as any).phoneNumber ??
                    (data as any).number ??
                    (data as any).phone_number ??
                    '';
                if (provisionedNumber) {
                    setFormData((prev) => ({
                        ...prev,
                        phoneNumber: provisionedNumber,
                    }));
                }
                const warn = (data as { warning?: string; linkError?: string }).warning;
                const linkErr = (data as { linkError?: string }).linkError;
                if (warn) {
                    setError(
                        `${warn}${linkErr ? ` Technical detail: ${linkErr}` : ''} You can try “Link assistant to number” after Save / Sync with Vapi.`
                    );
                } else {
                    setSuccessMessage(
                        (data as { note?: string }).note
                            ? `Phone number ready. ${(data as { note?: string }).note} Set up call forwarding with your carrier.`
                            : 'Phone number provisioned successfully! Set up call forwarding to activate your AI receptionist.'
                    );
                    setTimeout(() => setSuccessMessage(null), 5000);
                }
            }
        } catch (e) {
            setError('Something went wrong. Please try again or contact support.');
        } finally {
            setIsProvisioningPhone(false);
        }
    }, []);

    const handleLinkAssistantToPhone = useCallback(async () => {
        setError(null);
        setSuccessMessage(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            setError('Authentication required');
            return;
        }
        setIsLinkingAssistantToPhone(true);
        try {
            const res = await fetch('/api/vapi/phone/link-assistant', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError((data as { message?: string }).message ?? 'Failed to link assistant to phone number');
            } else {
                setSuccessMessage((data as { message?: string }).message ?? 'Phone number linked to your assistant.');
                setTimeout(() => setSuccessMessage(null), 5000);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to link assistant');
        } finally {
            setIsLinkingAssistantToPhone(false);
        }
    }, []);

    const handleTestVoice = useCallback(() => {
        if (isLoadingInitial || isSaving) return;
        setError(null);
        setSuccessMessage(null);

        const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
        if (!publicKey) {
            setError('Vapi public key is not configured. Add NEXT_PUBLIC_VAPI_PUBLIC_KEY to .env.local.');
            return;
        }

        const vapi = vapiRef.current;
        if (!vapi) {
            setError('Voice test is not ready yet. Refresh the page and try again.');
            return;
        }

        if (isTestingVoice) {
            vapi.stop();
            return;
        }

        if (!vapiAssistantId) {
            setError("Please click 'Sync with Vapi' first to create and configure your AI Receptionist with calendar tools before testing.");
            return;
        }

        try {
            // Start call using the fully configured Vapi Assistant ID containing the webhook tools & server
            vapi.start(vapiAssistantId);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to start voice test');
        }
    }, [isLoadingInitial, isSaving, isTestingVoice, vapiAssistantId]);

    const handleTrainAI = () => {
        setIsTraining(true);
        setTimeout(() => setIsTraining(false), 2000);
    };

    return (
        <div className="mx-auto flex min-h-[70dvh] max-w-6xl flex-col overflow-hidden lg:h-[calc(100dvh-10rem)]">
            <div className="flex items-center justify-between mb-6 flex-shrink-0 px-2">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-lime-100 dark:bg-lime-900/20 rounded-xl text-lime-700 dark:text-lime-400">
                        <Bot className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">AI Employee Suite</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Manage your digital workforce.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'voice' && isLoadingInitial ? (
                        <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full text-xs font-bold border border-slate-200 dark:border-slate-700">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden />
                            Loading configuration…
                        </span>
                    ) : isTraining ? (
                        <span className="flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold animate-pulse">
                            <Zap className="w-3 h-3" /> Training...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 px-3 py-1 bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300 rounded-full text-xs font-bold">
                            <CheckCircle className="w-3 h-3" /> Brain Active
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col md:flex-row flex-1 min-h-0 transition-colors">
                {/* Sidebar Nav */}
                <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 space-y-2 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('voice')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'voice' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Mic className="w-4 h-4" />
                        Voice Receptionist
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'chat' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <MessageSquare className="w-4 h-4" />
                        Conversation AI
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'reviews' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <Star className="w-4 h-4" />
                        Reviews AI
                    </button>
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === 'knowledge' ? 'bg-white dark:bg-slate-800 text-lime-700 dark:text-lime-400 shadow-sm border border-slate-100 dark:border-slate-700' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        <FileText className="w-4 h-4" />
                        Knowledge Base
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50 dark:bg-slate-900">
                    {/* --- VOICE TAB --- */}
                    {activeTab === 'voice' && isLoadingInitial && (
                        <div className="max-w-3xl space-y-6 animate-fade-in" role="status" aria-live="polite" aria-busy="true">
                            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 shadow-sm">
                                <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-start gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lime-100 dark:bg-lime-900/30">
                                        <Loader2 className="h-7 w-7 text-lime-600 dark:text-lime-400 animate-spin" aria-hidden />
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Loading your AI receptionist</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            We&apos;re fetching your saved settings. This usually takes a few seconds—your business details and preferences will appear here shortly.
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-500">
                                            If you just saved changes, hang tight while we sync with the server.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Preview</p>
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-6 shadow-sm space-y-4 overflow-hidden">
                                    <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
                                    <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                    <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-2">
                                        <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                        <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                    </div>
                                    <div className="h-24 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
                                    <div className="flex gap-2 pt-2">
                                        <div className="h-9 flex-1 max-w-[120px] rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                                        <div className="h-9 flex-1 max-w-[120px] rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'voice' && !isLoadingInitial && (
                        <div className="space-y-8 animate-fade-in max-w-3xl">
                            {(error || successMessage) && (
                                <div className={`rounded-lg border p-3 text-sm ${error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : 'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800 text-lime-700 dark:text-lime-300'}`}>
                                    {error ?? successMessage}
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Voice Receptionist</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Answers missed calls, books appointments, and qualifies leads 24/7.</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isEnabled}
                                        onChange={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                                        className="sr-only peer"
                                        disabled={isLoadingInitial || isSaving}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lime-300 dark:peer-focus:ring-lime-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600"></div>
                                    <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-300">{formData.isEnabled ? 'Active' : 'Paused'}</span>
                                </div>
                            </div>

                            {/* Voice Persona Card */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${(isLoadingInitial || isSaving) ? 'opacity-70 pointer-events-none' : ''}`}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <Volume2 className="w-4 h-4 text-lime-600" /> Audio Persona
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Agent Name</label>
                                        <input
                                            type="text"
                                            value={formData.agentName}
                                            onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Voice Model</label>
                                        <select
                                            value={formData.voiceModel}
                                            onChange={(e) => setFormData({ ...formData, voiceModel: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                            disabled={isLoadingInitial || isSaving}
                                        >
                                            <option value="sarah">Sarah (Warm & Professional)</option>
                                            <option value="mike">Mike (Direct & Clear)</option>
                                            <option value="emma">Emma (British Accent)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={handleTestVoice}
                                        disabled={isLoadingInitial || isSaving}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${isTestingVoice ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-50'}`}
                                    >
                                        {isTestingVoice ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4" />}
                                        {isTestingVoice ? 'Stop Voice' : 'Test Voice'}
                                    </button>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Speed</label>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2"
                                            step="0.1"
                                            value={formData.voiceSpeed}
                                            onChange={(e) => setFormData({ ...formData, voiceSpeed: parseFloat(e.target.value) })}
                                            className="w-full accent-lime-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Business Information Card */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${(isLoadingInitial || isSaving) ? 'opacity-70 pointer-events-none' : ''}`}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Business Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Business Name</label>
                                        <input
                                            type="text"
                                            value={formData.businessName}
                                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                            placeholder="Sunshine Dental Clinic"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Business Type</label>
                                        <select
                                            value={formData.businessType}
                                            onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                            disabled={isLoadingInitial || isSaving}
                                        >
                                            <option value="">Select a business type</option>
                                            <option value="Dentist">Dentist</option>
                                            <option value="Salon">Salon</option>
                                            <option value="Plumbing">Plumbing</option>
                                            <option value="Real Estate">Real Estate</option>
                                            <option value="Restaurant">Restaurant</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Business Address</label>
                                        <input
                                            type="text"
                                            value={formData.businessAddress}
                                            onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                            placeholder="123 Main Street, City"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Business Hours</label>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={formData.businessHours.split(/\s[–\-]\s/)[0]?.trim() ?? ''}
                                                onChange={(e) => {
                                                    const from = e.target.value;
                                                    const to = formData.businessHours.split(/\s[–\-]\s/)[1]?.trim() ?? '';
                                                    setFormData({ ...formData, businessHours: from && to ? `${from} – ${to}` : from });
                                                }}
                                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                                disabled={isLoadingInitial || isSaving}
                                            >
                                                <option value="">From</option>
                                                {TIME_OPTIONS.map((t) => (
                                                    <option key={`from-${t}`} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <span className="text-slate-500 dark:text-slate-400 text-sm font-medium shrink-0">to</span>
                                            <select
                                                value={formData.businessHours.split(/\s[–\-]\s/)[1]?.trim() ?? ''}
                                                onChange={(e) => {
                                                    const to = e.target.value;
                                                    const from = formData.businessHours.split(/\s[–\-]\s/)[0]?.trim() ?? '';
                                                    setFormData({ ...formData, businessHours: from && to ? `${from} – ${to}` : to });
                                                }}
                                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                                disabled={isLoadingInitial || isSaving}
                                            >
                                                <option value="">To</option>
                                                {TIME_OPTIONS.map((t) => (
                                                    <option key={`to-${t}`} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Services & Knowledge Card */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${(isLoadingInitial || isSaving) ? 'opacity-70 pointer-events-none' : ''}`}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Services &amp; Knowledge</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Services you offer</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={formData.newServiceName}
                                                onChange={(e) => setFormData({ ...formData, newServiceName: e.target.value })}
                                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                                placeholder="e.g. Teeth Cleaning"
                                                disabled={isLoadingInitial || isSaving}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const trimmed = formData.newServiceName.trim();
                                                    if (!trimmed) return;
                                                    setFormData({
                                                        ...formData,
                                                        services: [...formData.services, trimmed],
                                                        newServiceName: '',
                                                    });
                                                }}
                                                disabled={isLoadingInitial || isSaving}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                + Add Service
                                            </button>
                                        </div>
                                        {formData.services.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {formData.services.map((service, index) => (
                                                    <div
                                                        key={`${service}-${index}`}
                                                        className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                                    >
                                                        <span className="text-slate-700 dark:text-slate-200">{service}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setFormData({
                                                                    ...formData,
                                                                    services: formData.services.filter((_, i) => i !== index),
                                                                })
                                                            }
                                                            className="text-slate-400 hover:text-red-500 transition-colors"
                                                            disabled={isLoadingInitial || isSaving}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Additional Business Information</label>
                                        <textarea
                                            value={formData.additionalInfo}
                                            onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm min-h-[80px]"
                                            placeholder="Add anything the AI receptionist should know about your business..."
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Greeting Message Card */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${(isLoadingInitial || isSaving) ? 'opacity-70 pointer-events-none' : ''}`}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Greeting Message</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    This is what callers hear first. Leave it blank and we&apos;ll create a friendly greeting for you.
                                </p>
                                <textarea
                                    value={formData.greetingMessage}
                                    onChange={(e) => setFormData({ ...formData, greetingMessage: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm min-h-[80px]"
                                    placeholder="Hello, thank you for calling [Business Name]. How can I help you today?"
                                    disabled={isLoadingInitial || isSaving}
                                />
                            </div>

                            {/* Routing Rules & Provisioning */}
                            <div className={`bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm ${(isLoadingInitial || isSaving) ? 'opacity-70 pointer-events-none' : ''}`}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <Smartphone className="w-4 h-4 text-lime-600" /> Call Handling
                                </h4>

                                <div className="space-y-4">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Grey means <span className="font-medium text-slate-600 dark:text-slate-300">off</span>; green means <span className="font-medium text-slate-600 dark:text-slate-300">on</span>. Click the switch or the row to toggle, then use <span className="font-medium">Save</span>.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Answer customer questions</span>
                                            <span className="relative inline-flex shrink-0 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.answerQuestions}
                                                    onChange={() => setFormData({ ...formData, answerQuestions: !formData.answerQuestions })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="w-9 h-5 bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600" aria-hidden />
                                            </span>
                                        </label>
                                        <label className="flex items-start justify-between gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Book appointments</span>
                                                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                                                    Not locked — off by default. Turn on to enable calendar tools; remember to Save.
                                                </span>
                                            </span>
                                            <span className="relative inline-flex shrink-0 items-center pt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.bookAppointments}
                                                    onChange={() => setFormData({ ...formData, bookAppointments: !formData.bookAppointments })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="w-9 h-5 bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600" aria-hidden />
                                            </span>
                                        </label>
                                        <label className="flex items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Take messages</span>
                                            <span className="relative inline-flex shrink-0 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.takeMessages}
                                                    onChange={() => setFormData({ ...formData, takeMessages: !formData.takeMessages })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="w-9 h-5 bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600" aria-hidden />
                                            </span>
                                        </label>
                                        <label className="flex items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Transfer urgent calls</span>
                                            <span className="relative inline-flex shrink-0 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.transferEnabled}
                                                    onChange={() => setFormData({ ...formData, transferEnabled: !formData.transferEnabled })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="w-9 h-5 bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600" aria-hidden />
                                            </span>
                                        </label>
                                    </div>

                                    <label className="flex items-center justify-between gap-3 p-3 border border-slate-100 dark:border-slate-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                        <span>
                                            <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">Only answer after hours</span>
                                            <span className="block text-xs text-slate-500 dark:text-slate-400">If disabled, AI answers all missed calls 24/7.</span>
                                        </span>
                                        <span className="relative inline-flex shrink-0 items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.afterHoursOnly}
                                                onChange={() => setFormData({ ...formData, afterHoursOnly: !formData.afterHoursOnly })}
                                                className="sr-only peer"
                                                disabled={isLoadingInitial || isSaving}
                                            />
                                            <span className="w-9 h-5 bg-slate-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600" aria-hidden />
                                        </span>
                                    </label>

                                    {formData.transferEnabled && (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Live Transfer Number</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.transferNumber}
                                                    onChange={(e) => setFormData({ ...formData, transferNumber: e.target.value })}
                                                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm"
                                                    placeholder="e.g. +15551234567"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <button
                                                    type="button"
                                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200"
                                                    disabled={isLoadingInitial || isSaving}
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1">If the AI cannot answer a query, it will attempt to transfer the call here.</p>
                                        </div>
                                    )}
                                    <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSyncAssistant}
                                                disabled={isLoadingInitial || isSaving || isSyncingAssistant}
                                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {isSyncingAssistant ? 'Syncing…' : 'Sync with Vapi'}
                                            </button>
                                            {!formData.phoneNumber?.trim() && (
                                                <button
                                                    type="button"
                                                    onClick={handleProvisionPhone}
                                                    disabled={isLoadingInitial || isSaving || isProvisioningPhone}
                                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {isProvisioningPhone ? 'Provisioning…' : 'Provision Phone Number'}
                                                </button>
                                            )}
                                            {formData.phoneNumber?.trim() && (
                                                <button
                                                    type="button"
                                                    onClick={handleLinkAssistantToPhone}
                                                    disabled={
                                                        isLoadingInitial ||
                                                        isSaving ||
                                                        isLinkingAssistantToPhone ||
                                                        isSyncingAssistant
                                                    }
                                                    className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    title="If Vapi shows the wrong assistant for this number, run Save or Sync first, then click here."
                                                >
                                                    {isLinkingAssistantToPhone ? 'Linking…' : 'Link assistant to number'}
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Connected Phone Number</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={formData.phoneNumber?.trim() || "Click 'Provision Phone Number' to generate your AI line."}
                                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm text-slate-700 dark:text-slate-200 read-only:cursor-default read-only:select-none"
                                                aria-describedby="phone-helper"
                                            />
                                            <div
                                                id="phone-helper"
                                                className="mt-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-3 py-2 text-xs text-slate-500 dark:text-slate-400"
                                            >
                                                To activate your AI receptionist, set up Call Forwarding with your current phone provider. Have them forward missed or unanswered calls directly to the number above.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={isLoadingInitial || isSaving}
                                            className="flex items-center gap-2 px-6 py-3 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-sm"
                                        >
                                            {isSaving ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            {isSaving ? 'Saving…' : 'Save'}
                                        </button>
                                        {(error || successMessage) && (
                                            <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${error ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' : 'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-800 text-lime-700 dark:text-lime-300'}`}>
                                                {error ?? successMessage}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact Capture API & CRM Sync */}
                            <div className={"bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm " + ((isLoadingInitial || isSaving) ? "opacity-70 pointer-events-none" : "")}>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Contact Capture & CRM Sync</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                    For best accuracy, the AI will ask callers to spell their email and confirm it before saving.
                                </p>
                                <div className="space-y-4 mb-6">
                                    <label className="flex justify-between items-center"><span className="text-sm text-slate-700 dark:text-slate-300">Capture caller name</span><input type="checkbox" checked={formData.captureName} onChange={(e) => setFormData({ ...formData, captureName: e.target.checked })} className="accent-lime-600" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-slate-700 dark:text-slate-300">Capture caller phone</span><input type="checkbox" checked={formData.capturePhone} onChange={(e) => setFormData({ ...formData, capturePhone: e.target.checked })} className="accent-lime-600" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-slate-700 dark:text-slate-300">Capture caller email</span><input type="checkbox" checked={formData.captureEmail} onChange={(e) => setFormData({ ...formData, captureEmail: e.target.checked })} className="accent-lime-600" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-slate-700 dark:text-slate-300">Require email confirmation before marking complete</span><input type="checkbox" checked={formData.requireEmailConfirmation} onChange={(e) => setFormData({ ...formData, requireEmailConfirmation: e.target.checked })} className="accent-lime-600" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-slate-700 dark:text-slate-300">Save incomplete contacts as Needs Review</span><input type="checkbox" checked={formData.saveIncompleteAsReview} onChange={(e) => setFormData({ ...formData, saveIncompleteAsReview: e.target.checked })} className="accent-lime-600" disabled={isLoadingInitial || isSaving} /></label>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <h5 className="text-xs font-bold text-slate-500 uppercase">Webhook Status</h5>
                                    <p className="text-sm font-mono mt-1 text-slate-700 dark:text-slate-300">URL: {typeof window !== 'undefined' ? window.location.origin + '/api/vapi/webhook' : ''}</p>
                                    <p className="text-sm mt-1 text-slate-600 dark:text-slate-400">Status: <span className="text-lime-600 font-bold">Configured</span></p>
                                    {typeof window !== 'undefined' && window.location.hostname === 'localhost' && (
                                        <p className="text-xs text-red-500 mt-2">Warning: Webhook uses localhost. Vapi requires a public URL (like ngrok) to send call events!</p>
                                    )}
                                </div>
                            </div>
                            {/* Recent Call Activity */}
                            {calls.length > 0 && (
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-3">Recent Calls & Data Capture</h4>
                                    <div className="space-y-3">
                                        {calls.map((call) => {
                                            const missing = Array.isArray(call.missing_fields) ? call.missing_fields : [];
                                            const needsReview = call.needs_human_review || (!call.full_name && !call.email && !call.email_confirmed);
                                            return (
                                                <div key={call.id} className="flex flex-col text-xs text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold capitalize text-sm text-slate-800 dark:text-slate-100">{call.full_name || 'Unknown Caller'}</span>
                                                            <span className="text-[11px] text-slate-400">
                                                                {call.from_number || call.caller_phone || 'Unknown'} → <span className="capitalize">{call.direction || 'inbound'}</span>
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block capitalize font-semibold">{call.status || 'unknown'}</span>
                                                            <span className="text-[11px] text-slate-400">{new Date(call.created_at).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">Email:</span>
                                                                {call.email ? (
                                                                    <span className="text-slate-700 dark:text-slate-200">{call.email}</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Not Captured</span>
                                                                )}
                                                                {call.email_confirmed && <span className="px-1.5 py-0.5 rounded-full bg-lime-100 text-lime-700 text-[10px] font-bold">Confirmed</span>}
                                                            </div>
                                                            <div className="flex items-start gap-2">
                                                                <span className="font-medium">Missing:</span>
                                                                {missing.length > 0 ? (
                                                                    <span className="text-amber-500">{missing.join(', ')}</span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">None</span>
                                                                )}
                                                            </div>
                                                            {(!call.full_name && !call.email && !call.email_confirmed && missing.length === 0) && (
                                                                <span className="text-red-500 font-bold">No structured data</span>
                                                            )}
                                                        </div>
                                                        {needsReview && (
                                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                                                Needs Review
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- CHAT TAB --- */}
                    {activeTab === 'chat' && (
                        <div className="space-y-8 animate-fade-in max-w-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Conversation AI</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Handles SMS, Email, and Webchat inquiries automatically.</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={chatConfig.enabled} onChange={() => setChatConfig({ ...chatConfig, enabled: !chatConfig.enabled })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lime-300 dark:peer-focus:ring-lime-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600"></div>
                                    <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-300">{chatConfig.enabled ? 'Active' : 'Paused'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-lime-500 transition-colors cursor-pointer group" onClick={() => setChatConfig({ ...chatConfig, tone: 'Professional' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Professional</h4>
                                        {chatConfig.tone === 'Professional' && <CheckCircle className="w-5 h-5 text-lime-600" />}
                                    </div>
                                    <p className="text-sm text-slate-500">Concise, polite, and strictly business-focused.</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-lime-500 transition-colors cursor-pointer group" onClick={() => setChatConfig({ ...chatConfig, tone: 'Friendly' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Friendly & Casual</h4>
                                        {chatConfig.tone === 'Friendly' && <CheckCircle className="w-5 h-5 text-lime-600" />}
                                    </div>
                                    <p className="text-sm text-slate-500">Uses emojis, warmer language, and exclamation points.</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-lime-500 transition-colors cursor-pointer group" onClick={() => setChatConfig({ ...chatConfig, tone: 'Empathetic' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Empathetic</h4>
                                        {chatConfig.tone === 'Empathetic' && <CheckCircle className="w-5 h-5 text-lime-600" />}
                                    </div>
                                    <p className="text-sm text-slate-500">Best for healthcare. Patient, understanding, and soft.</p>
                                </div>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-lime-500 transition-colors cursor-pointer group" onClick={() => setChatConfig({ ...chatConfig, tone: 'Funny' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200">Witty</h4>
                                        {chatConfig.tone === 'Funny' && <CheckCircle className="w-5 h-5 text-lime-600" />}
                                    </div>
                                    <p className="text-sm text-slate-500">Uses humor and slang. Good for modern lifestyle brands.</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-lime-600" /> Advanced Settings
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-700 dark:text-slate-300">Minimum Confidence Score</span>
                                        <span className="text-sm font-bold text-lime-600">90%</span>
                                    </div>
                                    <input type="range" className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-lime-600" defaultValue="90" />
                                    <p className="text-xs text-slate-500">If AI confidence is below 90%, it will draft a reply for your approval instead of sending.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- REVIEWS TAB --- */}
                    {activeTab === 'reviews' && (
                        <div className="space-y-8 animate-fade-in max-w-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Reviews AI</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Auto-respond to customer feedback on Google, Facebook, etc.</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={reviewConfig.enabled} onChange={() => setReviewConfig({ ...reviewConfig, enabled: !reviewConfig.enabled })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-lime-300 dark:peer-focus:ring-lime-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-lime-600"></div>
                                    <span className="ml-3 text-sm font-medium text-slate-900 dark:text-slate-300">{reviewConfig.enabled ? 'Active' : 'Paused'}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${reviewConfig.autoReply5Star ? 'bg-lime-50 border-lime-200 dark:bg-lime-900/10 dark:border-lime-900' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
                                    <div className="pt-1">
                                        <input type="checkbox" checked={reviewConfig.autoReply5Star} onChange={() => setReviewConfig({ ...reviewConfig, autoReply5Star: !reviewConfig.autoReply5Star })} className="w-5 h-5 text-lime-600 rounded focus:ring-lime-500 border-gray-300" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Auto-Reply to 5-Star Reviews</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">AI will post a "Thank You" message immediately. It varies the language to avoid looking robotic.</p>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-xl border flex items-start gap-4 transition-all ${reviewConfig.autoReply4Star ? 'bg-lime-50 border-lime-200 dark:bg-lime-900/10 dark:border-lime-900' : 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'}`}>
                                    <div className="pt-1">
                                        <input type="checkbox" checked={reviewConfig.autoReply4Star} onChange={() => setReviewConfig({ ...reviewConfig, autoReply4Star: !reviewConfig.autoReply4Star })} className="w-5 h-5 text-lime-600 rounded focus:ring-lime-500 border-gray-300" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">Auto-Reply to 4-Star Reviews</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">AI will thank them and gently ask what could make it 5 stars.</p>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl border bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 flex items-start gap-4 opacity-75">
                                    <div className="pt-1">
                                        <input type="checkbox" disabled className="w-5 h-5 text-slate-400 rounded bg-slate-200 border-gray-300" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-600 dark:text-slate-400">Auto-Reply to Negative Reviews (1-3 Stars)</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">Disabled for safety. AI will draft a reply for your approval in the Reviews Dashboard.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="w-4 h-4 text-slate-500" />
                                    <h4 className="font-bold text-slate-700 dark:text-slate-200">Response Delay</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input type="range" min="0" max="24" value={reviewConfig.delayHours} onChange={(e) => setReviewConfig({ ...reviewConfig, delayHours: parseInt(e.target.value) })} className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-lime-600" />
                                    <span className="text-sm font-bold min-w-[60px]">{reviewConfig.delayHours} Hours</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">Adding a delay makes the response feel more human.</p>
                            </div>
                        </div>
                    )}

                    {/* --- KNOWLEDGE TAB --- */}
                    {activeTab === 'knowledge' && (
                        <div className="space-y-6 animate-fade-in max-w-3xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Knowledge Base</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Upload documents to train your AI Employee.</p>
                                </div>
                                <button onClick={handleTrainAI} className="px-4 py-2 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm">
                                    Retrain AI
                                </button>
                            </div>

                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center bg-white dark:bg-slate-900 transition-colors cursor-pointer hover:border-lime-500 group">
                                <div className="mx-auto w-12 h-12 bg-slate-100 dark:bg-slate-800 group-hover:bg-lime-50 dark:group-hover:bg-lime-900/20 rounded-full flex items-center justify-center shadow-sm mb-3 transition-colors">
                                    <Upload className="w-6 h-6 text-slate-400 dark:text-slate-300 group-hover:text-lime-600" />
                                </div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-lime-600 transition-colors">Click to upload Price Lists, FAQs, or Service Menus</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PDF, DOCX, TXT supported (Max 10MB)</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase mb-3">Active Documents</h4>
                                <div className="space-y-2">
                                    {chatConfig.knowledgeBaseFiles.map((file, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg group hover:shadow-sm transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-lime-100 dark:bg-lime-900/30 text-lime-600 dark:text-lime-400 rounded-lg">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{file}</p>
                                                    <p className="text-[10px] text-slate-400">Synced just now</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setChatConfig({ ...chatConfig, knowledgeBaseFiles: chatConfig.knowledgeBaseFiles.filter(f => f !== file) })}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
