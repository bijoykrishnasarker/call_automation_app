create extension if not exists pgcrypto;

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table if exists public.contacts
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists external_contact_id text,
  add column if not exists middle_name text,
  add column if not exists primary_phone text,
  add column if not exists mobile_phone text,
  add column if not exists job_title text,
  add column if not exists canonical_created_at timestamptz,
  add column if not exists last_canonical_event_at timestamptz;

update public.contacts
set organization_id = profiles.organization_id
from public.profiles
where public.contacts.organization_id is null
  and public.contacts.user_id = profiles.id;

update public.contacts
set primary_phone = coalesce(primary_phone, phone)
where primary_phone is null;

update public.contacts
set external_contact_id = coalesce(external_contact_id, 'legacy:' || id::text)
where external_contact_id is null;

alter table if exists public.contacts
  alter column external_contact_id set not null;

drop index if exists contacts_org_external_contact_unique;
create unique index if not exists contacts_org_external_contact_unique
  on public.contacts (organization_id, external_contact_id);

create index if not exists contacts_org_primary_phone_idx
  on public.contacts (organization_id, primary_phone)
  where primary_phone is not null;

alter table if exists public.vapi_assistants
  add column if not exists assistant_metadata jsonb not null default '{}'::jsonb,
  add column if not exists webhook_auth_mode text not null default 'optional';

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid null references public.contacts(id) on delete set null,
  contact_external_id text not null,
  external_appointment_id text not null,
  provider text not null default 'vapi',
  provider_call_id text null,
  provider_assistant_id text null,
  subject text not null,
  location text null,
  calendar_id text null,
  recurrence jsonb null,
  status text not null default 'confirmed',
  notes text null,
  timezone text not null,
  date date not null,
  start_time_utc timestamptz not null,
  end_time_utc timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  legacy_booking_id uuid null references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_appointment_id)
);

alter table public.appointments
  drop constraint if exists appointments_contact_external_fk;

alter table public.appointments
  add constraint appointments_contact_external_fk
    foreign key (organization_id, contact_external_id)
    references public.contacts(organization_id, external_contact_id)
    on delete restrict;

create index if not exists appointments_contact_external_idx
  on public.appointments (organization_id, contact_external_id);

create index if not exists appointments_contact_id_idx
  on public.appointments (contact_id);

create index if not exists appointments_start_time_idx
  on public.appointments (organization_id, start_time_utc);

create index if not exists appointments_legacy_booking_idx
  on public.appointments (legacy_booking_id)
  where legacy_booking_id is not null;

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.vapi_webhook_receipts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'vapi',
  provider_delivery_id text not null unique,
  provider_event_type text not null,
  provider_call_id text null,
  provider_assistant_id text null,
  organization_id uuid null references public.organizations(id) on delete set null,
  auth_verified boolean not null default false,
  auth_mode text not null default 'optional',
  auth_method text null,
  auth_context jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null,
  raw_payload_sha256 text not null,
  status text not null default 'received',
  attempts integer not null default 0,
  last_error jsonb null,
  first_received_at timestamptz not null default now(),
  last_received_at timestamptz not null default now(),
  processed_at timestamptz null,
  next_retry_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vapi_webhook_receipts_status_retry_idx
  on public.vapi_webhook_receipts (status, next_retry_at);

create index if not exists vapi_webhook_receipts_call_idx
  on public.vapi_webhook_receipts (provider_call_id);

drop trigger if exists set_vapi_webhook_receipts_updated_at on public.vapi_webhook_receipts;
create trigger set_vapi_webhook_receipts_updated_at
before update on public.vapi_webhook_receipts
for each row
execute function public.set_updated_at_timestamp();

create table if not exists public.vapi_webhook_dead_letters (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.vapi_webhook_receipts(id) on delete cascade,
  provider_delivery_id text not null,
  organization_id uuid null references public.organizations(id) on delete set null,
  provider_call_id text null,
  error_snapshot jsonb not null,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists vapi_webhook_dead_letters_receipt_idx
  on public.vapi_webhook_dead_letters (receipt_id);

create table if not exists public.vapi_event_projections (
  id uuid primary key default gen_random_uuid(),
  provider_delivery_id text not null,
  organization_id uuid null references public.organizations(id) on delete set null,
  provider_call_id text null,
  projection_key text not null unique,
  external_resource_id text null,
  resource_type text not null,
  operation text not null,
  outcome text not null default 'created',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vapi_event_projections_resource_idx
  on public.vapi_event_projections (resource_type, external_resource_id);

drop trigger if exists set_vapi_event_projections_updated_at on public.vapi_event_projections;
create trigger set_vapi_event_projections_updated_at
before update on public.vapi_event_projections
for each row
execute function public.set_updated_at_timestamp();

alter table public.appointments enable row level security;
alter table public.vapi_webhook_receipts enable row level security;
alter table public.vapi_webhook_dead_letters enable row level security;
alter table public.vapi_event_projections enable row level security;

drop policy if exists appointments_select_for_org_members on public.appointments;
create policy appointments_select_for_org_members
  on public.appointments
  for select
  using (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.organization_id = public.appointments.organization_id
    )
  );

drop policy if exists appointments_modify_for_org_members on public.appointments;
create policy appointments_modify_for_org_members
  on public.appointments
  for all
  using (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.organization_id = public.appointments.organization_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.organization_id = public.appointments.organization_id
    )
  );

drop policy if exists vapi_webhook_receipts_select_for_org_members on public.vapi_webhook_receipts;
create policy vapi_webhook_receipts_select_for_org_members
  on public.vapi_webhook_receipts
  for select
  using (
    organization_id is null
    or exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.organization_id = public.vapi_webhook_receipts.organization_id
    )
  );

drop policy if exists vapi_webhook_dead_letters_select_for_org_members on public.vapi_webhook_dead_letters;
create policy vapi_webhook_dead_letters_select_for_org_members
  on public.vapi_webhook_dead_letters
  for select
  using (
    organization_id is null
    or exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.organization_id = public.vapi_webhook_dead_letters.organization_id
    )
  );

drop policy if exists vapi_event_projections_select_for_org_members on public.vapi_event_projections;
create policy vapi_event_projections_select_for_org_members
  on public.vapi_event_projections
  for select
  using (
    organization_id is null
    or exists (
      select 1
      from public.profiles
      where public.profiles.id = auth.uid()
        and public.profiles.organization_id = public.vapi_event_projections.organization_id
    )
  );
