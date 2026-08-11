'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, KanbanSquare, CalendarDays, GitBranch, Bot, Settings, LogOut, Star, Inbox, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NavigationItem } from '@/types';

interface SidebarProps {
  className?: string;
  mobile?: boolean;
  onNavigateComplete?: () => void;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/conversations', label: 'Inbox', icon: Inbox },
  { path: '/crm', label: 'Contacts', icon: Users },
  { path: '/pipelines', label: 'Pipelines', icon: KanbanSquare },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays },
  { path: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { path: '/reviews', label: 'Reviews', icon: Star },
  { path: '/workflows', label: 'Workflows', icon: GitBranch },
  { path: '/ai-center', label: 'AI Center', icon: Bot },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ className = '', mobile = false, onNavigateComplete }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    onNavigateComplete?.();
    router.push('/login');
  };

  return (
    <aside className={`flex h-full w-full flex-col bg-white dark:bg-slate-900 ${className}`.trim()}>
      <div className="flex items-center gap-2 border-b border-slate-200/80 p-5 dark:border-slate-800/80 select-none">
        <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center transform hover:rotate-12 transition-transform duration-300">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">LeadOps<span className="text-lime-600 dark:text-lime-500">AI</span></span>
      </div>

      {mobile && <h2 id="mobile-nav-title" className="sr-only">Navigation</h2>}

      <nav aria-label="Primary" className="surface-scroll flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigateComplete}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                ${isActive
                  ? 'bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400 shadow-sm translate-x-1'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:translate-x-1 active:scale-95'}`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-lime-600 dark:text-lime-400 scale-110' : 'text-slate-400 dark:text-slate-500 group-hover:scale-110'}`} />
              {item.label}
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-lime-500 rounded-r-full" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 w-full transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
