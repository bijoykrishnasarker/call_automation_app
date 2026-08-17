'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Contact, Notification, CRMActionRequest, Message, Pipeline, PipelineStage, Deal, Appointment } from '@/types';
import { MOCK_MESSAGES, INITIAL_NOTIFICATIONS } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchContacts, createContact, updateContact as updateContactApi, deleteContact as deleteContactApi } from '@/lib/supabase/contacts';
import {
    fetchPipelinesWithStages,
    createPipeline as createPipelineApi,
    addStage as addStageApi,
    updateStage as updateStageApi,
    deleteStage as deleteStageApi,
} from '@/lib/supabase/pipelines';
import { fetchDeals, createDeal as createDealApi, updateDeal as updateDealApi } from '@/lib/supabase/deals';
import {
    DealTemplate,
    fetchDealTemplates,
    createDealTemplate as createDealTemplateApi,
    updateDealTemplate as updateDealTemplateApi,
    deleteDealTemplate as deleteDealTemplateApi,
} from '@/lib/supabase/deal_templates';
import {
    fetchBookings,
    mapBookingsWithContactNames,
    createBooking as createBookingApi,
    updateBooking as updateBookingApi,
    deleteBooking as deleteBookingApi,
    BookingRow,
} from '@/lib/supabase/bookings';

interface AppContextType {
    contacts: Contact[];
    contactsLoading: boolean;
    contactsError: string | null;
    clearContactsError: () => void;
    addContact: (contact: Contact) => Promise<Contact | null>;
    updateContact: (contact: Contact) => Promise<void>;
    deleteContact: (contactId: string) => Promise<void>;
    messages: Message[];
    pipelines: Pipeline[];
    pipelinesLoading: boolean;
    pipelinesError: string | null;
    deals: Deal[];
    addDeal: (deal: Omit<Deal, 'id'>) => Promise<Deal | null>;
    updateDeal: (dealId: string, payload: Partial<Pick<Deal, 'stageId' | 'title' | 'value' | 'contactId'>>) => Promise<void>;
    createPipeline: (name: string) => Promise<Pipeline | null>;
    addStage: (pipelineId: string, stage: { name: string; color: string; hasAutomation?: boolean }) => Promise<PipelineStage | null>;
    updateStage: (stageId: string, payload: { name?: string; color?: string; hasAutomation?: boolean }) => Promise<void>;
    deleteStage: (stageId: string) => Promise<void>;
    dealTemplates: DealTemplate[];
    dealTemplatesLoading: boolean;
    createDealTemplate: (template: { name: string; value: number }) => Promise<DealTemplate | null>;
    updateDealTemplate: (templateId: string, payload: { name?: string; value?: number }) => Promise<void>;
    deleteDealTemplate: (templateId: string) => Promise<void>;
    bookings: Appointment[];
    bookingsLoading: boolean;
    bookingsError: string | null;
    addBooking: (payload: { contactId: string; title: string; startAt: Date; endAt: Date; type: Appointment['type']; status?: Appointment['status'] }) => Promise<Appointment | null>;
    updateBooking: (bookingId: string, payload: Partial<Pick<Appointment, 'contactId' | 'title' | 'start' | 'end' | 'type' | 'status'>>) => Promise<void>;
    deleteBooking: (bookingId: string) => Promise<void>;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    darkMode: boolean;
    toggleDarkMode: () => void;
    crmAction: CRMActionRequest | undefined;
    setCrmAction: (action: CRMActionRequest | undefined) => void;
    unreadCount: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const { darkMode, toggleDarkMode } = useTheme();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsLoading, setContactsLoading] = useState(true);
    const [contactsError, setContactsError] = useState<string | null>(null);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [pipelinesLoading, setPipelinesLoading] = useState(true);
    const [pipelinesError, setPipelinesError] = useState<string | null>(null);
    const [deals, setDeals] = useState<Deal[]>([]);
    const [dealTemplates, setDealTemplates] = useState<DealTemplate[]>([]);
    const [dealTemplatesLoading, setDealTemplatesLoading] = useState(true);
    const [bookingRows, setBookingRows] = useState<BookingRow[]>([]);
    const [bookingsLoading, setBookingsLoading] = useState(true);
    const [bookingsError, setBookingsError] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
    const [crmAction, setCrmAction] = useState<CRMActionRequest | undefined>(undefined);

    useEffect(() => {
        if (!user?.id) {
            setContacts([]);
            setContactsLoading(false);
            return;
        }
        let cancelled = false;
        setContactsLoading(true);
        setContactsError(null);
        fetchContacts(user.id)
            .then(data => {
                if (!cancelled) setContacts(data);
            })
            .catch(err => {
                if (!cancelled) setContactsError(err?.message ?? 'Failed to load contacts');
            })
            .finally(() => {
                if (!cancelled) setContactsLoading(false);
            });
        return () => { cancelled = true; };
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) {
            setPipelines([]);
            setDeals([]);
            setPipelinesLoading(false);
            return;
        }
        let cancelled = false;
        setPipelinesLoading(true);
        setPipelinesError(null);
        Promise.all([fetchPipelinesWithStages(user.id), fetchDeals(user.id)])
            .then(([p, d]) => {
                if (!cancelled) {
                    setPipelines(p);
                    setDeals(d);
                }
            })
            .catch(err => {
                if (!cancelled) setPipelinesError(err?.message ?? 'Failed to load pipelines');
            })
            .finally(() => {
                if (!cancelled) setPipelinesLoading(false);
            });
        return () => { cancelled = true; };
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) {
            setDealTemplates([]);
            setDealTemplatesLoading(false);
            return;
        }
        let cancelled = false;
        setDealTemplatesLoading(true);
        fetchDealTemplates(user.id)
            .then(data => {
                if (!cancelled) setDealTemplates(data);
            })
            .catch(() => {
                if (!cancelled) setDealTemplates([]);
            })
            .finally(() => {
                if (!cancelled) setDealTemplatesLoading(false);
            });
        return () => { cancelled = true; };
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id) {
            setBookingRows([]);
            setBookingsLoading(false);
            return;
        }
        let cancelled = false;

        const loadBookings = (showSpinner: boolean) => {
            if (showSpinner) {
                setBookingsLoading(true);
                setBookingsError(null);
            }
            fetchBookings(user.id)
                .then(rows => {
                    if (!cancelled) setBookingRows(rows);
                })
                .catch(err => {
                    if (!cancelled) setBookingsError(err?.message ?? 'Failed to load bookings');
                })
                .finally(() => {
                    if (!cancelled && showSpinner) setBookingsLoading(false);
                });
        };

        const loadContacts = () => {
            fetchContacts(user.id)
                .then(data => {
                    if (!cancelled) setContacts(data);
                })
                .catch(() => {
                    /* keep existing contacts */
                });
        };

        loadBookings(true);

        const onFocus = () => {
            loadBookings(false);
            loadContacts();
        };
        window.addEventListener('focus', onFocus);
        const interval = window.setInterval(onFocus, 8000);

        return () => {
            cancelled = true;
            window.removeEventListener('focus', onFocus);
            window.clearInterval(interval);
        };
    }, [user?.id]);

    const getContactName = useCallback((contactId: string) => {
        const c = contacts.find(x => x.id === contactId);
        return c ? `${c.firstName} ${c.lastName}` : 'Unknown';
    }, [contacts]);

    const bookings = useMemo(
        () => mapBookingsWithContactNames(bookingRows, getContactName),
        [bookingRows, getContactName]
    );

    const clearContactsError = useCallback(() => setContactsError(null), []);

    const addContact = useCallback(
        async (contact: Contact): Promise<Contact | null> => {
            if (!user?.id) throw new Error('Sign in to add contacts.');
            try {
                const created = await createContact(user.id, contact);
                setContacts(prev => [created, ...prev.filter(c => c.id !== created.id)]);
                setContactsError(null);
                return created;
            } catch (err) {
                const message =
                    err instanceof Error && err.message.trim()
                        ? err.message
                        : (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
                            ? (err as { message: string }).message
                            : 'Failed to add contact');
                throw new Error(message);
            }
        },
        [user?.id]
    );

    const updateContact = useCallback(
        async (contact: Contact): Promise<void> => {
            if (!user?.id) return;
            try {
                const updated = await updateContactApi(user.id, contact);
                setContacts(prev => prev.map(c => (c.id === contact.id ? updated : c)));
            } catch (err) {
                const message =
                    err instanceof Error && err.message.trim()
                        ? err.message
                        : (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
                            ? (err as { message: string }).message
                            : 'Failed to update contact');
                throw new Error(message);
            }
        },
        [user?.id]
    );

    const deleteContact = useCallback(
        async (contactId: string): Promise<void> => {
            if (!user?.id) return;
            try {
                await deleteContactApi(user.id, contactId);
                setDeals(prev => prev.filter(d => d.contactId !== contactId));
                setBookingRows(prev => prev.filter(r => r.contact_id !== contactId));
                setContacts(prev => prev.filter(c => c.id !== contactId));
            } catch (err) {
                const message =
                    err instanceof Error && err.message.trim()
                        ? err.message
                        : (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string'
                            ? (err as { message: string }).message
                            : 'Failed to delete contact');
                throw new Error(message);
            }
        },
        [user?.id]
    );

    const addDeal = useCallback(
        async (deal: Omit<Deal, 'id'>): Promise<Deal | null> => {
            if (!user?.id) return null;
            try {
                const created = await createDealApi(user.id, deal);
                setDeals(prev => [created, ...prev]);
                return created;
            } catch (err) {
                setPipelinesError(err instanceof Error ? err.message : 'Failed to add deal');
                return null;
            }
        },
        [user?.id]
    );

    const updateDeal = useCallback(
        async (dealId: string, payload: Partial<Pick<Deal, 'stageId' | 'title' | 'value' | 'contactId'>>): Promise<void> => {
            try {
                await updateDealApi(dealId, payload);
                setDeals(prev =>
                    prev.map(d =>
                        d.id === dealId
                            ? { ...d, ...payload }
                            : d
                    )
                );
            } catch (err) {
                setPipelinesError(err instanceof Error ? err.message : 'Failed to update deal');
                throw err;
            }
        },
        []
    );

    const createPipeline = useCallback(
        async (name: string): Promise<Pipeline | null> => {
            if (!user?.id) return null;
            try {
                const created = await createPipelineApi(user.id, name);
                setPipelines(prev => [...prev, created]);
                return created;
            } catch (err) {
                setPipelinesError(err instanceof Error ? err.message : 'Failed to create pipeline');
                return null;
            }
        },
        [user?.id]
    );

    const addStage = useCallback(
        async (
            pipelineId: string,
            stage: { name: string; color: string; hasAutomation?: boolean }
        ): Promise<PipelineStage | null> => {
            try {
                const created = await addStageApi(pipelineId, stage);
                setPipelines(prev =>
                    prev.map(p =>
                        p.id === pipelineId
                            ? { ...p, stages: [...p.stages, created] }
                            : p
                    )
                );
                return created;
            } catch (err) {
                setPipelinesError(err instanceof Error ? err.message : 'Failed to add stage');
                return null;
            }
        },
        []
    );

    const updateStage = useCallback(
        async (
            stageId: string,
            payload: { name?: string; color?: string; hasAutomation?: boolean }
        ): Promise<void> => {
            try {
                await updateStageApi(stageId, payload);
                setPipelines(prev =>
                    prev.map(p => ({
                        ...p,
                        stages: p.stages.map(s =>
                            s.id === stageId ? { ...s, ...payload } : s
                        ),
                    }))
                );
            } catch (err) {
                setPipelinesError(err instanceof Error ? err.message : 'Failed to update stage');
                throw err;
            }
        },
        []
    );

    const deleteStage = useCallback(async (stageId: string): Promise<void> => {
        try {
            await deleteStageApi(stageId);
            setPipelines(prev =>
                prev.map(p => ({
                    ...p,
                    stages: p.stages.filter(s => s.id !== stageId),
                }))
            );
        } catch (err) {
            setPipelinesError(err instanceof Error ? err.message : 'Failed to delete stage');
            throw err;
        }
    }, []);

    const createDealTemplate = useCallback(
        async (template: { name: string; value: number }): Promise<DealTemplate | null> => {
            if (!user?.id) return null;
            try {
                const created = await createDealTemplateApi(user.id, template);
                setDealTemplates(prev => [...prev, created].sort((a, b) => a.position - b.position));
                return created;
            } catch {
                return null;
            }
        },
        [user?.id]
    );

    const updateDealTemplate = useCallback(
        async (templateId: string, payload: { name?: string; value?: number }): Promise<void> => {
            try {
                await updateDealTemplateApi(templateId, payload);
                setDealTemplates(prev =>
                    prev.map(t =>
                        t.id === templateId
                            ? {
                                  ...t,
                                  ...(payload.name !== undefined && { name: payload.name }),
                                  ...(payload.value !== undefined && { value: String(payload.value) }),
                              }
                            : t
                    )
                );
            } catch {
                // ignore
            }
        },
        []
    );

    const deleteDealTemplate = useCallback(async (templateId: string): Promise<void> => {
        try {
            await deleteDealTemplateApi(templateId);
            setDealTemplates(prev => prev.filter(t => t.id !== templateId));
        } catch {
            // ignore
        }
    }, []);

    const addBooking = useCallback(
        async (payload: {
            contactId: string;
            title: string;
            startAt: Date;
            endAt: Date;
            type: Appointment['type'];
            status?: Appointment['status'];
        }): Promise<Appointment | null> => {
            if (!user?.id) throw new Error('Sign in to create a booking.');
            try {
                const row = await createBookingApi(user.id, payload);
                setBookingRows(prev => [...prev, row].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()));
                const name = getContactName(payload.contactId);
                return {
                    id: row.id,
                    title: row.title,
                    contactId: row.contact_id,
                    contactName: name,
                    start: new Date(row.start_at),
                    end: new Date(row.end_at),
                    type: row.type as Appointment['type'],
                    status: row.status as Appointment['status'],
                };
            } catch (err) {
                throw err instanceof Error ? err : new Error('Failed to add booking');
            }
        },
        [user?.id, getContactName]
    );

    const updateBooking = useCallback(
        async (
            bookingId: string,
            payload: Partial<Pick<Appointment, 'contactId' | 'title' | 'start' | 'end' | 'type' | 'status'>>
        ): Promise<void> => {
            try {
                const apiPayload: Parameters<typeof updateBookingApi>[1] = {};
                if (payload.contactId !== undefined) apiPayload.contactId = payload.contactId;
                if (payload.title !== undefined) apiPayload.title = payload.title;
                if (payload.start !== undefined) apiPayload.startAt = payload.start;
                if (payload.end !== undefined) apiPayload.endAt = payload.end;
                if (payload.type !== undefined) apiPayload.type = payload.type;
                if (payload.status !== undefined) apiPayload.status = payload.status;
                await updateBookingApi(bookingId, apiPayload);
                setBookingRows(prev =>
                    prev.map(r => {
                        if (r.id !== bookingId) return r;
                        return {
                            ...r,
                            ...(payload.contactId !== undefined && { contact_id: payload.contactId }),
                            ...(payload.title !== undefined && { title: payload.title }),
                            ...(payload.start !== undefined && { start_at: payload.start.toISOString() }),
                            ...(payload.end !== undefined && { end_at: payload.end.toISOString() }),
                            ...(payload.type !== undefined && { type: payload.type }),
                            ...(payload.status !== undefined && { status: payload.status }),
                        };
                    })
                );
            } catch (err) {
                throw err instanceof Error ? err : new Error('Failed to update booking');
            }
        },
        []
    );

    const deleteBooking = useCallback(async (bookingId: string): Promise<void> => {
        try {
            await deleteBookingApi(bookingId);
            setBookingRows(prev => prev.filter(r => r.id !== bookingId));
        } catch (err) {
            throw err instanceof Error ? err : new Error('Failed to delete booking');
        }
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <AppContext.Provider
            value={{
                contacts,
                contactsLoading,
                contactsError,
                clearContactsError,
                addContact,
                updateContact,
                deleteContact,
                messages: MOCK_MESSAGES,
                pipelines,
                pipelinesLoading,
                pipelinesError,
                deals,
                addDeal,
                updateDeal,
                createPipeline,
                addStage,
                updateStage,
                deleteStage,
                dealTemplates,
                dealTemplatesLoading,
                createDealTemplate,
                updateDealTemplate,
                deleteDealTemplate,
                bookings,
                bookingsLoading,
                bookingsError,
                addBooking,
                updateBooking,
                deleteBooking,
                notifications,
                setNotifications,
                darkMode,
                toggleDarkMode,
                crmAction,
                setCrmAction,
                unreadCount,
            }}
        >
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within an AppProvider');
    return context;
}
