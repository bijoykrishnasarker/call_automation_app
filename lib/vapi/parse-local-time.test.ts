import { describe, expect, it } from 'vitest';

import { normalizeAppointmentLocalTime } from '@/lib/vapi/parse-local-time';

describe('normalizeAppointmentLocalTime', () => {
  it('treats bare 4 as 4 PM', () => {
    expect(normalizeAppointmentLocalTime('4')).toBe('16:00');
  });

  it('treats 4:00 without meridiem as 4 PM', () => {
    expect(normalizeAppointmentLocalTime('4:00')).toBe('16:00');
  });

  it('keeps explicit am/pm', () => {
    expect(normalizeAppointmentLocalTime('4:30 PM')).toBe('16:30');
    expect(normalizeAppointmentLocalTime('10:00 AM')).toBe('10:00');
  });

  it('treats 10:00 without meridiem as 10 AM', () => {
    expect(normalizeAppointmentLocalTime('10:00')).toBe('10:00');
  });
});
