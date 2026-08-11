# Supabase Schema: Vapi Call Logging & Webhooks

This document defines tables used to store inbound and outbound Vapi call metadata and transcripts per organization.

It assumes the tenant model from `ORGANIZATIONS_SUPABASE_PLAN.md` and receptionist schema from `AI_RECEPTIONIST_SUPABASE_SCHEMA.md`.

---

## 1. `public.calls`

```sql
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vapi_call_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text,
  to_number text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create unique index if not exists calls_vapi_call_id_unique
  on public.calls (vapi_call_id);

create index if not exists calls_org_idx
  on public.calls (organization_id, created_at desc);
```

### 1.1 RLS

```sql
alter table public.calls enable row level security;

create policy if not exists "Org members can read calls"
  on public.calls
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
```

---

## 2. `public.call_events`

```sql
create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists call_events_call_id_idx
  on public.call_events (call_id, created_at);
```

RLS is inherited from `calls` via the FK; direct access can be limited to server-side service role if desired.

---

## 3. `public.call_transcripts`

```sql
create table if not exists public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls (id) on delete cascade,
  transcript text,
  created_at timestamptz not null default now()
);
```

---

## 4. Webhook endpoint

Inbound and outbound Vapi calls should send events to:

```text
POST /api/vapi/webhook
```

The handler will:

1. Validate the request (e.g. shared secret, HMAC, or allowlist by IP if configured).
2. Determine `organization_id` based on metadata in the Vapi call:
   - For assistant-based routing, you can store `organization_id` in `assistant.metadata` or pass it via `assistantOverrides` / variables when starting a call.
   - Alternatively, look up the associated `vapi_phone_numbers` row by `to_number` and read `organization_id` from there.
3. Upsert a row in `calls` using `vapi_call_id`.
4. Insert raw event data into `call_events`.
5. Optionally append human-readable text to `call_transcripts` when a final transcript is provided by Vapi.
6. On **`end-of-call-report`** for **inbound** calls (to a number in `vapi_phone_numbers`), upsert a **contact** for the caller (`from` number) as a **New Lead** with source **AI Receptionist**, and append a short call-log note. This runs once per call (not on every status ping). Ensure the assistant’s **Server URL** includes `end-of-call-report` in server messages (Vapi default includes it).

