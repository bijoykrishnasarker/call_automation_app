'use client';

import React from 'react';

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

interface FilterTabsProps {
  tabs: FilterTab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function FilterTabs({ tabs, activeId, onChange, className = '' }: FilterTabsProps) {
  return (
    <div
      className={`flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-[#111214] p-1 ${className}`.trim()}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const label = tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
              isActive
                ? 'bg-violet-500/15 text-violet-300 shadow-sm ring-1 ring-violet-500/20'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
