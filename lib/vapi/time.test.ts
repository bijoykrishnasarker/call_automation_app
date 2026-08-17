import { afterEach, describe, expect, it } from 'vitest';

import { parseFlexibleDateTime, resolveAppointmentWindow } from '@/lib/vapi/time';

const originalFallback = process.env.VAPI_WEBHOOK_DST_FALLBACK_MODE;

afterEach(() => {
  if (originalFallback === undefined) {
    delete process.env.VAPI_WEBHOOK_DST_FALLBACK_MODE;
  } else {
    process.env.VAPI_WEBHOOK_DST_FALLBACK_MODE = originalFallback;
  }
});

describe('resolveAppointmentWindow', () => {
  it('converts offset ISO timestamp to UTC and preserves timezone date', () => {
    const result = resolveAppointmentWindow({
      startAt: '2026-04-20T16:00:00-04:00',
      endAt: '2026-04-20T16:30:00-04:00',
      timezone: 'America/New_York',
      tracePath: 'appointment',
    });

    expect(result).not.toBeNull();
    expect(result?.start_time_utc).toBe('2026-04-20T20:00:00.000Z');
    expect(result?.end_time_utc).toBe('2026-04-20T20:30:00.000Z');
    expect(result?.date).toBe('2026-04-20');
    expect(result?.validation_errors).toHaveLength(0);
  });

  it('rejects invalid DST local time', () => {
    const result = resolveAppointmentWindow({
      localDate: '2026-03-08',
      localTime: '02:30:00',
      timezone: 'America/New_York',
      durationMinutes: 30,
      tracePath: 'appointment',
    });

    expect(result).toBeNull();
  });

  it('resolves ambiguous DST local time using configured fallback', () => {
    process.env.VAPI_WEBHOOK_DST_FALLBACK_MODE = 'earlier';
    const earlier = resolveAppointmentWindow({
      localDate: '2026-11-01',
      localTime: '01:30:00',
      timezone: 'America/New_York',
      durationMinutes: 30,
      tracePath: 'appointment',
    });

    process.env.VAPI_WEBHOOK_DST_FALLBACK_MODE = 'later';
    const later = resolveAppointmentWindow({
      localDate: '2026-11-01',
      localTime: '01:30:00',
      timezone: 'America/New_York',
      durationMinutes: 30,
      tracePath: 'appointment',
    });

    expect(earlier).not.toBeNull();
    expect(later).not.toBeNull();
    expect(earlier?.start_time_utc).not.toBe(later?.start_time_utc);
    expect(earlier?.warnings.some(w => w.includes('ambiguous_dst_time_resolved'))).toBe(true);
    expect(later?.warnings.some(w => w.includes('ambiguous_dst_time_resolved'))).toBe(true);
  });

  it('rolls a past year like 2024 forward so the event lands on this year calendar', () => {
    const result = resolveAppointmentWindow({
      startAt: '2024-08-16T10:00:00.000Z',
      endAt: '2024-08-16T10:30:00.000Z',
      timezone: 'Asia/Dhaka',
      now: new Date('2026-08-17T12:00:00.000Z'),
      tracePath: 'appointment',
    });

    expect(result).not.toBeNull();
    expect(result?.date).toBe('2026-08-16');
    expect(result?.start_time_utc).toBe('2026-08-16T10:00:00.000Z');
    expect(result?.end_time_utc).toBe('2026-08-16T10:30:00.000Z');
    expect(result?.warnings).toContain('appointment_year_snapped_to_current');
  });

  it('does not change a same-year timestamp', () => {
    const result = resolveAppointmentWindow({
      startAt: '2026-04-20T16:00:00-04:00',
      endAt: '2026-04-20T16:30:00-04:00',
      timezone: 'America/New_York',
      now: new Date('2026-08-17T12:00:00.000Z'),
      tracePath: 'appointment',
    });

    expect(result?.start_time_utc).toBe('2026-04-20T20:00:00.000Z');
    expect(result?.warnings.includes('appointment_year_snapped_to_current')).toBe(false);
  });
});

describe('parseFlexibleDateTime', () => {
  it('treats naive 3pm as Asia/Dhaka local time', () => {
    const parsed = parseFlexibleDateTime('2026-08-16T15:00', 'Asia/Dhaka', new Date('2026-08-17T12:00:00.000Z'));
    expect(parsed).not.toBeNull();
    expect(parsed?.toISOString()).toBe('2026-08-16T09:00:00.000Z');
  });
});
