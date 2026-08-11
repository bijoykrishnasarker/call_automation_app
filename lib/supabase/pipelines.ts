import { Pipeline, PipelineStage } from '@/types';
import { supabase } from '@/lib/supabase/client';

interface PipelineRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface PipelineStageRow {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  position: number;
  has_automation: boolean;
  created_at: string;
}

function stageRowToStage(row: PipelineStageRow): PipelineStage {
  return {
    id: row.id,
    name: row.name,
    color: row.color || 'bg-blue-500',
    hasAutomation: row.has_automation ?? false,
  };
}

export async function fetchPipelinesWithStages(userId: string): Promise<Pipeline[]> {
  const { data: pipelineRows, error: pipelinesError } = await supabase
    .from('pipelines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (pipelinesError) throw pipelinesError;
  if (!pipelineRows?.length) return [];

  const { data: stageRows, error: stagesError } = await supabase
    .from('pipeline_stages')
    .select('*')
    .in('pipeline_id', pipelineRows.map((p: PipelineRow) => p.id))
    .order('position', { ascending: true });

  if (stagesError) throw stagesError;

  const stagesByPipeline = (stageRows ?? []).reduce<Record<string, PipelineStage[]>>((acc, row: PipelineStageRow) => {
    const pid = row.pipeline_id;
    if (!acc[pid]) acc[pid] = [];
    acc[pid].push(stageRowToStage(row));
    return acc;
  }, {});

  return pipelineRows.map((p: PipelineRow) => ({
    id: p.id,
    name: p.name,
    stages: stagesByPipeline[p.id] ?? [],
  }));
}

export async function createPipeline(userId: string, name: string): Promise<Pipeline> {
  const { data, error } = await supabase
    .from('pipelines')
    .insert({ user_id: userId, name })
    .select('*')
    .single();

  if (error) throw error;
  const row = data as PipelineRow;
  return { id: row.id, name: row.name, stages: [] };
}

export async function addStage(
  pipelineId: string,
  stage: { name: string; color: string; hasAutomation?: boolean }
): Promise<PipelineStage> {
  const { data: maxPos } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('pipeline_id', pipelineId)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from('pipeline_stages')
    .insert({
      pipeline_id: pipelineId,
      name: stage.name,
      color: stage.color,
      position,
      has_automation: stage.hasAutomation ?? false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return stageRowToStage(data as PipelineStageRow);
}

export async function updateStage(
  stageId: string,
  payload: { name?: string; color?: string; hasAutomation?: boolean }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  if (payload.name !== undefined) updatePayload.name = payload.name;
  if (payload.color !== undefined) updatePayload.color = payload.color;
  if (payload.hasAutomation !== undefined) updatePayload.has_automation = payload.hasAutomation;
  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await supabase
    .from('pipeline_stages')
    .update(updatePayload)
    .eq('id', stageId);

  if (error) throw error;
}

export async function deleteStage(stageId: string): Promise<void> {
  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId);
  if (error) throw error;
}
