import { Appointment } from '@/types';
import { supabase } from '@/lib/supabase/client';

export interface BookingRow {
  id: string;
  user_id: string;
  contact_id: string;
  title: string;
  start_at: string;
  end_at: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToAppointment(row: BookingRow, contactName: string = ''): Appointment {
  const start = new Date(row.start_at);
  let end = new Date(row.end_at);
  if (Number.isNaN(start.getTime())) {
    end = new Date(start);
  } else if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + 30 * 60 * 1000);
  }

  return {
    id: row.id,
    title: row.title,
    contactId: row.contact_id,
    contactName,
    start,
    end,
    type: row.type as Appointment['type'],
    status: row.status as Appointment['status'],
  };
}

export async function fetchBookings(userId: string): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .order('start_at', { ascending: true });

  if (error) throw new Error(error.message || 'Failed to load bookings');
  return (data ?? []) as BookingRow[];
}

export function mapBookingsWithContactNames(
  rows: BookingRow[],
  getContactName: (contactId: string) => string
): Appointment[] {
  return rows.map(row => rowToAppointment(row, getContactName(row.contact_id)));
}

export async function createBooking(
  _userId: string,
  payload: {
    contactId: string;
    title: string;
    startAt: Date;
    endAt: Date;
    type: Appointment['type'];
    status?: Appointment['status'];
  }
): Promise<BookingRow> {
  if (Number.isNaN(payload.startAt.getTime()) || Number.isNaN(payload.endAt.getTime())) {
    throw new Error('Enter a valid date and time.');
  }
  if (payload.endAt.getTime() <= payload.startAt.getTime()) {
    throw new Error('End time must be after start time.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sign in to create a booking.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contactId: payload.contactId,
        title: payload.title,
        startAt: payload.startAt.toISOString(),
        endAt: payload.endAt.toISOString(),
        type: payload.type,
        status: payload.status ?? 'Pending',
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({})) as { booking?: BookingRow; message?: string };
    if (!res.ok || !data.booking) {
      throw new Error(data.message || 'Failed to create booking');
    }
    return data.booking;
  } catch (err) {
    if (
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      throw new Error('Booking took too long. Please try again.');
    }
    throw err instanceof Error ? err : new Error('Failed to create booking');
  } finally {
    clearTimeout(timer);
  }
}

export async function updateBooking(
  bookingId: string,
  payload: {
    contactId?: string;
    title?: string;
    startAt?: Date;
    endAt?: Date;
    type?: Appointment['type'];
    status?: Appointment['status'];
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  if (payload.contactId !== undefined) updatePayload.contact_id = payload.contactId;
  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.startAt !== undefined) updatePayload.start_at = payload.startAt.toISOString();
  if (payload.endAt !== undefined) updatePayload.end_at = payload.endAt.toISOString();
  if (payload.type !== undefined) updatePayload.type = payload.type;
  if (payload.status !== undefined) updatePayload.status = payload.status;
  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await supabase
    .from('bookings')
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (error) throw new Error(error.message || 'Failed to update booking');
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) throw new Error(error.message || 'Failed to delete booking');
}

/** Removes all bookings for a contact (e.g. before deleting the contact; FK is restrict). */
export async function deleteBookingsForContact(userId: string, contactId: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('user_id', userId).eq('contact_id', contactId);
  if (error) throw new Error(error.message || 'Failed to delete bookings');
}
