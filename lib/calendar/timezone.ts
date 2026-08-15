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
