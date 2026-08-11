'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer } from './PageContainer';
import { Sidebar } from './Sidebar';
import { NavigationItem, Notification } from '@/types';
import {
    Bell, Search, Moon, Sun, CheckCircle, AlertCircle, Info, Menu, X,
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
    const { user: authUser } = useAuth();
    const {
        contacts, notifications, setNotifications,
        darkMode, toggleDarkMode, setCrmAction, unreadCount,
    } = useApp();

    const displayName = authUser?.fullName?.trim() || authUser?.email?.split('@')[0] || 'User';
    const displayEmail = authUser?.email || '';

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
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults.length > 0) {
                        handleSearchResultClick(searchResults[0]);
                    }
                }}
                placeholder="Search commands, contacts, and actions"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {showSearchDropdown && searchResults.length > 0 && (
                <div className={`absolute ${mobile ? 'left-0 right-0' : 'left-0 right-0'} top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900`}>
                    {searchResults.map((result, idx) => (
                        <button
                            key={`${result.type}-${idx}`}
                            type="button"
                            onClick={() => handleSearchResultClick(result)}
                            className="group flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                            {result.type === 'nav' ? (
                                <div className="rounded-lg bg-slate-100 p-2 text-slate-500 transition-colors group-hover:bg-lime-50 group-hover:text-lime-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-lime-900/20">
                                    <result.icon className="h-4 w-4" />
                                </div>
                            ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-lime-200 bg-lime-100 text-xs font-bold text-lime-700 dark:border-lime-800 dark:bg-lime-900/30 dark:text-lime-400">
                                    {result.firstName[0]}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                                    {result.type === 'nav' ? result.label : `${result.firstName} ${result.lastName}`}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
        <div className={`min-h-dvh font-sans transition-colors duration-300 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
            <a href="#main-content" className="skip-link">Skip to main content</a>

            <div className="hidden lg:block lg:sticky lg:top-0 lg:h-dvh lg:border-r lg:border-slate-200 lg:dark:border-slate-800">
                <Sidebar className="shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]" />
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
                        className="relative h-dvh w-[min(20rem,85vw)] overflow-hidden border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className="flex items-center justify-end border-b border-slate-200 p-3 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setMobileNavOpen(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-label="Close navigation"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <Sidebar mobile onNavigateComplete={() => setMobileNavOpen(false)} />
                    </div>
                </div>
            )}

            <div className="flex min-h-dvh min-w-0 flex-col bg-slate-50 transition-colors dark:bg-slate-950">
                <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
                    <PageContainer className="flex min-h-16 items-center gap-3 py-3">
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(true)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                                <h1 className="page-title min-w-0 truncate font-bold text-slate-800 dark:text-slate-100">{pageTitle}</h1>
                                <div className="hidden min-w-0 flex-1 md:block">{renderSearch()}</div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileSearchOpen((value) => !value)}
                                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
                                aria-expanded={mobileSearchOpen}
                                aria-controls="mobile-search-panel"
                                aria-label="Toggle search"
                            >
                                <Search className="h-5 w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={toggleDarkMode}
                                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                            >
                                {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                            </button>
                            <div className="relative" ref={notificationRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowNotifications((value) => !value)}
                                    aria-expanded={showNotifications}
                                    aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                                    className={`relative rounded-full p-2 transition-colors ${showNotifications ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-red-500 dark:border-slate-900" />
                                    )}
                                </button>
                                {showNotifications && (
                                    <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
                                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                                            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Notifications</h2>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{unreadCount} unread</span>
                                        </div>
                                        <div className="surface-scroll max-h-80 overflow-y-auto">
                                            {notifications.length === 0 ? (
                                                <div className="p-8 text-center text-sm text-slate-500">No new notifications.</div>
                                            ) : (
                                                notifications.map((n) => (
                                                    <button
                                                        key={n.id}
                                                        type="button"
                                                        onClick={() => handleNotificationClick(n)}
                                                        className={`flex w-full items-start gap-3 border-b border-slate-100 p-3 text-left transition-colors last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${!n.read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                                                    >
                                                        <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.type === 'alert' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : n.type === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                            {n.type === 'alert' ? <AlertCircle className="h-4 w-4" /> : n.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <Info className="h-4 w-4" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className={`text-sm ${!n.read ? 'font-bold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'}`}>{n.title}</p>
                                                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                                                            <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">{n.time}</p>
                                                        </div>
                                                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
                            <div className="flex items-center gap-2 rounded-lg p-1.5" title={displayEmail}>
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lime-100 text-sm font-semibold text-lime-700 dark:bg-lime-900/30 dark:text-lime-300">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="hidden text-left md:block">
                                    <p className="max-w-[140px] truncate text-sm font-medium text-slate-700 dark:text-slate-200">{displayName}</p>
                                    <p className="max-w-[140px] truncate text-[10px] text-slate-500 dark:text-slate-400">{displayEmail || 'Pro Plan'}</p>
                                </div>
                            </div>
                        </div>
                    </PageContainer>

                    {mobileSearchOpen && (
                        <PageContainer className="pb-3 md:hidden" id="mobile-search-panel">
                            {renderSearch(true)}
                        </PageContainer>
                    )}
                </header>

                <main id="main-content" className="min-w-0 flex-1 py-4 sm:py-6">
                    <PageContainer className="h-full min-w-0">{children}</PageContainer>
                </main>
            </div>
        </div>
    );
}
