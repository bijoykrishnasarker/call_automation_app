'use client';

import React, { useMemo } from 'react';
import {
  AmPm,
  HOUR12_OPTIONS,
  MINUTE_OPTIONS,
  toTime12Parts,
  toTime24,
} from '@/lib/calendar/time-format';

interface TimeAmPmInputProps {
  id: string;
  value: string;
  onChange: (value24: string) => void;
  disabled?: boolean;
}

const selectClassName =
  'rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export const TimeAmPmInput: React.FC<TimeAmPmInputProps> = ({
  id,
  value,
  onChange,
  disabled = false,
}) => {
  const parts = useMemo(() => toTime12Parts(value), [value]);

  const update = (next: Partial<{ hour12: number; minute: number; period: AmPm }>) => {
    onChange(
      toTime24(
        next.hour12 ?? parts.hour12,
        next.minute ?? parts.minute,
        next.period ?? parts.period
      )
    );
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
      <select
        id={`${id}-hour`}
        aria-label="Hour"
        disabled={disabled}
        value={parts.hour12}
        onChange={e => update({ hour12: Number(e.target.value) })}
        className={selectClassName}
      >
        {HOUR12_OPTIONS.map(h => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select
        id={`${id}-minute`}
        aria-label="Minute"
        disabled={disabled}
        value={parts.minute}
        onChange={e => update({ minute: Number(e.target.value) })}
        className={selectClassName}
      >
        {MINUTE_OPTIONS.map(m => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        id={`${id}-ampm`}
        aria-label="AM or PM"
        disabled={disabled}
        value={parts.period}
        onChange={e => update({ period: e.target.value as AmPm })}
        className={`${selectClassName} min-w-[5.5rem] font-semibold`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};
