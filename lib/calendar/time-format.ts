export type AmPm = 'AM' | 'PM';

export function parseTime24(time: string): { hour: number; minute: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function toTime12Parts(time24: string): { hour12: number; minute: number; period: AmPm } {
  const { hour, minute } = parseTime24(time24);
  const period: AmPm = hour >= 12 ? 'PM' : 'AM';
  let hour12 = hour % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute, period };
}

export function toTime24(hour12: number, minute: number, period: AmPm): string {
  const h = Math.min(12, Math.max(1, hour12));
  const m = Math.min(59, Math.max(0, minute));
  let hour24 = h % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const HOUR12_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
