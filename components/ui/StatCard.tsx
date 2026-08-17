'use client';

import React from 'react';
import { LucideIcon, TrendingUp } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconClassName?: string;
  trend?: string;
  trendLabel?: string;
  delay?: number;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconClassName = 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
  trend,
  trendLabel,
  delay = 0,
}: StatCardProps) {
  return (
    <div
      className="app-card group cursor-default animate-fade-in p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/40 hover:bg-zinc-50 hover:shadow-lg hover:shadow-violet-500/10 dark:hover:bg-[#1a1b1f]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--app-text)]">
            {value}
          </p>
          {(trend || trendLabel) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              {trend && (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {trend}
                </span>
              )}
              {trendLabel && (
                <span className="text-zinc-500">{trendLabel}</span>
              )}
            </div>
          )}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${iconClassName}`}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}
