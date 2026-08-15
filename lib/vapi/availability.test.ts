import { describe, expect, it } from 'vitest';

import { buildAvailabilityResult } from '@/lib/vapi/availability';

describe('buildAvailabilityResult', () => {
  it('says the requested slot is free when the calendar is empty', () => {
    const start = new Date('2026-08-16T09:00:00.000Z'); // 3:00 PM in Asia/Dhaka (UTC+6)
    const end = new Date('2026-08-16T09:30:00.000Z');
    const result = buildAvailabilityResult({
      requestedStart: start,
      requestedEnd: end,
      busy: [],
      timezone: 'Asia/Dhaka',
    });

    expect(result.isAvailable).toBe(true);
    expect(result.message).toMatch(/is free/i);
    expect(result.requestedSlot.display).toMatch(/3:00 PM/);
  });

  it('rejects a taken 3pm slot and suggests later open times', () => {
    const start = new Date('2026-08-16T09:00:00.000Z');
    const end = new Date('2026-08-16T09:30:00.000Z');
    const result = buildAvailabilityResult({
      requestedStart: start,
      requestedEnd: end,
      busy: [{ start: start.getTime(), end: end.getTime() }],
      timezone: 'Asia/Dhaka',
    });

    expect(result.isAvailable).toBe(false);
    expect(result.message).toMatch(/already booked/i);
    expect(result.suggestedSlots.length).toBeGreaterThan(0);
    expect(result.suggestedSlots[0]?.display).toMatch(/3:30 PM/);
    expect(result.suggestedSlots.some(slot => slot.startAt === start.toISOString())).toBe(false);
  });
});
