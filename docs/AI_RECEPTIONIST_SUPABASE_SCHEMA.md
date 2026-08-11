# Supabase Schema: AI Receptionist, Vapi Assistants & Phone Numbers

This document defines the database schema for the AI receptionist SaaS features. It assumes the tenant model from `ORGANIZATIONS_SUPABASE_PLAN.md` is in place, with `organizations` and `profiles.organization_id` as the single source of truth for tenancy.

---

## 1. `public.ai_receptionists`

Single configuration row per organization. This table now also stores the
business profile and high-level behavior toggles used to compile the Vapi
assistant prompt.

```sql
create table if not exists public.ai_receptionists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Core voice settings
  is_enabled boolean not null default false,
  agent_name text not null,
  voice text not null, -- maps to frontend voiceModel
  speed double precision not null default 1.0,
  live_transfer_number text,
  answer_after_hours_only boolean not null default false,

  -- Business profile
  business_name text,
  business_type text,
  business_address text,
  business_hours text,

  -- Behavior toggles kept deliberately high-level/non-technical
  can_answer_questions boolean not null default true,
  can_take_messages boolean not null default true,
  can_book_appointments boolean not null default false,
  transfer_urgent_calls boolean not null default false,

  -- Services & knowledge (mirrors AI Center form; used for Vapi prompt and UI reload)
  services jsonb not null default '[]'::jsonb,
  additional_business_info text,
  greeting_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce one row per organization
create unique index if not exists ai_receptionists_organization_id_unique
  on public.ai_receptionists (organization_id);

create index if not exists ai_receptionists_is_enabled_idx
  on public.ai_receptionists (is_enabled);
```

### 1.1 RLS

```sql
alter table public.ai_receptionists enable row level security;

create policy if not exists "Org members can read receptionist settings"
  on public.ai_receptionists
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy if not exists "Org members can upsert receptionist settings"
  on public.ai_receptionists
  for insert with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy if not exists "Org members can update receptionist settings"
  on public.ai_receptionists
  for update using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
```

---

## 2. `public.vapi_assistants`

Stores the primary Vapi assistant per organization (and allows for future multiples).

```sql
create table if not exists public.vapi_assistants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vapi_assistant_id text not null,
  name text not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_test_call_at timestamptz
);

create unique index if not exists vapi_assistants_org_primary_unique
  on public.vapi_assistants (organization_id)
  where is_primary;

create index if not exists vapi_assistants_org_idx
  on public.vapi_assistants (organization_id);
```

### 2.1 RLS

```sql
alter table public.vapi_assistants enable row level security;

create policy if not exists "Org members can read assistants"
  on public.vapi_assistants
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy if not exists "Org members can manage assistants"
  on public.vapi_assistants
  for all using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  ) with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
```

---

## 3. `public.vapi_phone_numbers`

Tracks Vapi-provisioned phone numbers per organization.

```sql
create table if not exists public.vapi_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  vapi_phone_number_id text not null,
  e164_number text not null,
  is_primary boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists vapi_phone_numbers_org_primary_unique
  on public.vapi_phone_numbers (organization_id)
  where is_primary;

create unique index if not exists vapi_phone_numbers_e164_unique
  on public.vapi_phone_numbers (e164_number);
```

### 3.1 RLS

```sql
alter table public.vapi_phone_numbers enable row level security;

create policy if not exists "Org members can read phone numbers"
  on public.vapi_phone_numbers
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy if not exists "Org members can manage phone numbers"
  on public.vapi_phone_numbers
  for all using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  ) with check (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
```

---

## 4. Usage notes

- Application code must continue to resolve `organization_id` exclusively via the `getOrganizationIdForUser` helper; it should **never** trust client-provided `organization_id`.
- `ai_receptionists` holds the logical settings and business profile; `vapi_assistants` / `vapi_phone_numbers` hold the concrete Vapi resources created from those settings.
- Test Voice and production call flows should use the organization’s **primary** assistant and phone number from these tables.

---

## 5. Migration snippet for existing projects

If you created `public.ai_receptionists` before the behavior toggles and
business profile fields were added, run the following migration in Supabase:

```sql
alter table public.ai_receptionists
  add column if not exists business_name text,
  add column if not exists business_type text,
  add column if not exists business_address text,
  add column if not exists business_hours text,
  add column if not exists can_answer_questions boolean not null default true,
  add column if not exists can_take_messages boolean not null default true,
  add column if not exists can_book_appointments boolean not null default false,
  add column if not exists transfer_urgent_calls boolean not null default false;
```

If you need **services, additional business info, and greeting message** persistence (AI Center “Services & Knowledge” and greeting), run:

```sql
alter table public.ai_receptionists
  add column if not exists services jsonb not null default '[]'::jsonb,
  add column if not exists additional_business_info text,
  add column if not exists greeting_message text;
```

> Note: `vapi_assistant_id` and `vapi_phone_number` are stored in the
> `vapi_assistants` and `vapi_phone_numbers` tables respectively so they can
> support multiple resources per organization; they do not need to be
> duplicated on `ai_receptionists`.

---

## 6. (Optional) Messages table for “Take messages” tool

```sql
create table if not exists public.receptionist_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  call_id uuid references public.calls (id) on delete set null,
  from_number text,
  customer_name text,
  message text not null,
  raw_arguments jsonb,
  created_at timestamptz not null default now()
);

create index if not exists receptionist_messages_org_created_idx
  on public.receptionist_messages (organization_id, created_at desc);
```

