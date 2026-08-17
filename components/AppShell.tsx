'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { PageContainer } from './PageContainer';
import { Sidebar } from './Sidebar';
import { ThemeToggle } from './ThemeToggle';
import type { Notification } from '@/types';
import { NavigationItem } from '@/types';
import {
    Bell, Search, CheckCircle, AlertCircle, Info, Menu, X,
    LayoutDashboard, Users, KanbanSquare, CalendarDays, GitBranch, Bot,
    Star, Inbox, Megaphone, Settings as SettingsIcon,
} from 'lucide-react';

const NAV_ROUTES: Record<NavigationItem, string> = {
    dashboard: '/',
    crm: '/crm',
    pipelines: '/pipelines',
    conversations: '/conversations',
    calendar: '/calendar',
    campaigns: '/campaigns',
    workflows: '/workflows',
    reviews: '/reviews',
    'ai-center': '/ai-center',
    settings: '/settings',
};

const PAGE_TITLES: Record<string, string> = {
    '/': 'Dashboard',
    '/crm': 'Contacts',
    '/pipelines': 'Pipelines',
    '/conversations': 'Inbox',
    '/calendar': 'Calendar',
    '/campaigns': 'Campaigns',
    '/workflows': 'Workflows',
    '/reviews': 'Reviews',
    '/ai-center': 'AI Center',
    '/settings': 'Settings',
};

export function AppShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const {
        contacts, notifications, setNotifications,
        markAllNotificationsRead, requestNotificationPermission,
        setCrmAction, unreadCount,
    } = useApp();

    const [showNotifications, setShowNotifications] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

    const notificationRef = useRef<HTMLDivElement>(null);
    const desktopSearchRef = useRef<HTMLDivElement>(null);
    const mobileSearchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }

            const clickedDesktopSearch = desktopSearchRef.current?.contains(event.target as Node) ?? false;
            const clickedMobileSearch = mobileSearchRef.current?.contains(event.target as Node) ?? false;

            if (!clickedDesktopSearch && !clickedMobileSearch) {
                setShowSearchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setMobileNavOpen(false);
        setMobileSearchOpen(false);
        setShowNotifications(false);
        setShowSearchDropdown(false);
    }, [pathname]);

    useEffect(() => {
        if (!mobileNavOpen) {
            return undefined;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileNavOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleEscape);
        };
    }, [mobileNavOpen]);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setShowSearchDropdown(false);
            return;
        }
        const query = searchQuery.toLowerCase();
        const results: any[] = [];
        const navItems: { id: NavigationItem; label: string; icon: any }[] = [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'conversations', label: 'Inbox', icon: Inbox },
            { id: 'crm', label: 'Contacts', icon: Users },
            { id: 'pipelines', label: 'Pipelines', icon: KanbanSquare },
            { id: 'calendar', label: 'Calendar', icon: CalendarDays },
            { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
            { id: 'reviews', label: 'Reviews', icon: Star },
            { id: 'workflows', label: 'Workflows', icon: GitBranch },
            { id: 'ai-center', label: 'AI Center', icon: Bot },
            { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ];
        navItems.forEach(item => {
            if (item.label.toLowerCase().includes(query)) {
                results.push({ type: 'nav', ...item });
            }
        });
        contacts.forEach(c => {
            const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
            if (fullName.includes(query) || c.email.toLowerCase().includes(query)) {
                results.push({ type: 'contact', ...c });
            }
        });
        setSearchResults(results.slice(0, 8));
        setShowSearchDropdown(true);
    }, [searchQuery, contacts]);

    const handleSearchResultClick = (result: any) => {
        if (result.type === 'nav') {
            router.push(NAV_ROUTES[result.id as NavigationItem]);
        } else if (result.type === 'contact') {
            router.push('/crm');
            setTimeout(() => {
                setCrmAction({ contactId: result.id, tab: 'activity', timestamp: Date.now() });
            }, 10);
        }
        setShowSearchDropdown(false);
        setSearchQuery('');
        setMobileSearchOpen(false);
    };

    const handleNotificationClick = (notification: Notification) => {
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        setShowNotifications(false);
        if (notification.linkTo) {
            router.push(NAV_ROUTES[notification.linkTo]);
        }
        if (notification.linkTo === 'crm' && notification.entityId) {
            setCrmAction({
                contactId: notification.entityId,
                tab: notification.subTab || 'activity',
                timestamp: Date.now(),
            });
        }
    };

    const pageTitle = PAGE_TITLES[pathname] || 'Dashboard';

    const renderSearch = (mobile = false) => (
        <div className="relative w-full" ref={mobile ? mobileSearchRef : desktopSearchRef}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults.length > 0) {
                        handleSearchResultClick(searchResults[0]);
                    }
                }}
                placeholder="Search contacts, actions, pipelines..."
                className="h-10 w-full rounded-full border border-zinc-800 bg-[#121214] pl-10 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-500 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
            {showSearchDropdown && searchResults.length > 0 && (
                <div className={`absolute ${mobile ? 'left-0 right-0' : 'left-0 right-0'} top-full z-50 mt-2 overflow-hidden rounded-xl border border-white/[0.08] bg-[#141416] shadow-xl shadow-black/40`}>
                    {searchResults.map((result, idx) => (
                        <button
                            key={`${result.type}-${idx}`}
                            type="button"
                            onClick={() => handleSearchResultClick(result)}
                            className="group flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition-colors last:border-0 hover:bg-white/[0.04]"
                        >
                            {result.type === 'nav' ? (
                                <div className="rounded-lg bg-zinc-800 p-2 text-zinc-400 transition-colors group-hover:bg-violet-500/10 group-hover:text-violet-400">
                                    <result.icon className="h-4 w-4" />
                                </div>
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-200 bg-violet-100 text-xs font-bold text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-400">
                                    {result.firstName[0]}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[var(--app-text)]">
                                    {result.type === 'nav' ? result.label : `${result.firstName} ${result.lastName}`}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                                    {result.type === 'nav' ? 'Navigate' : 'Contact'}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="enterprise-surface min-h-dvh font-sans text-[var(--app-text)] transition-colors duration-300 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
            <a href="#main-content" className="skip-link">Skip to main content</a>

            <div className="hidden lg:block lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-[var(--app-border)] lg:bg-[var(--app-bg)]">
                <Sidebar />
            </div>

            {mobileNavOpen && (
                <div className="fixed inset-0 z-40 lg:hidden" aria-hidden={!mobileNavOpen}>
                    <button
                        type="button"
                        aria-label="Close navigation"
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="mobile-nav-title"
                        className="relative h-dvh w-[min(20rem,85vw)] overflow-hidden border-r border-[var(--app-border)] bg-[var(--app-bg)] shadow-2xl"
                    >
                        <div className="flex items-center justify-end border-b border-[var(--app-border)] p-3">
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(false)}
                                className="rounded-lg p-2 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                                aria-label="Close navigation"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <Sidebar mobile onNavigateComplete={() => setMobileNavOpen(false)} />
                    </div>
                </div>
            )}

            <div className="enterprise-surface flex min-h-dvh min-w-0 flex-col bg-[var(--app-bg)]">
                <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-bg)]">
                    <div className="grid min-h-[64px] grid-cols-[1fr_minmax(0,36rem)_1fr] items-center gap-3 px-4 sm:px-6 lg:px-8">
                        <div className="flex min-w-0 items-center gap-3 justify-self-start">
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(true)}
                                className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-white/[0.04] lg:hidden"
                                aria-label="Open navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </button>
                            <h1 className="truncate text-[22px] font-bold tracking-tight text-[var(--app-text)]">{pageTitle}</h1>
                        </div>

                        <div className="hidden w-full md:block">
                            {renderSearch()}
                        </div>

                        <div className="flex items-center gap-2 justify-self-end">
                            <button
                                type="button"
                                onClick={() => setMobileSearchOpen((value) => !value)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-[#121214] text-zinc-400 hover:text-zinc-200 md:hidden"
                                aria-expanded={mobileSearchOpen}
                                aria-controls="mobile-search-panel"
                                aria-label="Toggle search"
                            >
                                <Search className="h-4 w-4" />
                            </button>
                            <ThemeToggle />
                            <div className="relative" ref={notificationRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowNotifications((value) => !value)}
                                    aria-expanded={showNotifications}
                                    aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                                    className={`relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-[#121214] transition-colors ${showNotifications ? 'text-zinc-200' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
                                    )}
                                </button>
                                {showNotifications && (
                                    <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-xl">
                                        <div className="flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] p-3">
                                            <h2 className="text-sm font-bold text-[var(--app-text)]">Notifications</h2>
                                            <div className="flex items-center gap-2">
                                                {unreadCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={markAllNotificationsRead}
                                                        className="text-[11px] font-medium text-violet-400 hover:text-violet-300"
                                                    >
                                                        Mark all read
                                                    </button>
                                                )}
                                                <span className="text-xs text-zinc-500">{unreadCount} unread</span>
                                            </div>
                                        </div>
                                        {typeof Notification !== 'undefined' && Notification.permission !== 'granted' && (
                                            <div className="border-b border-[var(--app-border)] px-3 py-2">
                                                <button
                                                    type="button"
                                                    onClick={() => void requestNotificationPermission()}
                                                    className="text-xs font-medium text-violet-400 hover:text-violet-300"
                                                >
                                                    Enable desktop alerts
                                                </button>
                                            </div>
                                        )}
                                        <div className="surface-scroll max-h-80 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-zinc-500">No new notifications.</div>
                                            ) : (
                                                notifications.map((n) => (
                                                    <button
                                                        key={n.id}
                                                        type="button"
                                                        onClick={() => handleNotificationClick(n)}
                                                        className={`flex w-full items-start gap-3 border-b border-white/[0.06] p-3 text-left last:border-0 hover:bg-white/[0.03] ${!n.read ? 'bg-violet-500/5' : ''}`}
                                                    >
                                                        <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.type === 'alert' ? 'bg-red-500/15 text-red-400' : n.type === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                                            {n.type === 'alert' ? <AlertCircle className="h-4 w-4" /> : n.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`text-sm ${!n.read ? 'font-bold text-[var(--app-text)]' : 'font-medium text-zinc-600 dark:text-zinc-300'}`}>{n.title}</p>
                                                            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{n.message}</p>
                                                            <p className="mt-1 text-[10px] text-zinc-600">{n.time}</p>
                                                        </div>
                                                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-violet-500" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {mobileSearchOpen && (
                        <PageContainer className="pb-3 md:hidden" id="mobile-search-panel">
                            {renderSearch(true)}
                        </PageContainer>
                    )}
                </header>

                <main id="main-content" className={`min-w-0 flex-1 ${pathname === '/pipelines' || pathname === '/calendar' || pathname === '/workflows' ? 'flex flex-col' : 'py-4 sm:py-6'}`}>
                    {pathname === '/pipelines' || pathname === '/calendar' || pathname === '/workflows' ? (
                        <div className={`flex min-h-0 flex-1 flex-col px-4 sm:px-6 lg:px-8 ${pathname === '/calendar' || pathname === '/workflows' ? 'py-4' : ''}`}>{children}</div>
                    ) : (
                        <PageContainer className="h-full min-w-0">{children}</PageContainer>
                    )}
                </main>
            </div>
        </div>
    );
}
