/**
 * Parse caller-facing local times for appointments.
 * Bare hours like "4" or "4:00" default to PM during business hours (1–7 → 1pm–7pm).
 */
export function normalizeAppointmentLocalTime(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, ' ');

  const meridiem = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)$/i.exec(trimmed);
  if (meridiem) {
    let hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? '0');
    const suffix = meridiem[3]!.replace(/\./g, '').toLowerCase();
    if (suffix.startsWith('p') && hour < 12) hour += 12;
    if (suffix.startsWith('a') && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (twentyFour) {
    let hour = Number(twentyFour[1]);
    const minute = twentyFour[2];
    if (hour >= 1 && hour <= 7) hour += 12;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  const bareHour = /^(\d{1,2})$/.exec(trimmed);
  if (bareHour) {
    let hour = Number(bareHour[1]);
    if (hour >= 1 && hour <= 7) hour += 12;
    if (hour === 12) hour = 12;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  const oClock = /^(\d{1,2})\s*(?:o'?clock|oclock)$/i.exec(trimmed);
  if (oClock) {
    let hour = Number(oClock[1]);
    if (hour >= 1 && hour <= 7) hour += 12;
    return `${String(hour).padStart(2, '0')}:00`;
  }

  return null;
}
