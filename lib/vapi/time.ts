import type { CanonicalValidationIssue } from '@/lib/vapi/types';

type DstFallbackMode = 'earlier' | 'later';

function getDstFallbackMode(): DstFallbackMode {
  return process.env.VAPI_WEBHOOK_DST_FALLBACK_MODE === 'earlier' ? 'earlier' : 'later';
}

function ensureIanaTimeZone(timezone: string): string | null {
  const candidate = timezone.trim();
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return null;
  }
}

function parseIsoTimestamp(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getZonedParts(epochMs: number, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(epochMs));
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function sameLocal(
  left: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  right: { year: number; month: number; day: number; hour: number; minute: number; second: number }
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second
  );
}

function localDateTimeToUtc(input: {
  timezone: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  disambiguation: DstFallbackMode;
}): {
  instant: Date | null;
  ambiguous: boolean;
} {
  const desired = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second,
  };

  let epochMs = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second
  );

  for (let i = 0; i < 8; i += 1) {
    const zoned = getZonedParts(epochMs, input.timezone);
    const zonedMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
    const desiredMs = Date.UTC(desired.year, desired.month - 1, desired.day, desired.hour, desired.minute, desired.second);
    const deltaMinutes = Math.round((desiredMs - zonedMs) / 60000);
    if (deltaMinutes === 0) break;
    epochMs += deltaMinutes * 60000;
  }

  const resolved = getZonedParts(epochMs, input.timezone);
  if (!sameLocal(resolved, desired)) {
    return { instant: null, ambiguous: false };
  }

  const candidateEarlier = epochMs - 60 * 60 * 1000;
  const candidateLater = epochMs + 60 * 60 * 1000;
  const matchesEarlier = sameLocal(getZonedParts(candidateEarlier, input.timezone), desired);
  const matchesLater = sameLocal(getZonedParts(candidateLater, input.timezone), desired);

  let chosenMs = epochMs;
  const ambiguous = matchesEarlier || matchesLater;
  if (ambiguous) {
    if (input.disambiguation === 'earlier' && matchesEarlier) chosenMs = candidateEarlier;
    if (input.disambiguation === 'later' && matchesLater) chosenMs = candidateLater;
  }

  return { instant: new Date(chosenMs), ambiguous };
}

export interface ResolvedAppointmentWindow {
  start_time_utc: string;
  end_time_utc: string;
  date: string;
  timezone: string;
  duration_minutes: number;
  warnings: string[];
  validation_errors: CanonicalValidationIssue[];
}

export function resolveAppointmentWindow(input: {
  startAt?: string | null;
  endAt?: string | null;
  localDate?: string | null;
  localTime?: string | null;
  timezone?: string | null;
  durationMinutes?: number | null;
  tracePath?: string;
}): ResolvedAppointmentWindow | null {
  const tracePath = input.tracePath ?? 'appointment';
  const warnings: string[] = [];
  const validation_errors: CanonicalValidationIssue[] = [];
  const timezone = ensureIanaTimeZone(input.timezone ?? '') ?? null;

  if (input.startAt) {
    const start = parseIsoTimestamp(input.startAt);
    if (!start) {
      validation_errors.push({
        path: `${tracePath}.startAt`,
        code: 'invalid_start_time',
        message: 'Appointment startAt must be a valid ISO 8601 timestamp with offset.',
      });
      return null;
    }

    let end: Date | null = null;
    if (input.endAt) {
      end = parseIsoTimestamp(input.endAt);
    } else {
      const duration = Math.max(1, Math.floor(input.durationMinutes ?? 0));
      end = new Date(start.getTime() + duration * 60_000);
    }

    if (!end) {
      validation_errors.push({
        path: `${tracePath}.endAt`,
        code: 'missing_end_time',
        message: 'Appointment end time or duration is required.',
      });
      return null;
    }

    const effectiveTimezone = timezone ?? 'UTC';
    if (!timezone) warnings.push('timezone_missing_falling_back_to_utc');

    const localParts = getZonedParts(start.getTime(), effectiveTimezone);
    const duration_minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));

    return {
      start_time_utc: start.toISOString(),
      end_time_utc: end.toISOString(),
      date: `${String(localParts.year).padStart(4, '0')}-${String(localParts.month).padStart(2, '0')}-${String(localParts.day).padStart(2, '0')}`,
      timezone: effectiveTimezone,
      duration_minutes,
      warnings,
      validation_errors,
    };
  }

  if (!input.localDate || !input.localTime) {
    validation_errors.push({
      path: tracePath,
      code: 'missing_local_time',
      message: 'Appointment local date and local time are required when ISO timestamps are missing.',
    });
    return null;
  }

  if (!timezone) {
    validation_errors.push({
      path: `${tracePath}.timezone`,
      code: 'missing_timezone',
      message: 'Appointment timezone must be an IANA timezone.',
    });
    return null;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.localDate);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(input.localTime);
  if (!dateMatch || !timeMatch) {
    validation_errors.push({
      path: tracePath,
      code: 'invalid_local_datetime',
      message: 'Appointment localDate must be YYYY-MM-DD and localTime must be HH:mm or HH:mm:ss.',
    });
    return null;
  }

  const duration_minutes = Math.max(1, Math.floor(input.durationMinutes ?? 0));
  const conversion = localDateTimeToUtc({
    timezone,
    year: Number(dateMatch[1]),
    month: Number(dateMatch[2]),
    day: Number(dateMatch[3]),
    hour: Number(timeMatch[1]),
    minute: Number(timeMatch[2]),
    second: Number(timeMatch[3] ?? '0'),
    disambiguation: getDstFallbackMode(),
  });

  if (!conversion.instant) {
    validation_errors.push({
      path: tracePath,
      code: 'invalid_dst_time',
      message: 'Appointment local time does not exist in the supplied timezone because of DST.',
    });
    return null;
  }

  if (conversion.ambiguous) {
    warnings.push(`ambiguous_dst_time_resolved_${getDstFallbackMode()}`);
  }

  const end = new Date(conversion.instant.getTime() + duration_minutes * 60_000);

  return {
    start_time_utc: conversion.instant.toISOString(),
    end_time_utc: end.toISOString(),
    date: input.localDate,
    timezone,
    duration_minutes,
    warnings,
    validation_errors,
  };
}

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Dhaka';

export function inferDefaultTimezone(): string {
  const timezone = process.env.VAPI_DEFAULT_TIMEZONE?.trim();
  return ensureIanaTimeZone(timezone ?? '') ?? DEFAULT_BUSINESS_TIMEZONE;
}

/** Parse ISO with offset, or naive local datetime like `2026-08-16T15:00` in `timezone`. */
export function parseFlexibleDateTime(raw: string, timezone: string): Date | null {
  const withOffset = parseIsoTimestamp(raw);
  if (withOffset) return withOffset;

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw.trim());
  if (!match) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const iana = ensureIanaTimeZone(timezone) ?? DEFAULT_BUSINESS_TIMEZONE;
  const conversion = localDateTimeToUtc({
    timezone: iana,
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? '0'),
    disambiguation: getDstFallbackMode(),
  });
  return conversion.instant;
}

export function formatSlotForCaller(isoUtc: string, timezone: string): string {
  const iana = ensureIanaTimeZone(timezone) ?? DEFAULT_BUSINESS_TIMEZONE;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: iana,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(isoUtc));
}
