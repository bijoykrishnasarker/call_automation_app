'use client';

import React from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
  noPadding = false,
}: SectionCardProps) {
  return (
    <section className={`app-card overflow-hidden ${className}`.trim()}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--app-border)] px-5 py-4">
          <div>
            {title && (
              <h3 className="text-base font-bold text-[var(--app-text)]">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={noPadding ? bodyClassName : `p-5 ${bodyClassName}`.trim()}>{children}</div>
    </section>
  );
}
