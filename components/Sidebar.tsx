'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, KanbanSquare, CalendarDays, GitBranch, Bot, Settings, LogOut, Star, Inbox, Megaphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

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
  const { logout, user } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'User';

  const handleSignOut = async () => {
    await logout();
    onNavigateComplete?.();
    router.push('/login');
  };

  return (
    <aside className={`flex h-full w-full flex-col bg-[var(--app-bg)] ${className}`.trim()}>
      <div className="select-none px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 ring-1 ring-violet-500/30">
            <Bot className="h-5 w-5 text-violet-400" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight text-[var(--app-text)]">
              LeadOps<span className="text-violet-400">AI</span>
            </p>
            <p className="text-[11px] font-medium text-zinc-500">Enterprise Suite</p>
          </div>
        </div>
      </div>

      {mobile && <h2 id="mobile-nav-title" className="sr-only">Navigation</h2>}

      <nav aria-label="Primary" className="surface-scroll flex-1 space-y-0.5 overflow-y-auto px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigateComplete}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-violet-500 text-white shadow-sm shadow-violet-500/25'
                  : 'text-zinc-400 hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-zinc-500'}`}
                strokeWidth={isActive ? 2.25 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--app-border)] p-3 space-y-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]"
        >
          <LogOut className="h-[18px] w-[18px] text-zinc-500" strokeWidth={2} />
          Sign Out
        </button>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card)] px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-300">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--app-text)]">{displayName}</p>
            <p className="truncate text-[11px] text-zinc-500">Pro Plan</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
