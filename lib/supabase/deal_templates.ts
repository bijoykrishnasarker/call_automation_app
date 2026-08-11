import { supabase } from '@/lib/supabase/client';

export interface DealTemplate {
  id: string;
  name: string;
  value: string;
  position: number;
}

interface DealTemplateRow {
  id: string;
  user_id: string;
  name: string;
  value: number;
  position: number;
  created_at: string;
}

function rowToTemplate(row: DealTemplateRow): DealTemplate {
  return {
    id: row.id,
    name: row.name,
    value: String(row.value),
    position: row.position,
  };
}

export async function fetchDealTemplates(userId: string): Promise<DealTemplate[]> {
  const { data, error } = await supabase
    .from('deal_templates')
    .select('*')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

export async function createDealTemplate(
  userId: string,
  template: { name: string; value: number }
): Promise<DealTemplate> {
  const { data: maxPos } = await supabase
    .from('deal_templates')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('deal_templates')
    .insert({
      user_id: userId,
      name: template.name,
      value: template.value,
      position,
    })
    .select('*')
    .single();

  if (error) throw error;
  return rowToTemplate(data as DealTemplateRow);
}

export async function updateDealTemplate(
  templateId: string,
  payload: { name?: string; value?: number; position?: number }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  if (payload.name !== undefined) updatePayload.name = payload.name;
  if (payload.value !== undefined) updatePayload.value = payload.value;
  if (payload.position !== undefined) updatePayload.position = payload.position;
  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await supabase
    .from('deal_templates')
    .update(updatePayload)
    .eq('id', templateId);

  if (error) throw error;
}

export async function deleteDealTemplate(templateId: string): Promise<void> {
  const { error } = await supabase.from('deal_templates').delete().eq('id', templateId);
  if (error) throw error;
}
