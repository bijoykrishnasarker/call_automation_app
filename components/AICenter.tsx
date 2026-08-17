'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MessageSquare, Save, Play, Upload, FileText, CheckCircle, Smartphone, Star, Volume2, Clock, Trash2, Sliders, Square, Loader2, Sparkles, Headphones, Plus } from 'lucide-react';
import Vapi from '@vapi-ai/web';
import { AIReviewConfig, AIChatConfig } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { fetchAiReceptionistSettings } from '@/lib/api/ai-receptionist-settings';
import { PageHeader } from '@/components/ui/PageHeader';

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

function stringifyVapiError(err: unknown): string {
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'object') {
        const record = err as Record<string, unknown>;
        const nested = record.error;
        if (typeof record.errorMsg === 'string' && record.errorMsg.trim()) return record.errorMsg;
        if (typeof record.message === 'string' && record.message.trim()) return record.message;
        if (nested && typeof nested === 'object') {
            const inner = nested as Record<string, unknown>;
            if (typeof inner.errorMsg === 'string' && inner.errorMsg.trim()) return inner.errorMsg;
            if (typeof inner.msg === 'string' && inner.msg.trim()) return inner.msg;
            if (typeof inner.message === 'string' && inner.message.trim()) return inner.message;
        }
        try {
            return JSON.stringify(err);
        } catch {
            return String(err);
        }
    }
    return String(err);
}

/** Daily.co fires this when a web call hangs up — it is not a real failure. */
function isBenignVapiHangup(err: unknown): boolean {
    const text = stringifyVapiError(err).toLowerCase();
    const blob = (() => {
        try {
            return JSON.stringify(err).toLowerCase();
        } catch {
            return text;
        }
    })();
    const haystack = `${text} ${blob}`;
    return (
        haystack.includes('meeting has ended') ||
        haystack.includes('meeting-ended') ||
        haystack.includes('meeting ended') ||
        haystack.includes('call has ended') ||
        haystack.includes('"ejected"') ||
        haystack.includes('ejection')
    );
}

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
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
    const [calendarToolsConnected, setCalendarToolsConnected] = useState(false);
    const vapiRef = useRef<InstanceType<typeof Vapi> | null>(null);
    const endingCallRef = useRef(false);

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
                const { settings, connected_phone_number, vapi_assistant_id, webhook_url, calendar_tools_connected } = await fetchAiReceptionistSettings(session.access_token);
                if (!cancelled) {
                    setVapiAssistantId(vapi_assistant_id);
                    setWebhookUrl(webhook_url);
                    setCalendarToolsConnected(Boolean(calendar_tools_connected));
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
            endingCallRef.current = false;
            setError(null);
            setIsTestingVoice(true);
        };
        const onEnd = () => {
            endingCallRef.current = false;
            setIsTestingVoice(false);
            setSuccessMessage(
                'Call ended. Saving your appointment to Calendar & Supabase — refresh Calendar in a few seconds.'
            );
            window.dispatchEvent(new Event('focus'));
            window.setTimeout(() => setSuccessMessage(null), 12000);
        };
        const onError = (err: unknown) => {
            if (endingCallRef.current || isBenignVapiHangup(err)) {
                endingCallRef.current = false;
                setIsTestingVoice(false);
                return;
            }
            console.error('Vapi Web SDK Error:', err);
            const detail = stringifyVapiError(err);
            setError(
                detail
                    ? `Voice test failed: ${detail}`
                    : 'Voice test failed. Check microphone permission and try again.'
            );
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
                const connected = Boolean((vapiData as { calendarToolsConnected?: boolean }).calendarToolsConnected);
                const url = (vapiData as { webhookUrl?: string | null }).webhookUrl ?? null;
                setCalendarToolsConnected(connected);
                setWebhookUrl(url);
                try {
                    const fresh = await fetchAiReceptionistSettings(accessToken);
                    setVapiAssistantId(fresh.vapi_assistant_id);
                    setWebhookUrl(fresh.webhook_url);
                    setCalendarToolsConnected(Boolean(fresh.calendar_tools_connected));
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

    const handleTestVoice = useCallback(async () => {
        if (isSaving) return;
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
            endingCallRef.current = true;
            try {
                vapi.stop();
            } catch {
                /* already ending */
            }
            setIsTestingVoice(false);
            return;
        }

        let assistantId = vapiAssistantId;
        if (!assistantId) {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError('Sign in first, then try Test Call again.');
                return;
            }
            setIsSaving(true);
            try {
                await persistReceptionistAndVapi(session.access_token);
                const fresh = await fetchAiReceptionistSettings(session.access_token);
                assistantId = fresh.vapi_assistant_id;
                setVapiAssistantId(assistantId);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not create the Vapi agent. Try Save, then Test Call.');
                return;
            } finally {
                setIsSaving(false);
            }
        }

        if (!assistantId) {
            setError('Could not create the Vapi agent. Click Save / Sync with Vapi, then try Test Call again.');
            return;
        }

        try {
            endingCallRef.current = false;
            await vapi.start(assistantId);
        } catch (e) {
            if (endingCallRef.current || isBenignVapiHangup(e)) {
                endingCallRef.current = false;
                setIsTestingVoice(false);
                return;
            }
            setError(e instanceof Error ? e.message : stringifyVapiError(e) || 'Failed to start voice test');
            setIsTestingVoice(false);
        }
    }, [isSaving, isTestingVoice, persistReceptionistAndVapi, vapiAssistantId]);

    const handleTrainAI = () => {
        setIsTraining(true);
        setTimeout(() => setIsTraining(false), 2000);
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <PageHeader
                breadcrumbs={[
                    { label: 'Dashboard' },
                    { label: 'AI Command Center' },
                ]}
                title="AI Command Center"
                subtitle="Configure your AI voice assistant to handle your inbound and outbound calls."
                action={
                    activeTab === 'voice' ? (
                        <button
                            type="button"
                            onClick={handleTestVoice}
                            disabled={isSaving || isTestingVoice}
                            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isTestingVoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {isTestingVoice ? 'End Test Call' : 'Test Call for AI Voice'}
                        </button>
                    ) : undefined
                }
            />

            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 font-bold text-white">
                            <Sparkles className="h-4 w-4 text-violet-400" />
                            Predictive Scoring
                        </h3>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-black p-4">
                            <p className="text-xs font-medium text-zinc-500">Quality Score</p>
                            <p className="mt-1 text-3xl font-bold text-white">4.2k</p>
                        </div>
                        <div className="rounded-lg bg-black p-4">
                            <p className="text-xs font-medium text-zinc-500">Sentiment Accuracy</p>
                            <p className="mt-1 text-3xl font-bold text-emerald-400">94.8%</p>
                        </div>
                    </div>
                    <p className="mt-4 text-sm text-zinc-500">
                        Predictive analytics helps finding leads, sending personalized messages, and more based on behaviors.
                    </p>
                </section>
                <section className="rounded-xl border border-white/[0.06] bg-[#141416] p-5">
                    <h3 className="mb-4 flex items-center gap-2 font-bold text-white">
                        <Headphones className="h-4 w-4 text-violet-400" />
                        Recent Live Transcriptions
                    </h3>
                    <ul className="space-y-3">
                        <li className="flex items-start justify-between gap-3 rounded-lg bg-black p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-sky-400">Nathaniel Thompson</p>
                                <p className="mt-1 text-sm text-zinc-400">Looking for pricing options for your standard package. Can you share details?</p>
                            </div>
                            <span className="shrink-0 text-xs text-zinc-500">1m ago</span>
                        </li>
                        <li className="flex items-start justify-between gap-3 rounded-lg bg-black p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-emerald-400">Emily Murphy</p>
                                <p className="mt-1 text-sm text-zinc-400">Hey, I just want to know if there&apos;s any update on my order status. Any information?</p>
                            </div>
                            <span className="shrink-0 text-xs text-zinc-500">10m ago</span>
                        </li>
                    </ul>
                </section>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#141416] md:flex-row">
                {/* Sidebar Nav */}
                <div className="w-full shrink-0 space-y-1 border-b border-white/[0.06] bg-[#111214] p-3 md:w-64 md:border-b-0 md:border-r">
                    <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Agents</p>
                    <button
                        onClick={() => setActiveTab('voice')}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'voice' ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                        <Mic className="h-4 w-4" />
                        Voice Receptionist
                    </button>
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                        <MessageSquare className="h-4 w-4" />
                        Conversation AI
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'reviews' ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                        <Star className="h-4 w-4" />
                        Reviews AI
                    </button>
                    <button
                        onClick={() => setActiveTab('knowledge')}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${activeTab === 'knowledge' ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'}`}>
                        <FileText className="h-4 w-4" />
                        Knowledge Base
                    </button>
                </div>

                {/* Content Area */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-[#0B0C0E] p-6">
                    {/* --- VOICE TAB --- */}
                    {activeTab === 'voice' && (
                        <div className="space-y-8 animate-fade-in max-w-3xl">
                            {(error || successMessage) && (
                                <div className={`rounded-lg border p-3 text-sm ${error ? 'border-red-800 bg-red-900/20 text-red-300' : 'border-violet-800 bg-violet-900/20 text-violet-300'}`}>
                                    {error ?? successMessage}
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white">Voice Receptionist</h3>
                                    <p className="text-sm text-zinc-500">Answers missed calls, books appointments, and qualifies leads 24/7.</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isEnabled}
                                        onChange={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                                        className="sr-only peer"
                                        disabled={isLoadingInitial || isSaving}
                                    />
                                    <div className="peer relative h-6 w-11 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-800"></div>
                                    <span className="ml-3 text-sm font-medium text-zinc-300">{formData.isEnabled ? 'Active' : 'Paused'}</span>
                                </div>
                            </div>

                            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-4">
                                <h4 className="mb-2 text-sm font-bold text-violet-200">Voice booking — 3 simple steps</h4>
                                <ol className="list-inside list-decimal space-y-1.5 text-sm text-violet-100/90">
                                    <li><strong>Sync with Vapi</strong> (Book appointments ON) — connects calendar tools once.</li>
                                    <li><strong>Test Voice</strong> — tell the AI your name, phone, and appointment date &amp; time.</li>
                                    <li><strong>Stop Voice</strong> — appointment saves to <code className="font-mono text-xs">bookings</code> + <code className="font-mono text-xs">appointments</code> in Supabase and shows on Calendar.</li>
                                </ol>
                                <p className="mt-2 text-xs text-violet-200/70">
                                    During the call the AI may book immediately; if not, it still saves when the call ends from what you confirmed.
                                </p>
                            </div>

                            {/* Voice Persona Card */}
                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-4 flex items-center gap-2 font-bold text-white">
                                    <Volume2 className="h-4 w-4 text-violet-400" /> Audio Persona
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Agent Name</label>
                                        <input
                                            type="text"
                                            value={formData.agentName}
                                            onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                                            className="w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Voice Model</label>
                                        <select
                                            value={formData.voiceModel}
                                            onChange={(e) => setFormData({ ...formData, voiceModel: e.target.value })}
                                            className="w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
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
                                        disabled={isSaving || isTestingVoice}
                                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-bold transition-all ${isTestingVoice ? 'animate-pulse border-red-500/40 text-red-300' : 'border-zinc-700 text-white hover:bg-white/[0.04] disabled:opacity-50'}`}
                                    >
                                        {isTestingVoice ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4" />}
                                        {isTestingVoice ? 'Stop Voice' : 'Test Voice'}
                                    </button>
                                    <div className="flex-1">
                                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Speed</label>
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="2"
                                            step="0.1"
                                            value={formData.voiceSpeed}
                                            onChange={(e) => setFormData({ ...formData, voiceSpeed: parseFloat(e.target.value) })}
                                            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Business Information Card */}
                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-4 font-bold text-white">Business Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Business Name</label>
                                        <input
                                            type="text"
                                            value={formData.businessName}
                                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                                            className="w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                            placeholder="Sunshine Dental Clinic"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Business Type</label>
                                        <select
                                            value={formData.businessType}
                                            onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                                            className="w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
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
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Business Address</label>
                                        <input
                                            type="text"
                                            value={formData.businessAddress}
                                            onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                                            className="w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                            placeholder="123 Main Street, City"
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Business Hours</label>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={formData.businessHours.split(/\s[–\-]\s/)[0]?.trim() ?? ''}
                                                onChange={(e) => {
                                                    const from = e.target.value;
                                                    const to = formData.businessHours.split(/\s[–\-]\s/)[1]?.trim() ?? '';
                                                    setFormData({ ...formData, businessHours: from && to ? `${from} – ${to}` : from });
                                                }}
                                                className="flex-1 rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                                disabled={isLoadingInitial || isSaving}
                                            >
                                                <option value="">From</option>
                                                {TIME_OPTIONS.map((t) => (
                                                    <option key={`from-${t}`} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <span className="text-zinc-500 text-sm font-medium shrink-0">to</span>
                                            <select
                                                value={formData.businessHours.split(/\s[–\-]\s/)[1]?.trim() ?? ''}
                                                onChange={(e) => {
                                                    const to = e.target.value;
                                                    const from = formData.businessHours.split(/\s[–\-]\s/)[0]?.trim() ?? '';
                                                    setFormData({ ...formData, businessHours: from && to ? `${from} – ${to}` : to });
                                                }}
                                                className="flex-1 rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
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
                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-4 font-bold text-white">Services &amp; Knowledge</h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Services you offer</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={formData.newServiceName}
                                                onChange={(e) => setFormData({ ...formData, newServiceName: e.target.value })}
                                                className="flex-1 rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
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
                                                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-bold text-zinc-200 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                + Add Service
                                            </button>
                                        </div>
                                        {formData.services.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {formData.services.map((service, index) => (
                                                    <div
                                                        key={`${service}-${index}`}
                                                        className="flex items-center justify-between rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm"
                                                    >
                                                        <span className="text-zinc-200">{service}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setFormData({
                                                                    ...formData,
                                                                    services: formData.services.filter((_, i) => i !== index),
                                                                })
                                                            }
                                                            className="text-zinc-500 transition-colors hover:text-red-400"
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
                                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Additional Business Information</label>
                                        <textarea
                                            value={formData.additionalInfo}
                                            onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                                            className="min-h-[80px] w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                            placeholder="Add anything the AI receptionist should know about your business..."
                                            disabled={isLoadingInitial || isSaving}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Greeting Message Card */}
                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-2 font-bold text-white">Greeting Message</h4>
                                <p className="text-xs text-zinc-500 mb-3">
                                    This is what callers hear first. Leave it blank and we&apos;ll create a friendly greeting for you.
                                </p>
                                <textarea
                                    value={formData.greetingMessage}
                                    onChange={(e) => setFormData({ ...formData, greetingMessage: e.target.value })}
                                    className="min-h-[80px] w-full rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                    placeholder="Hello, thank you for calling [Business Name]. How can I help you today?"
                                    disabled={isLoadingInitial || isSaving}
                                />
                            </div>

                            {/* Routing Rules & Provisioning */}
                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-4 flex items-center gap-2 font-bold text-white">
                                    <Smartphone className="h-4 w-4 text-violet-400" /> Call Handling
                                </h4>

                                <div className="space-y-4">
                                    <p className="text-xs text-zinc-500">
                                        Grey means <span className="font-medium text-zinc-300">off</span>; green means <span className="font-medium text-zinc-300">on</span>. Click the switch or the row to toggle, then use <span className="font-medium">Save</span>.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <label className="flex items-center justify-between gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="text-sm font-medium text-zinc-100">Answer customer questions</span>
                                            <span className="relative inline-flex shrink-0 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.answerQuestions}
                                                    onChange={() => setFormData({ ...formData, answerQuestions: !formData.answerQuestions })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="peer relative h-5 w-9 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-500" aria-hidden />
                                            </span>
                                        </label>
                                        <label className="flex items-start justify-between gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="min-w-0">
                                                <span className="block text-sm font-medium text-zinc-100">Book appointments</span>
                                                <span className="mt-0.5 block text-xs text-zinc-500">
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
                                                <span className="peer relative h-5 w-9 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-500" aria-hidden />
                                            </span>
                                        </label>
                                        <label className="flex items-center justify-between gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="text-sm font-medium text-zinc-100">Take messages</span>
                                            <span className="relative inline-flex shrink-0 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.takeMessages}
                                                    onChange={() => setFormData({ ...formData, takeMessages: !formData.takeMessages })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="peer relative h-5 w-9 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-500" aria-hidden />
                                            </span>
                                        </label>
                                        <label className="flex items-center justify-between gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                            <span className="text-sm font-medium text-zinc-100">Transfer urgent calls</span>
                                            <span className="relative inline-flex shrink-0 items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.transferEnabled}
                                                    onChange={() => setFormData({ ...formData, transferEnabled: !formData.transferEnabled })}
                                                    className="sr-only peer"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <span className="peer relative h-5 w-9 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-500" aria-hidden />
                                            </span>
                                        </label>
                                    </div>

                                    <label className="flex items-center justify-between gap-3 p-3 border border-zinc-800 rounded-lg cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                                        <span>
                                            <span className="block text-sm font-medium text-zinc-100">Only answer after hours</span>
                                            <span className="block text-xs text-zinc-500">If disabled, AI answers all missed calls 24/7.</span>
                                        </span>
                                        <span className="relative inline-flex shrink-0 items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.afterHoursOnly}
                                                onChange={() => setFormData({ ...formData, afterHoursOnly: !formData.afterHoursOnly })}
                                                className="sr-only peer"
                                                disabled={isLoadingInitial || isSaving}
                                            />
                                            <span className="peer relative h-5 w-9 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-violet-500" aria-hidden />
                                        </span>
                                    </label>

                                    {formData.transferEnabled && (
                                        <div>
                                            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Live Transfer Number</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.transferNumber}
                                                    onChange={(e) => setFormData({ ...formData, transferNumber: e.target.value })}
                                                    className="flex-1 rounded-md border border-zinc-800 bg-black p-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-violet-500/50"
                                                    placeholder="e.g. +15551234567"
                                                    disabled={isLoadingInitial || isSaving}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setError(null);
                                                        setSuccessMessage(null);
                                                        const digits = formData.transferNumber.replace(/\D/g, '');
                                                        if (digits.length >= 10) {
                                                            setSuccessMessage('Transfer number looks valid. Save to apply it on the Vapi agent.');
                                                            setTimeout(() => setSuccessMessage(null), 4000);
                                                        } else {
                                                            setError('Enter a valid phone with country code, e.g. +15551234567');
                                                        }
                                                    }}
                                                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-bold text-zinc-300 hover:bg-white/[0.04]"
                                                    disabled={isSaving}
                                                >
                                                    Verify
                                                </button>
                                            </div>
                                            <p className="mt-1 text-[10px] text-zinc-500">If the AI cannot answer a query, it will attempt to transfer the call here.</p>
                                        </div>
                                    )}
                                    <div className="mt-6 flex flex-col gap-4 border-t border-zinc-800 pt-4">
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSyncAssistant}
                                                disabled={isSaving || isSyncingAssistant}
                                                className="rounded-lg border border-zinc-700 bg-[#111113] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isSyncingAssistant ? 'Syncing…' : 'Sync with Vapi'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleProvisionPhone}
                                                disabled={isSaving || isProvisioningPhone}
                                                className="rounded-lg border border-zinc-700 bg-[#111113] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isProvisioningPhone ? 'Generating…' : 'Provision Phone Number'}
                                            </button>
                                            {formData.phoneNumber?.trim() ? (
                                                <button
                                                    type="button"
                                                    onClick={handleLinkAssistantToPhone}
                                                    disabled={
                                                        isSaving ||
                                                        isLinkingAssistantToPhone ||
                                                        isSyncingAssistant
                                                    }
                                                    className="rounded-lg border border-zinc-700 bg-[#111113] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                                                    title="If Vapi shows the wrong assistant for this number, run Save or Sync first, then click here."
                                                >
                                                    {isLinkingAssistantToPhone ? 'Linking…' : 'Link assistant to number'}
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Connected Phone Number</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={formData.phoneNumber?.trim() || ''}
                                                placeholder="Click 'Provision Phone Number' to generate a number."
                                                className="w-full cursor-default rounded-md border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-400"
                                                aria-describedby="phone-helper"
                                            />
                                            <div
                                                id="phone-helper"
                                                className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-500"
                                            >
                                                To activate your AI receptionist, set up Call Forwarding for unanswered calls directly to the number above.
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {isSaving ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4" />
                                                )}
                                                {isSaving ? 'Saving…' : 'Save'}
                                            </button>
                                            {(error || successMessage) && (
                                                <span className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${error ? 'border-red-800 bg-red-900/20 text-red-300' : 'border-violet-800 bg-violet-900/20 text-violet-300'}`}>
                                                    {error ?? successMessage}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Contact Capture API & CRM Sync */}
                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-2 font-bold text-white">Contact Capture & CRM Sync</h4>
                                <p className="text-xs text-zinc-500 mb-4">
                                    For best accuracy, the AI will ask callers to spell their email and confirm it before saving.
                                </p>
                                <div className="space-y-4 mb-6">
                                    <label className="flex justify-between items-center"><span className="text-sm text-zinc-300">Capture caller name</span><input type="checkbox" checked={formData.captureName} onChange={(e) => setFormData({ ...formData, captureName: e.target.checked })} className="accent-violet-500" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-zinc-300">Capture caller phone</span><input type="checkbox" checked={formData.capturePhone} onChange={(e) => setFormData({ ...formData, capturePhone: e.target.checked })} className="accent-violet-500" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-zinc-300">Capture caller email</span><input type="checkbox" checked={formData.captureEmail} onChange={(e) => setFormData({ ...formData, captureEmail: e.target.checked })} className="accent-violet-500" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-zinc-300">Require email confirmation before marking complete</span><input type="checkbox" checked={formData.requireEmailConfirmation} onChange={(e) => setFormData({ ...formData, requireEmailConfirmation: e.target.checked })} className="accent-violet-500" disabled={isLoadingInitial || isSaving} /></label>
                                    <label className="flex justify-between items-center"><span className="text-sm text-zinc-300">Save incomplete contacts as Needs Review</span><input type="checkbox" checked={formData.saveIncompleteAsReview} onChange={(e) => setFormData({ ...formData, saveIncompleteAsReview: e.target.checked })} className="accent-violet-500" disabled={isLoadingInitial || isSaving} /></label>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-black p-4">
                                    <h5 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Calendar & Webhook</h5>
                                    <p className="text-sm font-mono mt-1 text-zinc-300 break-all">
                                        Webhook: {webhookUrl ?? 'Not set — click Sync with Vapi'}
                                    </p>
                                    <p className="text-sm mt-1 text-zinc-400">
                                        Calendar tools:{' '}
                                        <span className={calendarToolsConnected && formData.bookAppointments ? 'font-bold text-violet-400' : 'text-red-600 font-bold'}>
                                            {calendarToolsConnected && formData.bookAppointments
                                                ? 'Connected (AI can check & book appointments)'
                                                : !formData.bookAppointments
                                                  ? 'Off — turn on Book appointments above'
                                                  : 'NOT connected — open the live site, turn on Book appointments, then Sync with Vapi'}
                                        </span>
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-2">
                                        The AI does not open the Calendar page. During a call it uses tools that read/write your Supabase <code className="font-mono">bookings</code> table — the Calendar page shows the same data.
                                    </p>
                                </div>
                            </div>
                            {/* Recent Call Activity */}
                            {calls.length > 0 && (
                                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                    <h4 className="mb-3 font-bold text-white">Recent Calls & Data Capture</h4>
                                    <div className="space-y-3">
                                        {calls.map((call) => {
                                            const missing = Array.isArray(call.missing_fields) ? call.missing_fields : [];
                                            const needsReview = call.needs_human_review || (!call.full_name && !call.email && !call.email_confirmed);
                                            return (
                                                <div key={call.id} className="flex flex-col text-xs text-zinc-300 border-b border-zinc-800 pb-3 last:border-0 last:pb-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold capitalize text-sm text-zinc-100">{call.full_name || 'Unknown Caller'}</span>
                                                            <span className="text-[11px] text-zinc-500">
                                                                {call.from_number || call.caller_phone || 'Unknown'} → <span className="capitalize">{call.direction || 'inbound'}</span>
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block capitalize font-semibold">{call.status || 'unknown'}</span>
                                                            <span className="text-[11px] text-zinc-500">{new Date(call.created_at).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium">Email:</span>
                                                                {call.email ? (
                                                                    <span className="text-zinc-200">{call.email}</span>
                                                                ) : (
                                                                    <span className="text-zinc-500 italic">Not Captured</span>
                                                                )}
                                                                {call.email_confirmed && <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">Confirmed</span>}
                                                            </div>
                                                            <div className="flex items-start gap-2">
                                                                <span className="font-medium">Missing:</span>
                                                                {missing.length > 0 ? (
                                                                    <span className="text-amber-500">{missing.join(', ')}</span>
                                                                ) : (
                                                                    <span className="text-zinc-500 italic">None</span>
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
                                    <h3 className="text-xl font-bold text-white">Conversation AI</h3>
                                    <p className="text-sm text-zinc-500">Handles SMS, Email, and Webchat inquiries automatically.</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={chatConfig.enabled} onChange={() => setChatConfig({ ...chatConfig, enabled: !chatConfig.enabled })} className="sr-only peer" />
                                    <div className="peer relative h-6 w-11 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-800"></div>
                                    <span className="ml-3 text-sm font-medium text-zinc-300">{chatConfig.enabled ? 'Active' : 'Paused'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="group cursor-pointer rounded-xl border border-zinc-800 bg-[#111113] p-6 transition-colors hover:border-violet-500" onClick={() => setChatConfig({ ...chatConfig, tone: 'Professional' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white">Professional</h4>
                                        {chatConfig.tone === 'Professional' && <CheckCircle className="h-5 w-5 text-violet-400" />}
                                    </div>
                                    <p className="text-sm text-zinc-500">Concise, polite, and strictly business-focused.</p>
                                </div>
                                <div className="group cursor-pointer rounded-xl border border-zinc-800 bg-[#111113] p-6 transition-colors hover:border-violet-500" onClick={() => setChatConfig({ ...chatConfig, tone: 'Friendly' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white">Friendly & Casual</h4>
                                        {chatConfig.tone === 'Friendly' && <CheckCircle className="h-5 w-5 text-violet-400" />}
                                    </div>
                                    <p className="text-sm text-zinc-500">Uses emojis, warmer language, and exclamation points.</p>
                                </div>
                                <div className="group cursor-pointer rounded-xl border border-zinc-800 bg-[#111113] p-6 transition-colors hover:border-violet-500" onClick={() => setChatConfig({ ...chatConfig, tone: 'Empathetic' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white">Empathetic</h4>
                                        {chatConfig.tone === 'Empathetic' && <CheckCircle className="h-5 w-5 text-violet-400" />}
                                    </div>
                                    <p className="text-sm text-zinc-500">Best for healthcare. Patient, understanding, and soft.</p>
                                </div>
                                <div className="group cursor-pointer rounded-xl border border-zinc-800 bg-[#111113] p-6 transition-colors hover:border-violet-500" onClick={() => setChatConfig({ ...chatConfig, tone: 'Funny' })}>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white">Witty</h4>
                                        {chatConfig.tone === 'Funny' && <CheckCircle className="h-5 w-5 text-violet-400" />}
                                    </div>
                                    <p className="text-sm text-zinc-500">Uses humor and slang. Good for modern lifestyle brands.</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <h4 className="mb-4 flex items-center gap-2 font-bold text-white">
                                    <Sliders className="h-4 w-4 text-violet-400" /> Advanced Settings
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-zinc-300">Minimum Confidence Score</span>
                                        <span className="text-sm font-bold text-violet-400">90%</span>
                                    </div>
                                    <input type="range" className="h-1 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500" defaultValue="90" />
                                    <p className="text-xs text-zinc-500">If AI confidence is below 90%, it will draft a reply for your approval instead of sending.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- REVIEWS TAB --- */}
                    {activeTab === 'reviews' && (
                        <div className="space-y-8 animate-fade-in max-w-3xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white">Reviews AI</h3>
                                    <p className="text-sm text-zinc-500">Auto-respond to customer feedback on Google, Facebook, etc.</p>
                                </div>
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={reviewConfig.enabled} onChange={() => setReviewConfig({ ...reviewConfig, enabled: !reviewConfig.enabled })} className="sr-only peer" />
                                    <div className="peer relative h-6 w-11 rounded-full bg-zinc-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-500 after:bg-white after:transition-all after:content-[''] peer-checked:bg-violet-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-800"></div>
                                    <span className="ml-3 text-sm font-medium text-zinc-300">{reviewConfig.enabled ? 'Active' : 'Paused'}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${reviewConfig.autoReply5Star ? 'border-violet-500/30 bg-violet-500/10' : 'border-zinc-800 bg-[#111113]'}`}>
                                    <div className="pt-1">
                                        <input type="checkbox" checked={reviewConfig.autoReply5Star} onChange={() => setReviewConfig({ ...reviewConfig, autoReply5Star: !reviewConfig.autoReply5Star })} className="h-5 w-5 rounded border-zinc-700 bg-black text-violet-400 accent-violet-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-zinc-200">Auto-Reply to 5-Star Reviews</h4>
                                        <p className="text-sm text-zinc-500 mt-1">AI will post a "Thank You" message immediately. It varies the language to avoid looking robotic.</p>
                                    </div>
                                </div>

                                <div className={`flex items-start gap-4 rounded-xl border p-4 transition-all ${reviewConfig.autoReply4Star ? 'border-violet-500/30 bg-violet-500/10' : 'border-zinc-800 bg-[#111113]'}`}>
                                    <div className="pt-1">
                                        <input type="checkbox" checked={reviewConfig.autoReply4Star} onChange={() => setReviewConfig({ ...reviewConfig, autoReply4Star: !reviewConfig.autoReply4Star })} className="h-5 w-5 rounded border-zinc-700 bg-black text-violet-400 accent-violet-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-zinc-200">Auto-Reply to 4-Star Reviews</h4>
                                        <p className="text-sm text-zinc-500 mt-1">AI will thank them and gently ask what could make it 5 stars.</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-[#111113] p-4 opacity-75">
                                    <div className="pt-1">
                                        <input type="checkbox" disabled className="h-5 w-5 rounded border-zinc-700 bg-zinc-800 text-zinc-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-zinc-400">Auto-Reply to Negative Reviews (1-3 Stars)</h4>
                                        <p className="mt-1 text-sm text-zinc-500">Disabled for safety. AI will draft a reply for your approval in the Reviews Dashboard.</p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-[#111113] p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="h-4 w-4 text-zinc-500" />
                                    <h4 className="font-bold text-white">Response Delay</h4>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input type="range" min="0" max="24" value={reviewConfig.delayHours} onChange={(e) => setReviewConfig({ ...reviewConfig, delayHours: parseInt(e.target.value) })} className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500" />
                                    <span className="text-sm font-bold min-w-[60px]">{reviewConfig.delayHours} Hours</span>
                                </div>
                                <p className="mt-2 text-xs text-zinc-500">Adding a delay makes the response feel more human.</p>
                            </div>
                        </div>
                    )}

                    {/* --- KNOWLEDGE TAB --- */}
                    {activeTab === 'knowledge' && (
                        <div className="space-y-6 animate-fade-in max-w-3xl">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white">Knowledge Base</h3>
                                    <p className="text-sm text-zinc-500">Upload documents to train your AI Employee.</p>
                                </div>
                                <button onClick={handleTrainAI} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-violet-400">
                                    Retrain AI
                                </button>
                            </div>

                            <div className="group cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 bg-[#111113] p-8 text-center transition-colors hover:border-violet-500">
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] transition-colors group-hover:bg-violet-900/20">
                                    <Upload className="w-6 h-6 text-zinc-400 group-hover:text-violet-400" />
                                </div>
                                <p className="text-sm font-medium text-zinc-300 group-hover:text-violet-400 transition-colors">Click to upload Price Lists, FAQs, or Service Menus</p>
                                <p className="mt-1 text-xs text-zinc-500">PDF, DOCX, TXT supported (Max 10MB)</p>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-zinc-400 uppercase mb-3">Active Documents</h4>
                                <div className="space-y-2">
                                    {chatConfig.knowledgeBaseFiles.map((file, i) => (
                                        <div key={i} className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-[#111113] p-3 transition-all">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-violet-900/30 p-2 text-violet-400">
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-zinc-200">{file}</p>
                                                    <p className="text-[10px] text-zinc-500">Synced just now</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setChatConfig({ ...chatConfig, knowledgeBaseFiles: chatConfig.knowledgeBaseFiles.filter(f => f !== file) })}
                                                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-900/20 hover:text-red-400"
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
