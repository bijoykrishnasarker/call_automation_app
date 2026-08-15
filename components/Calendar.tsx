'use client';

import React, { useState } from 'react';
import { Appointment } from '@/types';
import {
    formatTimeInZone,
    getZonedHourMinute,
    isSameCalendarDay,
} from '@/lib/calendar/timezone';
import { useApp } from '@/contexts/AppContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ChevronLeft, ChevronRight, Plus, Clock, User, CheckCircle, X, Calendar as CalendarIcon, Trash2 } from 'lucide-react';

export const Calendar: React.FC = () => {
    const { bookings: appointments, bookingsLoading, bookingsError, contacts, addBooking, updateBooking, deleteBooking } = useApp();
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [view, setView] = useState<'Day' | 'Week' | 'Month'>('Week');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
    const [hoveredAppointmentId, setHoveredAppointmentId] = useState<string | null>(null);
    const [hoveredTooltipRect, setHoveredTooltipRect] = useState<{ left: number; top: number; width: number } | null>(null);
    const [editForm, setEditForm] = useState<{ title: string; contactId: string; date: string; startTime: string; endTime: string; type: Appointment['type']; status: Appointment['status'] } | null>(null);
    const [newBooking, setNewBooking] = useState({
        title: '',
        contactId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        type: 'Service' as const
    });

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

    const handleSaveBooking = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBooking.contactId || !newBooking.title) return;
        const startAt = new Date(`${newBooking.date}T${newBooking.startTime}`);
        const endAt = new Date(`${newBooking.date}T${newBooking.endTime}`);
        const created = await addBooking({
            contactId: newBooking.contactId,
            title: newBooking.title,
            startAt,
            endAt,
            type: newBooking.type,
            status: 'Pending',
        });
        if (created) {
            setIsModalOpen(false);
            setNewBooking(prev => ({ ...prev, title: '', contactId: '' }));
        }
    };

    const openEventDetail = (appt: Appointment) => {
        setSelectedAppointment(appt);
        const dateStr = appt.start.toISOString().slice(0, 10);
        const startTime = appt.start.toTimeString().slice(0, 5);
        const endTime = appt.end.toTimeString().slice(0, 5);
        setEditForm({
            title: appt.title,
            contactId: appt.contactId ?? '',
            date: dateStr,
            startTime,
            endTime,
            type: appt.type,
            status: appt.status,
        });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAppointment || !editForm || !editForm.contactId || !editForm.title) return;
        const start = new Date(`${editForm.date}T${editForm.startTime}`);
        const end = new Date(`${editForm.date}T${editForm.endTime}`);
        try {
            await updateBooking(selectedAppointment.id, {
                title: editForm.title,
                contactId: editForm.contactId,
                start,
                end,
                type: editForm.type,
                status: editForm.status,
            });
            setSelectedAppointment(null);
            setEditForm(null);
        } catch {
            // error in context
        }
    };

    const handleDeleteBooking = async () => {
        if (!selectedAppointment) return;
        if (!confirm('Delete this booking?')) return;
        try {
            await deleteBooking(selectedAppointment.id);
            setSelectedAppointment(null);
            setEditForm(null);
        } catch {
            // error in context
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
                bg: 'bg-lime-50 dark:bg-lime-950/40',
                border: 'border-lime-200/80 dark:border-lime-800/85 border-l-lime-500 dark:border-l-lime-500',
                text: 'text-lime-700 dark:text-lime-300',
                badge: 'bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300',
                hover: 'hover:bg-lime-100/60 dark:hover:bg-lime-900/20'
            };
        }
        if (type === 'Checkup') {
            return {
                bg: 'bg-purple-50 dark:bg-purple-950/40',
                border: 'border-purple-200/80 dark:border-purple-800/85 border-l-purple-500 dark:border-l-purple-500',
                text: 'text-purple-700 dark:text-purple-300',
                badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
                hover: 'hover:bg-purple-100/60 dark:hover:bg-purple-900/20'
            };
        }
        // Default to Service (Indigo/Blue)
        return {
            bg: 'bg-indigo-50 dark:bg-indigo-950/40',
            border: 'border-indigo-200/80 dark:border-indigo-800/85 border-l-indigo-500 dark:border-l-indigo-500',
            text: 'text-indigo-700 dark:text-indigo-300',
            badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
            hover: 'hover:bg-indigo-100/60 dark:hover:bg-indigo-900/20'
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
            <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] h-full overflow-hidden">
                {/* Weekday Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center py-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-800 last:border-r-0 bg-slate-50 dark:bg-slate-900">
                        {day}
                    </div>
                ))}

                {/* Days Grid */}
                <div className="col-span-7 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                    {days.map((day, i) => {
                        const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                        const isToday = isSameDate(day, today);
                        const dayAppts = appointments.filter(a => isSameDate(a.start, day));

                        return (
                            <div key={i} className={`min-h-[100px] border-b border-r border-slate-200 dark:border-slate-800 p-2 relative group transition-colors hover:bg-slate-50 dark:hover:bg-slate-850/50 ${!isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-950/50 text-slate-400' : 'bg-white dark:bg-slate-900'}`}>
                                <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-1 transition-all ${isToday ? 'bg-lime-600 text-white shadow-sm shadow-lime-600/35 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {day.getDate()}
                                </div>

                                <div className="space-y-1">
                                    {dayAppts.slice(0, 3).map(appt => {
                                        const theme = getApptTheme(appt.type);
                                        return (
                                            <button
                                                key={appt.id}
                                                type="button"
                                                onClick={() => openEventDetail(appt)}
                                                onMouseEnter={(e) => handleEventMouseEnter(appt, e)}
                                                onMouseLeave={handleEventMouseLeave}
                                                className={`w-full text-left rounded-md border-l-[3px] px-1.5 py-1 shadow-sm ${theme.bg} ${theme.text} ${theme.border} ${theme.hover} transition-all duration-150 cursor-pointer`}
                                            >
                                                <div className="text-[11px] font-bold leading-tight truncate">
                                                    {appt.title || 'Appointment'}
                                                </div>
                                                <div className="text-[10px] leading-tight opacity-90 truncate">
                                                    {formatApptTimeRange(appt)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                    {dayAppts.length > 3 && (
                                        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                                            +{dayAppts.length - 3} more
                                        </p>
                                    )}
                                </div>
                                {/* Add Button on Hover */}
                                <button
                                    onClick={() => {
                                        setNewBooking(prev => ({ ...prev, date: day.toISOString().split('T')[0] }));
                                        setIsModalOpen(true);
                                    }}
                                    className="absolute top-2 right-2 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Plus className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                                </button>
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
                <div className="w-20 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 sticky left-0 z-20">
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
                <div className="flex border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10 flex-shrink-0">
                    <div className="w-16 border-r border-slate-200 dark:border-slate-800 flex-shrink-0 bg-slate-50 dark:bg-slate-950/50"></div>
                    {weekDays.map((date, i) => (
                        <div key={i} className={`flex-1 py-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 ${isSameDate(date, new Date()) ? 'bg-lime-50/50 dark:bg-lime-900/10' : ''}`}>
                            <div className={`text-xs font-medium uppercase mb-1 ${isSameDate(date, new Date()) ? 'text-lime-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                {date.toLocaleString('default', { weekday: 'short' })}
                            </div>
                            <div className={`inline-flex w-8 h-8 items-center justify-center rounded-full text-lg font-bold ${isSameDate(date, new Date()) ? 'bg-lime-600 text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                {date.getDate()}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex-1 flex overflow-y-auto">
                    {/* Time Column */}
                    <div className="w-16 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 sticky left-0 z-10">
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
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none bg-lime-50/10 dark:bg-lime-900/5 transition-opacity"></div>
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
                                            onClick={() => {
                                                setNewBooking(prev => ({ ...prev, date: day.toISOString().split('T')[0] }));
                                                setIsModalOpen(true);
                                            }}
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
                                            className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-lime-300 hover:bg-lime-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-lime-800 dark:hover:bg-lime-900/10"
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

    if (bookingsLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                    <div className="w-8 h-8 border-2 border-lime-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">Loading calendar…</p>
                </div>
            </div>
        );
    }

    if (bookingsError) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-red-600 dark:text-red-400">{bookingsError}</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex min-h-[70dvh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-10rem)] dark:border-slate-800 dark:bg-slate-900">
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-slate-900 gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                        <h2 className="min-w-0 text-xl font-bold text-slate-800 dark:text-slate-100">
                            {getHeaderText()}
                        </h2>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                            <button onClick={handlePrevious} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded shadow-sm text-slate-600 dark:text-slate-400 transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={handleNext} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded shadow-sm text-slate-600 dark:text-slate-400 transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <button onClick={handleToday} className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-lime-600 px-3 py-1 rounded-lg hover:bg-lime-50 dark:hover:bg-lime-900/10 transition-colors">Today</button>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex-1 sm:flex-none">
                            {['Day', 'Week', 'Month'].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setView(v as any)}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 text-xs font-medium rounded-md transition-all ${view === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center justify-center gap-2 bg-lime-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-lime-700 transition-colors shadow-sm whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Booking</span><span className="sm:hidden">New</span>
                        </button>
                    </div>
                </div>

                {/* Dynamic View Content */}
                {view === 'Month' && renderMonthView()}
                {view === 'Day' && (isMobile ? renderAgendaView() : renderDayView())}
                {view === 'Week' && (isMobile ? renderAgendaView() : renderWeekView())}
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
                                <CalendarIcon className="w-4 h-4 text-lime-600" /> Booking details
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
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="edit-booking-contact" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact</label>
                                <select
                                    id="edit-booking-contact"
                                    required
                                    value={editForm.contactId}
                                    onChange={e => setEditForm(prev => prev ? { ...prev, contactId: e.target.value } : null)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                >
                                    <option value="">Select a contact...</option>
                                    {contacts.map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.firstName} {contact.lastName} ({contact.email})
                                        </option>
                                    ))}
                                </select>
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="edit-booking-status" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Status</label>
                                    <select
                                        id="edit-booking-status"
                                        value={editForm.status}
                                        onChange={e => setEditForm(prev => prev ? { ...prev, status: e.target.value as Appointment['status'] } : null)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleDeleteBooking}
                                    className="flex items-center justify-center gap-2 py-2.5 px-4 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedAppointment(null); setEditForm(null); }}
                                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm"
                                >
                                    Save changes
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
                                <CalendarIcon className="w-4 h-4 text-lime-600" /> New Appointment
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} aria-label="Close new appointment dialog" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label htmlFor="new-booking-contact" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Contact</label>
                                <select
                                    id="new-booking-contact"
                                    required
                                    value={newBooking.contactId}
                                    onChange={e => setNewBooking({ ...newBooking, contactId: e.target.value })}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                >
                                    <option value="">Select a contact...</option>
                                    {contacts.map(contact => (
                                        <option key={contact.id} value={contact.id}>
                                            {contact.firstName} {contact.lastName} ({contact.email})
                                        </option>
                                    ))}
                                </select>
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="new-booking-type" className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Type</label>
                                    <select
                                        id="new-booking-type"
                                        value={newBooking.type}
                                        onChange={e => setNewBooking({ ...newBooking, type: e.target.value as any })}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
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
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-lime-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-lime-600 text-white rounded-lg text-sm font-bold hover:bg-lime-700 transition-colors shadow-sm"
                                >
                                    Create Booking
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};
