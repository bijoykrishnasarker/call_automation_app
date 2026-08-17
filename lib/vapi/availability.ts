import { formatSlotForCaller, getZonedParts } from '@/lib/vapi/time';

export interface BusyInterval {
  start: number;
  end: number;
}

export interface SuggestedSlot {
  startAt: string;
  endAt: string;
  display: string;
}

export interface AvailabilityResult {
  isAvailable: boolean;
  message: string;
  requestedSlot: SuggestedSlot;
  suggestedSlots: SuggestedSlot[];
  today: string;
  timezone: string;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

function isWithinBusinessHours(
  startMs: number,
  endMs: number,
  timezone: string,
  openHour: number,
  closeHour: number
): boolean {
  const start = getZonedParts(startMs, timezone);
  const end = getZonedParts(endMs, timezone);
  if (start.hour < openHour) return false;
  if (end.hour > closeHour) return false;
  if (end.hour === closeHour && (end.minute > 0 || end.second > 0)) return false;
  return true;
}

export function buildAvailabilityResult(params: {
  requestedStart: Date;
  requestedEnd: Date;
  busy: BusyInterval[];
  timezone: string;
  suggestionsCount?: number;
  suggestionWindowDays?: number;
  stepMinutes?: number;
  openHour?: number;
  closeHour?: number;
}): AvailabilityResult {
  const {
    requestedStart,
    requestedEnd,
    busy,
    timezone,
    suggestionsCount = 3,
    suggestionWindowDays = 7,
    stepMinutes = 30,
    openHour = 8,
    closeHour = 20,
  } = params;

  const startMs = requestedStart.getTime();
  const endMs = requestedEnd.getTime();
  const durationMs = Math.max(60_000, endMs - startMs);
  const requestedSlot: SuggestedSlot = {
    startAt: requestedStart.toISOString(),
    endAt: requestedEnd.toISOString(),
    display: formatSlotForCaller(requestedStart.toISOString(), timezone),
  };

  const todayParts = getZonedParts(Date.now(), timezone);
  const today = `${String(todayParts.year).padStart(4, '0')}-${String(todayParts.month).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`;

  const taken = busy.some(interval => overlaps(startMs, endMs, interval.start, interval.end));
  if (!taken) {
    return {
      isAvailable: true,
      message: `${requestedSlot.display} is free. You can book this time.`,
      requestedSlot,
      suggestedSlots: [requestedSlot],
      today,
      timezone,
    };
  }

  const windowEnd = startMs + suggestionWindowDays * 24 * 60 * 60 * 1000;
  const suggestedSlots: SuggestedSlot[] = [];
  let cursor = startMs + stepMinutes * 60_000;

  while (suggestedSlots.length < suggestionsCount && cursor + durationMs <= windowEnd) {
    const candidateEnd = cursor + durationMs;
    const inHours = isWithinBusinessHours(cursor, candidateEnd, timezone, openHour, closeHour);
    const conflict = busy.some(interval => overlaps(cursor, candidateEnd, interval.start, interval.end));
    if (inHours && !conflict) {
      suggestedSlots.push({
        startAt: new Date(cursor).toISOString(),
        endAt: new Date(candidateEnd).toISOString(),
        display: formatSlotForCaller(new Date(cursor).toISOString(), timezone),
      });
    }
    cursor += stepMinutes * 60_000;
  }

  const alternatives = suggestedSlots.map(slot => slot.display).join('; ');
  return {
    isAvailable: false,
    message: alternatives
      ? `${requestedSlot.display} is already booked. Please offer one of these other times: ${alternatives}.`
      : `${requestedSlot.display} is already booked. Ask the caller for a different day or time.`,
    requestedSlot,
    suggestedSlots,
    today,
    timezone,
  };
}
