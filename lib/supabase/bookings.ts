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
  return {
    id: row.id,
    title: row.title,
    contactId: row.contact_id,
    contactName,
    start: new Date(row.start_at),
    end: new Date(row.end_at),
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

  if (error) throw error;
  return (data ?? []) as BookingRow[];
}

export function mapBookingsWithContactNames(
  rows: BookingRow[],
  getContactName: (contactId: string) => string
): Appointment[] {
  return rows.map(row => rowToAppointment(row, getContactName(row.contact_id)));
}

export async function createBooking(
  userId: string,
  payload: {
    contactId: string;
    title: string;
    startAt: Date;
    endAt: Date;
    type: Appointment['type'];
    status?: Appointment['status'];
  }
): Promise<BookingRow> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      contact_id: payload.contactId,
      title: payload.title,
      start_at: payload.startAt.toISOString(),
      end_at: payload.endAt.toISOString(),
      type: payload.type,
      status: payload.status ?? 'Pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as BookingRow;
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

  if (error) throw error;
}

export async function deleteBooking(bookingId: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) throw error;
}

/** Removes all bookings for a contact (e.g. before deleting the contact; FK is restrict). */
export async function deleteBookingsForContact(userId: string, contactId: string): Promise<void> {
  const { error } = await supabase.from('bookings').delete().eq('user_id', userId).eq('contact_id', contactId);
  if (error) throw error;
}
