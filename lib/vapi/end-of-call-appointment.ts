import { parseAppointmentFromConversation, pickFirstString } from '@/lib/vapi/conversation';

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
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function normalizeLocalTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim();
  const meridiem = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(trimmed);
  if (meridiem) {
    let hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? '0');
    const suffix = meridiem[3]!.toLowerCase();
    if (suffix === 'pm' && hour < 12) hour += 12;
    if (suffix === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (twentyFour) {
    return `${String(Number(twentyFour[1])).padStart(2, '0')}:${twentyFour[2]}`;
  }
  return null;
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
