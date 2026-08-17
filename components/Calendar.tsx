'use client';

import React, { useCallback, useState } from 'react';
import { Appointment } from '@/types';
import {
    calendarCellDateKey,
    dateTimeFromWallClock,
    formatTimeInZone,
    getZonedDateKey,
    getZonedHourMinute,
    isSameCalendarDay,
    wallClockFromInstant,
} from '@/lib/calendar/timezone';
import { useApp } from '@/contexts/AppContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ChevronLeft, ChevronRight, Plus, Clock, User, CheckCircle, X, Calendar as CalendarIcon, Trash2, Loader2 } from 'lucide-react';

import { ContactSuggestInput, createContactFromTypedName } from '@/components/ui/ContactSuggestInput';

function emptyNewBooking(date = getZonedDateKey(new Date())) {
    return {
        title: '',
        contactId: '',
        date,
        startTime: '09:00',
        endTime: '10:00',
        type: 'Service' as const,
    };
}

export const Calendar: React.FC = () => {
    const {
        bookings: allBookings,
        bookingsLoading,
        bookingsError,
        contacts,
        contactsLoading,
        addContact,
        reloadContacts,
        addBooking,
        updateBooking,
        deleteBooking,
    } = useApp();
    const createContactForBooking = useCallback(
        (name: string) => createContactFromTypedName(addContact, name),
        [addContact]
    );
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [hoveredAppointmentId, setHoveredAppointmentId] = useState<string | null>(null);
    const [hoveredTooltipRect, setHoveredTooltipRect] = useState<{ left: number; top: number; width: number } | null>(null);
    const [editForm, setEditForm] = useState<{ title: string; contactId: string; date: string; startTime: string; endTime: string; type: Appointment['type']; status: Appointment['status'] } | null>(null);
    const [newBooking, setNewBooking] = useState(emptyNewBooking);
    const [bookingFormError, setBookingFormError] = useState<string | null>(null);
    const [isSavingBooking, setIsSavingBooking] = useState(false);
    const [editFormError, setEditFormError] = useState<string | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [calendarFilters, setCalendarFilters] = useState({
        consultation: true,
        followUp: true,
        service: true,
    });

    const appointments = React.useMemo(() => allBookings.filter((appt) => {
        if (appt.type === 'Consultation' && !calendarFilters.consultation) return false;
        if (appt.type === 'Checkup' && !calendarFilters.followUp) return false;
        if (appt.type === 'Service' && !calendarFilters.service) return false;
        return true;
    }), [allBookings, calendarFilters]);

    const FIRST_HOUR = 8;
    const LAST_HOUR = 22;
    const HOUR_HEIGHT = 64;
    const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => i + FIRST_HOUR); // 8 AM to 10 PM

    // --- Navigation Handlers ---
    const handlePrevious = () => {
        const newDate = new Date(currentDate);
        if (view === 'Day') newDate.setDate(currentDate.getDate() - 1);
        if (view === 'Week') newDate.setDate(currentDate.getDate() - 7);
        if (view === 'Month') newDate.setMonth(currentDate.getMonth() - 1);
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (view === 'Day') newDate.setDate(currentDate.getDate() + 1);
        if (view === 'Week') newDate.setDate(currentDate.getDate() + 7);
        if (view === 'Month') newDate.setMonth(currentDate.getMonth() + 1);
        setCurrentDate(newDate);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const openNewBookingModal = (date?: Date) => {
        setBookingFormError(null);
        setNewBooking(emptyNewBooking(date ? calendarCellDateKey(date) : getZonedDateKey(new Date())));
        setIsModalOpen(true);
        void reloadContacts();
    };

    const handleSaveBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSavingBooking) return;
        setBookingFormError(null);

        const title = newBooking.title.trim();
        if (!title) {
            setBookingFormError('Enter a title.');
            return;
        }
        if (!newBooking.contactId) {
            setBookingFormError('Type and select a contact, or add a new one from suggestions.');
            return;
        }

        let startAt: Date;
        let endAt: Date;
        try {
            startAt = dateTimeFromWallClock(newBooking.date, newBooking.startTime);
            endAt = dateTimeFromWallClock(newBooking.date, newBooking.endTime);
        } catch (err) {
            setBookingFormError(err instanceof Error ? err.message : 'Enter a valid date and time.');
            return;
        }
        if (endAt.getTime() <= startAt.getTime()) {
            endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
        }

        setIsSavingBooking(true);
        try {
            const created = await addBooking({
                contactId: newBooking.contactId,
                title,
                startAt,
                endAt,
                type: newBooking.type,
                status: 'Pending',
            });
            if (!created) {
                setBookingFormError('Failed to create booking. Try again.');
                return;
            }
            setIsModalOpen(false);
            setNewBooking(emptyNewBooking());
        } catch (err) {
            setBookingFormError(err instanceof Error ? err.message : 'Failed to create booking.');
        } finally {
            setIsSavingBooking(false);
        }
    };

    const openEventDetail = (appt: Appointment) => {
        setSelectedAppointment(appt);
        setEditFormError(null);
        const startClock = wallClockFromInstant(appt.start);
        const endClock = wallClockFromInstant(appt.end);
        setEditForm({
            title: appt.title,
            contactId: appt.contactId ?? '',
            date: startClock.date,
            startTime: startClock.time,
            endTime: endClock.time,
            type: appt.type,
            status: appt.status,
        });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAppointment || !editForm || isSavingEdit) return;
        setEditFormError(null);
        if (!editForm.title.trim()) {
            setEditFormError('Enter a title.');
            return;
        }
        if (!editForm.contactId) {
            setEditFormError('Select a contact from your CRM.');
            return;
        }

        let start: Date;
        let end: Date;
        try {
            start = dateTimeFromWallClock(editForm.date, editForm.startTime);
            end = dateTimeFromWallClock(editForm.date, editForm.endTime);
        } catch (err) {
            setEditFormError(err instanceof Error ? err.message : 'Enter a valid date and time.');
            return;
        }
        if (end.getTime() <= start.getTime()) {
            end = new Date(start.getTime() + 60 * 60 * 1000);
        }

        setIsSavingEdit(true);
        try {
            await updateBooking(selectedAppointment.id, {
                title: editForm.title.trim(),
                contactId: editForm.contactId,
                start,
                end,
                type: editForm.type,
                status: editForm.status,
            });
            setSelectedAppointment(null);
            setEditForm(null);
        } catch (err) {
            setEditFormError(err instanceof Error ? err.message : 'Failed to save booking.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleDeleteBooking = async () => {
        if (!selectedAppointment || isSavingEdit) return;
        if (!confirm('Delete this booking?')) return;
        setEditFormError(null);
        setIsSavingEdit(true);
        try {
            await deleteBooking(selectedAppointment.id);
            setSelectedAppointment(null);
            setEditForm(null);
        } catch (err) {
            setEditFormError(err instanceof Error ? err.message : 'Failed to delete booking.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const handleEventMouseEnter = (appt: Appointment, e: React.MouseEvent<HTMLElement>) => {
        setHoveredAppointmentId(appt.id);
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredTooltipRect({ left: rect.left, top: rect.top, width: rect.width });
    };

    const handleEventMouseLeave = () => {
        setHoveredAppointmentId(null);
        setHoveredTooltipRect(null);
    };

    // --- Date Helpers ---
    const getWeekDays = (baseDate: Date) => {
        const days = [];
        const currentDay = baseDate.getDay(); // 0 is Sunday
        const startDate = new Date(baseDate);
        startDate.setDate(baseDate.getDate() - currentDay); // Go to Sunday

        for (let i = 0; i < 7; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const getMonthDays = (baseDate: Date) => {
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Start on Sunday before 1st

        const endDate = new Date(lastDay);
        // Fill until the end of the week of the last day
        if (endDate.getDay() !== 6) {
            endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
        }

        let d = new Date(startDate);
        while (d <= endDate) {
            days.push(new Date(d));
            d.setDate(d.getDate() + 1);
        }
        return days;
    };

    const isSameDate = (d1: Date, d2: Date) => isSameCalendarDay(d1, d2);

    const formatApptTime = (date: Date) => formatTimeInZone(date);

    const getAppointmentEnd = (appt: Appointment): Date =>
        appt.end.getTime() <= appt.start.getTime()
            ? new Date(appt.start.getTime() + 30 * 60 * 1000)
            : appt.end;

    const formatApptTimeRange = (appt: Appointment) => {
        const end = getAppointmentEnd(appt);
        return `${formatApptTime(appt.start)} – ${formatApptTime(end)}`;
    };

    const getHeaderText = () => {
        if (view === 'Day') return currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        if (view === 'Month') return currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

        // Week View Range
        const week = getWeekDays(currentDate);
        const start = week[0];
        const end = week[6];
        const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startStr} - ${endStr}`;
    };

    const getApptTheme = (type: Appointment['type']) => {
        if (type === 'Consultation') {
            return {
                bg: 'bg-violet-500/15',
                border: 'border-violet-500/30 border-l-violet-400',
                text: 'text-violet-200',
                badge: 'bg-violet-500/20 text-violet-200',
                hover: 'hover:bg-violet-500/25'
            };
        }
        if (type === 'Checkup') {
            return {
                bg: 'bg-emerald-500/15',
                border: 'border-emerald-500/30 border-l-emerald-400',
                text: 'text-emerald-200',
                badge: 'bg-emerald-500/20 text-emerald-200',
                hover: 'hover:bg-emerald-500/25'
            };
        }
        return {
            bg: 'bg-indigo-500/15',
            border: 'border-indigo-500/30 border-l-indigo-400',
            text: 'text-indigo-200',
            badge: 'bg-indigo-500/20 text-indigo-200',
            hover: 'hover:bg-indigo-500/25'
        };
    };

    const getAppointmentStyle = (appt: Appointment) => {
        const startParts = getZonedHourMinute(appt.start);
        const endParts = getZonedHourMinute(getAppointmentEnd(appt));
        const startHour = startParts.hour + startParts.minute / 60;
        const endHour = endParts.hour + endParts.minute / 60;
        const duration = Math.max(0.25, endHour - startHour);

        const topPx = Math.max(0, (startHour - FIRST_HOUR) * HOUR_HEIGHT);
        const maxTop = (LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT;
        const top = Math.min(topPx, maxTop);
        const height = Math.max(32, duration * HOUR_HEIGHT);

        const theme = getApptTheme(appt.type);
        const colorClass = `${theme.bg} ${theme.border} ${theme.text} border-l-4`;

        return {
            top: `${top}px`,
            height: `${height}px`,
            className: `absolute left-1.5 right-1.5 rounded-lg border p-2.5 text-xs shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer z-10 overflow-hidden min-w-0 ${colorClass}`
        };
    };

    // --- View Renderers ---

    const renderMonthView = () => {
        const days = getMonthDays(currentDate);
        const today = new Date();

        return (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="grid grid-cols-7 border-b border-[#1F1F23]">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                        <div key={day} className="py-2.5 text-center text-[11px] font-semibold tracking-wider text-zinc-500">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-7 auto-rows-fr overflow-hidden">
                    {days.map((day, i) => {
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const isToday = isSameDate(day, today);
                        const isSelected = isSameDate(day, currentDate);
                        const dayAppts = appointments.filter(a => isSameDate(a.start, day));

                        return (
                            <div
                                key={i}
                                onClick={() => setCurrentDate(new Date(day))}
                                className={`group relative min-h-[88px] cursor-pointer border-b border-r border-[#1F1F23] p-2 transition-colors last:border-r-0 hover:bg-white/[0.02] ${
                                    isSelected ? 'bg-violet-500/[0.07] ring-1 ring-inset ring-violet-500/50' : 'bg-[#0B0C0E]'
                                }`}
                            >
                                <div className="mb-1 flex items-start justify-between">
                                    <span
                                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                                            isSelected || isToday
                                                ? 'bg-[#A78BFA] text-zinc-950'
                                                : isCurrentMonth
                                                    ? 'text-zinc-200'
                                                    : 'text-zinc-600'
                                        }`}
                                    >
                                        {day.getDate()}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openNewBookingModal(day);
                                        }}
                                        className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-white/[0.06] hover:text-zinc-200 group-hover:opacity-100"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    {dayAppts.slice(0, 3).map(appt => {
                                        const theme = getApptTheme(appt.type);
                                        return (
                                            <button
                                                key={appt.id}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEventDetail(appt);
                                                }}
                                                onMouseEnter={(e) => handleEventMouseEnter(appt, e)}
                                                onMouseLeave={handleEventMouseLeave}
                                                className={`w-full rounded-md border-l-[3px] px-1.5 py-1 text-left ${theme.bg} ${theme.text} ${theme.border} ${theme.hover}`}
                                            >
                                                <div className="truncate text-[11px] font-bold leading-tight">
                                                    {appt.title || 'Appointment'}
                                                </div>
                                                <div className="truncate text-[10px] leading-tight opacity-80">
                                                    {formatApptTimeRange(appt)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {dayAppts.length > 3 && (
                                        <p className="px-1 text-[10px] font-semibold text-zinc-500">
                                            +{dayAppts.length - 3} more
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderDayView = () => {
        const day = currentDate;
        const dayAppts = appointments.filter(a => isSameDate(a.start, day));

        return (
            <div className="flex-1 flex overflow-y-auto">
                {/* Time Column */}
                <div className="sticky left-0 z-20 w-20 flex-shrink-0 border-r border-[#1F1F23] bg-[#0B0C0E]">
                    {hours.map(hour => (
                        <div key={hour} className="h-16 border-b border-slate-100 dark:border-slate-800 relative">
                            <span className="absolute -top-2.5 right-2 text-xs text-slate-400 font-medium">
                                {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Slots */}
                <div className="flex-1 relative min-w-[300px]">
                    {hours.map(hour => (
                        <div key={hour} className="h-16 border-b border-slate-50 dark:border-slate-800/50"></div>
                    ))}

                    {dayAppts.map(appt => {
                        const style = getAppointmentStyle(appt);
                        return (
                            <div
                                key={appt.id}
                                role="button"
                                tabIndex={0}
                                style={{ top: style.top, height: style.height }}
                                className={`${style.className} cursor-pointer`}
                                onClick={() => openEventDetail(appt)}
                                onMouseEnter={(e) => handleEventMouseEnter(appt, e)}
                                onMouseLeave={handleEventMouseLeave}
                                onKeyDown={(e) => e.key === 'Enter' && openEventDetail(appt)}
                            >
                                <div className="flex justify-between items-start gap-1 min-w-0">
                                    <span className="font-bold truncate text-sm min-w-0 text-slate-800 dark:text-slate-100">{appt.title}</span>
                                    {appt.status === 'Confirmed' && <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-[11px] opacity-90 min-w-0 overflow-hidden text-slate-600 dark:text-slate-350">
                                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate">{appt.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {appt.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] opacity-90 min-w-0 overflow-hidden text-slate-600 dark:text-slate-350">
                                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate min-w-0 font-medium">{appt.contactName || 'No Contact'}</span>
                                </div>
                                <div className="mt-2.5 inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-white/60 dark:bg-black/25 text-slate-500 dark:text-slate-400">{appt.type}</div>
                            </div>
                        );
                    })}

                    {/* Current Time Line (if today) */}
                    {isSameDate(day, new Date()) && (
                        <div className="absolute left-0 right-0 border-t-2 border-red-400 z-20 pointer-events-none" style={{ top: `${Math.max(0, Math.min((new Date().getHours() + new Date().getMinutes() / 60 - FIRST_HOUR) * HOUR_HEIGHT, (LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT))}px` }}>
                            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-red-400"></div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderWeekView = () => {
        const weekDays = getWeekDays(currentDate);

        return (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Week Header */}
                <div className="flex flex-shrink-0 border-b border-[#1F1F23] bg-[#0B0C0E]">
                    <div className="w-16 flex-shrink-0 border-r border-[#1F1F23]"></div>
                    {weekDays.map((date, i) => (
                        <div key={i} className={`flex-1 border-r border-[#1F1F23] py-3 text-center last:border-r-0 ${isSameDate(date, new Date()) ? 'bg-violet-500/5' : ''}`}>
                            <div className={`mb-1 text-xs font-medium uppercase ${isSameDate(date, new Date()) ? 'text-[#A78BFA]' : 'text-zinc-500'}`}>
                                {date.toLocaleString('default', { weekday: 'short' })}
                            </div>
                            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${isSameDate(date, new Date()) ? 'bg-[#A78BFA] text-zinc-950' : 'text-zinc-200'}`}>
                                {date.getDate()}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-1 flex overflow-y-auto">
                    {/* Time Column */}
                    <div className="sticky left-0 z-10 w-16 flex-shrink-0 border-r border-[#1F1F23] bg-[#0B0C0E]">
                        {hours.map(hour => (
                            <div key={hour} className="h-16 border-b border-slate-100 dark:border-slate-800 relative">
                                <span className="absolute -top-2.5 right-2 text-xs text-slate-400 font-medium">
                                    {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Days Columns */}
                    {weekDays.map((date, i) => {
                        const dayAppts = appointments.filter(a => isSameDate(a.start, date));

                        return (
                            <div key={i} className="flex-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0 relative group min-w-[100px]">
                                {/* Background Grid Lines */}
                                {hours.map(hour => (
                                    <div key={hour} className="h-16 border-b border-slate-50 dark:border-slate-800/50"></div>
                                ))}

                                {/* Current Time Indicator */}
                                {isSameDate(date, new Date()) && (
                                    <div className="absolute left-0 right-0 border-t-2 border-red-400 z-10 pointer-events-none" style={{ top: `${Math.max(0, Math.min((new Date().getHours() + new Date().getMinutes() / 60 - FIRST_HOUR) * HOUR_HEIGHT, (LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT))}px` }}>
                                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-red-400"></div>
                                    </div>
                                )}

                                {/* Appointments */}
                                {dayAppts.map(appt => {
                                    const style = getAppointmentStyle(appt);
                                    return (
                                        <div
                                            key={appt.id}
                                            role="button"
                                            tabIndex={0}
                                            style={{ top: style.top, height: style.height }}
                                            className={`${style.className} cursor-pointer`}
                                            onClick={() => openEventDetail(appt)}
                                            onMouseEnter={(e) => handleEventMouseEnter(appt, e)}
                                            onMouseLeave={handleEventMouseLeave}
                                            onKeyDown={(e) => e.key === 'Enter' && openEventDetail(appt)}
                                        >
                                            <div className="flex justify-between items-start gap-1 min-w-0">
                                                <span className="font-bold truncate min-w-0 text-slate-800 dark:text-slate-100">{appt.title}</span>
                                                {appt.status === 'Confirmed' && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />}
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] opacity-90 min-w-0 overflow-hidden text-slate-600 dark:text-slate-350">
                                                <Clock className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate">{appt.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5 text-[10px] opacity-90 min-w-0 overflow-hidden text-slate-600 dark:text-slate-350">
                                                <User className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate min-w-0 font-medium">{appt.contactName || 'No Contact'}</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Hover "Add Slot" effect */}
                                <div className="absolute inset-0 bg-violet-500/5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100"></div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderAgendaView = () => {
        const agendaDays = view === 'Day' ? [currentDate] : getWeekDays(currentDate);

        return (
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 dark:bg-slate-950/40 sm:p-6">
                <div className="space-y-6">
                    {agendaDays.map((day) => {
                        const dayAppts = appointments
                            .filter((appointment) => isSameDate(appointment.start, day))
                            .sort((a, b) => a.start.getTime() - b.start.getTime());

                        return (
                            <section key={day.toISOString()} className="space-y-3">
                                <div className="sticky top-0 z-10 -mx-4 border-y border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:-mx-6 sm:px-6">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-slate-100">
                                                {day.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">{dayAppts.length} appointment{dayAppts.length === 1 ? '' : 's'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openNewBookingModal(day)}
                                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add
                                        </button>
                                    </div>
                                </div>

                                {dayAppts.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                        No bookings scheduled.
                                    </div>
                                ) : (
                                    dayAppts.map((appt) => (
                                        <button
                                            key={appt.id}
                                            type="button"
                                            onClick={() => openEventDetail(appt)}
                                            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800 dark:hover:bg-violet-900/10"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{appt.title}</p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                                                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{appt.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {appt.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                                                        <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{appt.contactName}</span>
                                                    </div>
                                                </div>
                                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{appt.status}</span>
                                            </div>
                                            <p className="mt-3 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{appt.type}</p>
                                        </button>
                                    ))
                                )}
                            </section>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderMiniCalendar = () => {
        const days = getMonthDays(currentDate);
        const monthLabel = currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
        const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

        const shiftMiniMonth = (delta: number) => {
            const next = new Date(currentDate);
            next.setMonth(next.getMonth() + delta);
            setCurrentDate(next);
        };

        return (
            <div>
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{monthLabel}</p>
                    <div className="flex items-center gap-0.5">
                        <button
                            type="button"
                            onClick={() => shiftMiniMonth(-1)}
                            className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                            aria-label="Previous month"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => shiftMiniMonth(1)}
                            className="rounded-md p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                            aria-label="Next month"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-semibold text-zinc-500">
                    {weekdays.map((d, i) => (
                        <span key={`${d}-${i}`}>{d}</span>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                    {days.slice(0, 42).map((day) => {
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const isSelected = isSameDate(day, currentDate);
                        const hasEvents = appointments.some((appt) => isSameCalendarDay(appt.start, day));

                        return (
                            <button
                                key={day.toISOString()}
                                type="button"
                                onClick={() => setCurrentDate(new Date(day))}
                                className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                                    isSelected
                                        ? 'bg-[#A78BFA] text-zinc-950'
                                        : isCurrentMonth
                                            ? 'text-zinc-300 hover:bg-white/[0.06]'
                                            : 'text-zinc-600 hover:bg-white/[0.04]'
                                }`}
                            >
                                {day.getDate()}
                                {hasEvents && !isSelected && (
                                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-violet-400" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    const calendarTypeOptions = [
        { id: 'consultation' as const, label: 'Lead Consultations', accent: 'accent-violet-500' },
        { id: 'followUp' as const, label: 'Follow-up Calls', accent: 'accent-emerald-500' },
        { id: 'service' as const, label: 'Service Visits', accent: 'accent-zinc-500' },
    ];

    if (bookingsLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-zinc-500">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading calendar…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            {bookingsError && (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                    {bookingsError}
                </div>
            )}
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-[#1F1F23] bg-[#0B0C0E]">
                <aside className="hidden w-64 shrink-0 flex-col border-r border-[#1F1F23] p-4 lg:flex">
                    {renderMiniCalendar()}
                    <div className="mt-6">
                        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Calendars</h3>
                        <div className="space-y-2">
                            {calendarTypeOptions.map((option) => (
                                <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-white/[0.03]">
                                    <input
                                        type="checkbox"
                                        checked={calendarFilters[option.id]}
                                        onChange={(e) =>
                                            setCalendarFilters((prev) => ({ ...prev, [option.id]: e.target.checked }))
                                        }
                                        className={`h-4 w-4 rounded border-zinc-600 bg-[#121214] ${option.accent}`}
                                    />
                                    <span className="text-sm font-medium text-zinc-300">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => openNewBookingModal()}
                        className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-[#A78BFA] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-violet-300"
                    >
                        <Plus className="h-4 w-4" />
                        New Appointment
                    </button>
                </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-[#1F1F23] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-white">
                            {getHeaderText()}
                        </h2>
                        <button
                            type="button"
                            onClick={handleToday}
                            className="rounded-lg border border-zinc-800 bg-[#141416] px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.04]"
                        >
                            Today
                        </button>
                        <div className="flex items-center">
                            <button type="button" onClick={handlePrevious} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={handleNext} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex rounded-lg border border-zinc-800 bg-[#141416] p-0.5">
                            {['Day', 'Week', 'Month'].map(v => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setView(v as 'Day' | 'Week' | 'Month')}
                                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                                        view === v
                                            ? 'bg-[#A78BFA] text-zinc-950'
                                            : 'text-zinc-400 hover:text-zinc-200'
                                    }`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => openNewBookingModal()}
                            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#A78BFA] px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-violet-300 lg:hidden"
                        >
                            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Appointment</span><span className="sm:hidden">New</span>
                        </button>
                    </div>
                </div>

                {/* Dynamic View Content */}
                {view === 'Month' && renderMonthView()}
                {view === 'Day' && (isMobile ? renderAgendaView() : renderDayView())}
                {view === 'Week' && (isMobile ? renderAgendaView() : renderWeekView())}
            </div>
            </div>

            {/* Hover tooltip */}
            {hoveredAppointmentId && hoveredTooltipRect && (() => {
                const appt = appointments.find(a => a.id === hoveredAppointmentId);
                if (!appt) return null;
                return (
                    <div
                        className="fixed z-[100] px-3 py-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs max-w-[280px] pointer-events-none"
                        style={{
                            left: hoveredTooltipRect.left,
                            top: hoveredTooltipRect.top - 8,
                            transform: 'translateY(-100%)',
                            width: Math.max(hoveredTooltipRect.width, 200),
                        }}
                    >
                        <div className="font-bold text-sm mb-1">{appt.title}</div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            {formatApptTimeRange(appt)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-slate-600 dark:text-slate-300">
                            <User className="w-3 h-3 flex-shrink-0" />
                            {appt.contactName}
                        </div>
                        <div className="mt-1 text-slate-500 dark:text-slate-400">{appt.type} · {appt.status}</div>
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500">Click to edit</div>
                    </div>
                );
            })()}

            {/* Event detail / edit modal */}
            {selectedAppointment && editForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="booking-details-title">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90dvh] overflow-y-auto">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <h3 id="booking-details-title" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-violet-600" /> Booking details
                            </h3>
                            <button onClick={() => { setSelectedAppointment(null); setEditForm(null); }} aria-label="Close booking details" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="edit-booking-title" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Title / Service</label>
                                <input
                                    id="edit-booking-title"
                                    required
                                    type="text"
                                    value={editForm.title}
                                    onChange={e => setEditForm(prev => prev ? { ...prev, title: e.target.value } : null)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="edit-booking-contact" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact</label>
                                <ContactSuggestInput
                                    id="edit-booking-contact"
                                    contacts={contacts}
                                    contactId={editForm.contactId}
                                    onContactIdChange={id => setEditForm(prev => prev ? { ...prev, contactId: id } : null)}
                                    onCreateContact={createContactForBooking}
                                    loading={contactsLoading}
                                    disabled={isSavingEdit}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="edit-booking-date" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                                    <input
                                        id="edit-booking-date"
                                        required
                                        type="date"
                                        value={editForm.date}
                                        onChange={e => setEditForm(prev => prev ? { ...prev, date: e.target.value } : null)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-booking-status" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                                    <select
                                        id="edit-booking-status"
                                        value={editForm.status}
                                        onChange={e => setEditForm(prev => prev ? { ...prev, status: e.target.value as Appointment['status'] } : null)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Confirmed">Confirmed</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="edit-booking-type" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                                    <select
                                        id="edit-booking-type"
                                        value={editForm.type}
                                        onChange={e => setEditForm(prev => prev ? { ...prev, type: e.target.value as Appointment['type'] } : null)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    >
                                        <option value="Service">Service</option>
                                        <option value="Consultation">Consultation</option>
                                        <option value="Checkup">Checkup</option>
                                    </select>
                                </div>
                                <div />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="edit-booking-start-time" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Start Time</label>
                                    <input
                                        id="edit-booking-start-time"
                                        required
                                        type="time"
                                        value={editForm.startTime}
                                        onChange={e => setEditForm(prev => prev ? { ...prev, startTime: e.target.value } : null)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-booking-end-time" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">End Time</label>
                                    <input
                                        id="edit-booking-end-time"
                                        required
                                        type="time"
                                        value={editForm.endTime}
                                        onChange={e => setEditForm(prev => prev ? { ...prev, endTime: e.target.value } : null)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {editFormError && (
                                <p className="text-sm font-medium text-red-500">{editFormError}</p>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleDeleteBooking}
                                    disabled={isSavingEdit}
                                    className="flex items-center justify-center gap-2 py-2.5 px-4 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { if (!isSavingEdit) { setSelectedAppointment(null); setEditForm(null); } }}
                                    disabled={isSavingEdit}
                                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingEdit}
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {isSavingEdit ? 'Saving…' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* New Booking Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="new-booking-title">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90dvh] overflow-y-auto">
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                            <h3 id="new-booking-title" className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-violet-600" /> New Appointment
                            </h3>
                            <button onClick={() => !isSavingBooking && setIsModalOpen(false)} disabled={isSavingBooking} aria-label="Close new appointment dialog" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-50">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBooking} className="p-6 space-y-4">
                            <div>
                                <label htmlFor="new-booking-service" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Title / Service</label>
                                <input
                                    id="new-booking-service"
                                    required
                                    type="text"
                                    placeholder="e.g. Plumbing Checkup"
                                    value={newBooking.title}
                                    onChange={e => setNewBooking({ ...newBooking, title: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="new-booking-contact" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact</label>
                                <ContactSuggestInput
                                    id="new-booking-contact"
                                    contacts={contacts}
                                    contactId={newBooking.contactId}
                                    onContactIdChange={id => setNewBooking(prev => ({ ...prev, contactId: id }))}
                                    onCreateContact={createContactForBooking}
                                    loading={contactsLoading}
                                    disabled={isSavingBooking}
                                    placeholder="Type name, phone, or email for suggestions…"
                                />
                                <p className="mt-1.5 text-[11px] text-zinc-500">
                                    Type to search CRM contacts. Pick a suggestion or add a new contact from the list.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-booking-date" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Date</label>
                                    <input
                                        id="new-booking-date"
                                        required
                                        type="date"
                                        value={newBooking.date}
                                        onChange={e => setNewBooking({ ...newBooking, date: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="new-booking-type" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                                    <select
                                        id="new-booking-type"
                                        value={newBooking.type}
                                        onChange={e => setNewBooking({ ...newBooking, type: e.target.value as any })}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    >
                                        <option value="Service">Service</option>
                                        <option value="Consultation">Consultation</option>
                                        <option value="Checkup">Checkup</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="new-booking-start-time" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Start Time</label>
                                    <input
                                        id="new-booking-start-time"
                                        required
                                        type="time"
                                        value={newBooking.startTime}
                                        onChange={e => setNewBooking({ ...newBooking, startTime: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="new-booking-end-time" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">End Time</label>
                                    <input
                                        id="new-booking-end-time"
                                        required
                                        type="time"
                                        value={newBooking.endTime}
                                        onChange={e => setNewBooking({ ...newBooking, endTime: e.target.value })}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {bookingFormError && (
                                <p className="text-sm font-medium text-red-500">{bookingFormError}</p>
                            )}

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => !isSavingBooking && setIsModalOpen(false)}
                                    disabled={isSavingBooking}
                                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingBooking || contactsLoading}
                                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {isSavingBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {isSavingBooking ? 'Creating…' : 'Create Booking'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
