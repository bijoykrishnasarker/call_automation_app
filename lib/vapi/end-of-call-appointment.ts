import { parseAppointmentFromConversation, pickFirstString } from '@/lib/vapi/conversation';
import { normalizeAppointmentLocalTime } from '@/lib/vapi/parse-local-time';

export interface EndOfCallAppointmentDraft {
  localDate: string | null;
  localTime: string | null;
  startAt: string | null;
  timezone: string;
  durationMinutes: number;
  subject: string;
  notes: string | null;
}

function extractStructuredData(
  message: Record<string, unknown>,
  payload: Record<string, unknown>
): Record<string, unknown> | null {
  const candidates = [
    (message.analysis as Record<string, unknown> | undefined)?.structuredData,
    (message.call as Record<string, unknown> | undefined)?.analysis &&
      ((message.call as Record<string, unknown>).analysis as Record<string, unknown>).structuredData,
    payload.analysis &&
      typeof payload.analysis === 'object' &&
      (payload.analysis as Record<string, unknown>).structuredData,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return null;
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function coerceBoolean(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  return false;
}

function normalizeLocalDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) return trimmed;

  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmy) {
    return `${dmy[3]}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
  }

  const monthDayYear = /^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?/i.exec(
    trimmed
  );
  if (monthDayYear) {
    const monthNames: Record<string, number> = {
      january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
      may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
      september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11,
      december: 12, dec: 12,
    };
    const month = monthNames[monthDayYear[1]!.toLowerCase()];
    const day = Number(monthDayYear[2]);
    const year = Number(monthDayYear[3] ?? new Date().getFullYear());
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function normalizeLocalTime(raw: unknown): string | null {
  return normalizeAppointmentLocalTime(raw);
}

export function buildEndOfCallAppointmentDraft(params: {
  message: Record<string, unknown>;
  payload: Record<string, unknown>;
  transcriptText: string | null;
  referenceAt: string;
}): EndOfCallAppointmentDraft | null {
  const structured = extractStructuredData(params.message, params.payload);
  const appointmentBlock = nestedRecord(structured?.appointment);
  const leadBlock = nestedRecord(structured?.lead);
  const contactBlock = nestedRecord(structured?.contact);

  const appointmentRequested =
    coerceBoolean(appointmentBlock?.appointmentRequested) ||
    coerceBoolean(structured?.appointmentRequested);

  const preferredDate = normalizeLocalDate(
    pickFirstString(
      appointmentBlock?.preferredDate,
      appointmentBlock?.preferred_date,
      structured?.preferredDate,
      structured?.preferred_date,
      contactBlock?.preferredDate
    )
  );

  const preferredTime = normalizeLocalTime(
    pickFirstString(
      appointmentBlock?.preferredTime,
      appointmentBlock?.preferred_time,
      structured?.preferredTime,
      structured?.preferred_time,
      contactBlock?.preferredTime
    )
  );

  const requestedService = pickFirstString(
    leadBlock?.requestedService,
    leadBlock?.requested_service,
    structured?.requestedService
  );

  const timezone =
    pickFirstString(
      appointmentBlock?.timezone,
      structured?.timezone,
      contactBlock?.timezone
    ) ?? 'Asia/Dhaka';

  let localDate = preferredDate;
  let localTime = preferredTime;
  let durationMinutes = 30;

  if (!localDate || !localTime) {
    const guess = parseAppointmentFromConversation(
      params.transcriptText ?? '',
      new Date(params.referenceAt)
    );
    if (guess) {
      localDate =
        localDate ??
        `${guess.year}-${String(guess.month).padStart(2, '0')}-${String(guess.day).padStart(2, '0')}`;
      localTime = localTime ?? `${String(guess.hour).padStart(2, '0')}:${String(guess.minute).padStart(2, '0')}`;
      durationMinutes = guess.durationMinutes;
    }
  }

  const hasSlot = Boolean(localDate && localTime);
  if (!hasSlot) return null;
  if (!appointmentRequested && !/\b(confirm|book|schedule|appointment)\b/i.test(params.transcriptText ?? '')) {
    return null;
  }

  return {
    localDate,
    localTime,
    startAt: null,
    timezone,
    durationMinutes,
    subject: requestedService?.trim() || 'Voice appointment',
    notes: pickFirstString(leadBlock?.message, structured?.message) ?? null,
  };
}
