import { Deal } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface DealRow {
  id: string;
  user_id: string;
  contact_id: string;
  stage_id: string;
  title: string;
  value: number;
  source: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDeal(row: DealRow): Deal {
  return {
    id: row.id,
    contactId: row.contact_id,
    stageId: row.stage_id,
    title: row.title,
    value: Number(row.value),
  };
}

export async function fetchDeals(userId: string): Promise<Deal[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToDeal);
}

export async function createDeal(
  _userId: string,
  deal: { contactId: string; stageId: string; title: string; value: number; source?: string }
): Promise<Deal> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Sign in to add a deal.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        contactId: deal.contactId,
        stageId: deal.stageId,
        title: deal.title,
        value: deal.value,
        source: deal.source ?? 'Direct Lead',
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({})) as { deal?: DealRow; message?: string };
    if (!res.ok || !data.deal) {
      throw new Error(data.message || 'Failed to add deal');
    }
    return rowToDeal(data.deal);
  } catch (err) {
    if (
      (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      throw new Error('Adding the deal took too long. Please try again.');
    }
    throw err instanceof Error ? err : new Error('Failed to add deal');
  } finally {
    clearTimeout(timer);
  }
}

export async function updateDeal(
  dealId: string,
  payload: { stageId?: string; title?: string; value?: number; contactId?: string }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  if (payload.stageId !== undefined) updatePayload.stage_id = payload.stageId;
  if (payload.title !== undefined) updatePayload.title = payload.title;
  if (payload.value !== undefined) updatePayload.value = payload.value;
  if (payload.contactId !== undefined) updatePayload.contact_id = payload.contactId;
  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await supabase
    .from('deals')
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq('id', dealId);

  if (error) throw error;
}

export async function deleteDeal(dealId: string): Promise<void> {
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  if (error) throw error;
}

/** Removes all deals for a contact (e.g. before deleting the contact; FK is restrict). */
export async function deleteDealsForContact(userId: string, contactId: string): Promise<void> {
  const { error } = await supabase.from('deals').delete().eq('user_id', userId).eq('contact_id', contactId);
  if (error) throw error;
}
