/** Business calendar always uses this timezone for voice bookings and display. */
export const CALENDAR_TIMEZONE = 'Asia/Dhaka';

export function getZonedDateKey(instant: Date, timeZone = CALENDAR_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function getZonedHourMinute(
  instant: Date,
  timeZone = CALENDAR_TIMEZONE
): { hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    hour: Number(map.hour ?? 0),
    minute: Number(map.minute ?? 0),
  };
}

export function formatTimeInZone(instant: Date, timeZone = CALENDAR_TIMEZONE): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

export function calendarCellDateKey(cellDate: Date): string {
  const year = cellDate.getFullYear();
  const month = String(cellDate.getMonth() + 1).padStart(2, '0');
  const day = String(cellDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSameCalendarDay(
  appointmentStart: Date,
  cellDate: Date,
  timeZone = CALENDAR_TIMEZONE
): boolean {
  return getZonedDateKey(appointmentStart, timeZone) === calendarCellDateKey(cellDate);
}

export function wallClockFromInstant(
  instant: Date,
  timeZone = CALENDAR_TIMEZONE
): { date: string; time: string } {
  const date = getZonedDateKey(instant, timeZone);
  const { hour, minute } = getZonedHourMinute(instant, timeZone);
  const h = hour === 24 ? 0 : hour;
  return {
    date,
    time: `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

/** Interpret a date picker + time picker as Asia/Dhaka wall clock (UTC+6, no DST). */
export function dateTimeFromWallClock(dateStr: string, timeStr: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  const timeMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr.trim());
  if (!dateMatch || !timeMatch) {
    throw new Error('Enter a valid date and time.');
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = Number(timeMatch[3] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error('Enter a valid date and time.');
  }
  const instant = new Date(Date.UTC(year, month - 1, day, hour - 6, minute, second));
  if (Number.isNaN(instant.getTime())) {
    throw new Error('Enter a valid date and time.');
  }
  return instant;
}
