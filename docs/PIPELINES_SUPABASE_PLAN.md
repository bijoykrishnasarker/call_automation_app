# Plan: Integrate Pipelines with Supabase

## Goal

- **Persist** pipelines, pipeline stages, and deals in Supabase (per user).
- **Load** pipelines and deals from Supabase so the Pipelines page shows real data.
- **Support** all existing UI: Kanban board, add/move deals, edit stages (add/rename/delete), New Deal modal (title, value, contact, stage), quick templates, drag-and-drop, pipeline switcher.

---

## Current State

| Item | Location | Notes |
|------|----------|--------|
| **Types** | [types.ts](types.ts) | `Pipeline` (id, name, stages[]), `PipelineStage` (id, name, color, hasAutomation?), `Deal` (id, contactId, title, value, stageId) |
| **State** | [contexts/AppContext.tsx](contexts/AppContext.tsx) | `pipelines` and `deals` from `MOCK_PIPELINES` / `MOCK_DEALS`; passed to Pipelines page |
| **UI** | [components/Pipeline.tsx](components/Pipeline.tsx), [app/pipelines/page.tsx](app/pipelines/page.tsx) | Pipeline keeps **local state** for pipelines/deals (initialized from props). Handles: add deal, move deal (drag), add/delete/rename stage, edit stages mode, New Deal modal with quick templates, contact/stage dropdowns |

---

## 1. Supabase: Tables and RLS

### 1.1 Table `pipelines`

```sql
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index pipelines_user_id_idx on public.pipelines (user_id);
```

### 1.2 Table `pipeline_stages`

```sql
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null,
  color text not null default 'bg-blue-500',
  position int not null default 0,
  has_automation boolean default false,
  created_at timestamptz default now()
);

create index pipeline_stages_pipeline_id_idx on public.pipeline_stages (pipeline_id);
```

- **position**: order of stages left-to-right (0, 1, 2, …).

### 1.3 Table `deals`

```sql
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  title text not null,
  value numeric not null default 0,
  source text default 'Direct Lead',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index deals_user_id_idx on public.deals (user_id);
create index deals_stage_id_idx on public.deals (stage_id);
create index deals_contact_id_idx on public.deals (contact_id);
```

- **user_id**: for RLS; ensures users only see their own deals.
- **contact_id**: FK to `contacts` (same app contacts table).
- **stage_id**: FK to `pipeline_stages`; moving a deal = update `stage_id`.

### 1.4 (Optional) Table `deal_templates`

Quick templates (e.g. "Standard Service $150") can be stored per user:

```sql
create table public.deal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  value numeric not null default 0,
  position int not null default 0,
  created_at timestamptz default now()
);

create index deal_templates_user_id_idx on public.deal_templates (user_id);
```

- **position**: order in the "Quick Templates" list. Can be implemented in a later phase; until then, templates can remain in component state.

### 1.5 RLS

**Pipelines**

```sql
alter table public.pipelines enable row level security;

create policy "Users can read own pipelines"
  on public.pipelines for select using (auth.uid() = user_id);
create policy "Users can insert own pipelines"
  on public.pipelines for insert with check (auth.uid() = user_id);
create policy "Users can update own pipelines"
  on public.pipelines for update using (auth.uid() = user_id);
create policy "Users can delete own pipelines"
  on public.pipelines for delete using (auth.uid() = user_id);
```

**Pipeline stages** (access via pipeline ownership; we allow CRUD only when the user owns the pipeline). Easiest: allow select/insert/update/delete when the pipeline belongs to the user:

```sql
alter table public.pipeline_stages enable row level security;

create policy "Users can read stages of own pipelines"
  on public.pipeline_stages for select
  using (exists (select 1 from public.pipelines p where p.id = pipeline_stages.pipeline_id and p.user_id = auth.uid()));

create policy "Users can insert stages in own pipelines"
  on public.pipeline_stages for insert
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_stages.pipeline_id and p.user_id = auth.uid()));

create policy "Users can update stages in own pipelines"
  on public.pipeline_stages for update
  using (exists (select 1 from public.pipelines p where p.id = pipeline_stages.pipeline_id and p.user_id = auth.uid()));

create policy "Users can delete stages in own pipelines"
  on public.pipeline_stages for delete
  using (exists (select 1 from public.pipelines p where p.id = pipeline_stages.pipeline_id and p.user_id = auth.uid()));
```

**Deals**

```sql
alter table public.deals enable row level security;

create policy "Users can read own deals"
  on public.deals for select using (auth.uid() = user_id);
create policy "Users can insert own deals"
  on public.deals for insert with check (auth.uid() = user_id);
create policy "Users can update own deals"
  on public.deals for update using (auth.uid() = user_id);
create policy "Users can delete own deals"
  on public.deals for delete using (auth.uid() = user_id);
```

**Deal templates** (if table is created)

```sql
alter table public.deal_templates enable row level security;

create policy "Users can manage own deal_templates"
  on public.deal_templates for all using (auth.uid() = user_id);
```

---

## 2. Service Layer (lib/supabase)

### 2.1 File: `lib/supabase/pipelines.ts`

- **fetchPipelinesWithStages(userId: string)**  
  - Select from `pipelines` where `user_id = userId`, order by `created_at`.  
  - For each pipeline, select from `pipeline_stages` where `pipeline_id = id`, order by `position`.  
  - Return array of `{ id, name, stages: [{ id, name, color, position, has_automation }] }` mapped to app `Pipeline` shape (stages: `PipelineStage[]` with `id`, `name`, `color`, `hasAutomation`).

- **createPipeline(userId: string, name: string)**  
  - Insert into `pipelines`, return new row; map to `Pipeline` with `stages: []`.

- **updatePipeline(pipelineId: string, payload: { name?: string })**  
  - Update `pipelines` by id (RLS ensures ownership). Optional for future.

- **addStage(pipelineId: string, stage: { name: string; color: string; hasAutomation?: boolean })**  
  - Get max `position` for pipeline, insert into `pipeline_stages` with `position = max + 1`. Return new stage mapped to `PipelineStage`.

- **updateStage(stageId: string, payload: { name?: string; color?: string; hasAutomation?: boolean })**  
  - Update `pipeline_stages` by id.

- **deleteStage(stageId: string)**  
  - Delete from `pipeline_stages` (fail or block in app if deals still reference it).

- **reorderStages(pipelineId: string, stageIds: string[])**  
  - Optional: update `position` for each stage by id; can be added later.

### 2.2 File: `lib/supabase/deals.ts`

- **fetchDeals(userId: string)**  
  - Select from `deals` where `user_id = userId`; join or no join. Return array mapped to app `Deal` (id, contactId, title, value, stageId). Use `contact_id` → `contactId`, `stage_id` → `stageId`, `value` as number.

- **createDeal(userId: string, deal: { contactId: string; stageId: string; title: string; value: number; source?: string })**  
  - Insert into `deals`; return new row mapped to `Deal`.

- **updateDeal(dealId: string, payload: { stageId?: string; title?: string; value?: number; contactId?: string })**  
  - Update `deals` by id (used for drag-and-drop move and in-place edit).

- **deleteDeal(dealId: string)**  
  - Optional; delete from `deals`.

Mapping: DB `contact_id`/`stage_id`/`value` (numeric) ↔ app `contactId`/`stageId`/`value` (number).

---

## 3. AppContext Changes

- **State**: Replace mock sources with:
  - `pipelines: Pipeline[]` — loaded from `fetchPipelinesWithStages(userId)`.
  - `deals: Deal[]` — loaded from `fetchDeals(userId)`.
  - `pipelinesLoading: boolean`, `pipelinesError: string | null` (and optionally `dealsLoading`/`dealsError`, or one combined "pipelines data" loading state).

- **Load on login**: In a `useEffect` that depends on `user?.id`, call `fetchPipelinesWithStages` and `fetchDeals`; set state and loading/error.

- **API exposed to Pipeline component**:
  - **addDeal(deal)** → `createDeal(userId, deal)` then append to `deals`.
  - **updateDeal(dealId, payload)** → `updateDeal(dealId, payload)` then update `deals` in state (e.g. move deal to new stage).
  - **createPipeline(name)** → `createPipeline(userId, name)` then append to `pipelines` (with empty stages).
  - **addStage(pipelineId, stage)** → `addStage(pipelineId, stage)` then update `pipelines` in state (add stage to the right pipeline).
  - **updateStage(stageId, payload)** → `updateStage(stageId, payload)` then update `pipelines` in state.
  - **deleteStage(stageId)** → ensure no deals in stage (check in UI or in API), then `deleteStage(stageId)` and remove from `pipelines` state.

- **Ids**: App types use `string` for id; Supabase returns UUIDs. Use UUIDs everywhere (no numeric or timestamp ids from client).

---

## 4. Pipeline Component Changes

- **Data source**: Receive `pipelines` and `deals` from `useApp()` (from context), and use context methods instead of local state for persistence.
- **Initialization**: If `pipelines.length === 0` and not loading, show empty state and/or "Create pipeline" (e.g. from template). Optionally seed one default pipeline with stages on first load (can be done in Supabase or in app after first pipeline create).
- **Add deal**: On "Add Deal" submit, call `addDeal({ contactId, stageId, title, value })` from context; do not only push to local state. Keep local UI state (e.g. modal open/close, form values) in component.
- **Move deal**: On drop, call `updateDeal(dealId, { stageId: targetStageId })` from context.
- **Edit stages**:
  - Add stage: call `addStage(activePipelineId, { name, color, hasAutomation })` from context.
  - Rename stage: call `updateStage(stageId, { name })` from context.
  - Delete stage: call `deleteStage(stageId)` from context (after checking no deals in stage in UI).
- **Create pipeline**: When user creates a new pipeline (e.g. from template), call `createPipeline(userId, name)` then for each default stage call `addStage(newPipelineId, stage)` so all stages are stored in DB.
- **Quick templates**: Keep in component state for v1; later can be moved to `deal_templates` table and loaded/saved via context.
- **Loading/error**: Show loading state while `pipelinesLoading` (and optionally deals); show error message if `pipelinesError` (and optionally retry).

---

## 5. Types

- **Deal**: Ensure `value` is `number` (already in types.ts). API layer converts DB `numeric` to number.
- **Pipeline / PipelineStage**: Use string ids (UUID). Optional: add `position` to `PipelineStage` in types if needed for reorder; otherwise derive order from array order from API.

---

## 6. Implementation Order

1. **Supabase**: Create tables and RLS (pipelines, pipeline_stages, deals; optionally deal_templates).
2. **lib/supabase/pipelines.ts**: Implement fetch, createPipeline, addStage, updateStage, deleteStage.
3. **lib/supabase/deals.ts**: Implement fetchDeals, createDeal, updateDeal.
4. **AppContext**: Add pipelines/deals state, loading/error; load on user; expose addDeal, updateDeal, createPipeline, addStage, updateStage, deleteStage.
5. **Pipeline component**: Wire to context (use context pipelines/deals and context methods; remove local state that duplicates server state; keep modal/form and edit-mode state local).
6. **Empty state / first run**: When no pipelines, show "Create your first pipeline" or create default "Main" pipeline with default stages (New Leads, Contacted, Appointment Set, Won/Closed) either in app or via migration/seed.
7. **(Optional)** deal_templates table + fetch/save from context and "Manage" templates in New Deal modal.

---

## 7. Edge Cases

- **Delete stage**: Prevent delete if any deal has that `stage_id`; show message in UI and/or enforce in API (e.g. return error from deleteStage).
- **Delete pipeline**: If pipeline is deleted, stages are cascade-deleted; deals with those stage_ids would need handling (e.g. restrict delete pipeline if deals exist, or move deals to another pipeline — out of scope for v1).
- **Contact deleted**: Deals reference `contact_id` with `on delete restrict`; deleting a contact will fail while deals reference it. UI can show a warning or prevent contact delete when they have deals.
- **New user**: No pipelines → show empty state and "Create pipeline" or auto-create one default pipeline with default stages.

This plan keeps the existing Pipelines UI and behavior, and moves persistence to Supabase with a clear service layer and context API for the Pipeline component to use.
