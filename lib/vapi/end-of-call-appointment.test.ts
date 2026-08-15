import { describe, expect, it } from 'vitest';

import { buildEndOfCallAppointmentDraft } from '@/lib/vapi/end-of-call-appointment';

describe('buildEndOfCallAppointmentDraft', () => {
  it('builds from structured appointment fields on end-of-call-report', () => {
    const draft = buildEndOfCallAppointmentDraft({
      message: {
        analysis: {
          structuredData: {
            appointment: {
              appointmentRequested: true,
              preferredDate: '2026-08-16',
              preferredTime: '3:30 PM',
            },
            lead: {
              requestedService: 'Consultation',
            },
          },
        },
      },
      payload: {},
      transcriptText: 'Please book me for August 16 at 3:30 PM.',
      referenceAt: '2026-08-15T12:00:00.000Z',
    });

    expect(draft).not.toBeNull();
    expect(draft?.localDate).toBe('2026-08-16');
    expect(draft?.localTime).toBe('15:30');
    expect(draft?.subject).toBe('Consultation');
    expect(draft?.timezone).toBe('Asia/Dhaka');
  });

  it('falls back to transcript parsing when structured date is missing', () => {
    const draft = buildEndOfCallAppointmentDraft({
      message: {
        analysis: {
          structuredData: {
            appointment: {
              appointmentRequested: true,
            },
          },
        },
      },
      payload: {},
      transcriptText: 'Can we schedule an appointment on August 17 at 10 am?',
      referenceAt: '2026-08-15T12:00:00.000Z',
    });

    expect(draft).not.toBeNull();
    expect(draft?.localDate).toBe('2026-08-17');
    expect(draft?.localTime).toBe('10:00');
  });

  it('returns null when no appointment was requested', () => {
    const draft = buildEndOfCallAppointmentDraft({
      message: { analysis: { structuredData: { contact: { fullName: 'Sam' } } } },
      payload: {},
      transcriptText: 'I just wanted to ask your business hours.',
      referenceAt: '2026-08-15T12:00:00.000Z',
    });

    expect(draft).toBeNull();
  });
});
