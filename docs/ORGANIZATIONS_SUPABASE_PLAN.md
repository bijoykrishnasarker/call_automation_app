# Supabase Tenant Model: Organizations & Profiles

This document defines the multi-tenant data model for the SaaS AI receptionist. It complements the existing `contacts`, `pipelines`, `bookings`, and `ai_receptionists` tables.

The **single source of truth** for tenant isolation is `profiles.organization_id`. Every API route must resolve the current organization via `getOrganizationIdForUser` and never accept `organization_id` from the client.

---

## 1. Core tables

### 1.1 `public.organizations`

One row per tenant (company / workspace).

```sql
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists organizations_owner_user_id_idx
  on public.organizations (owner_user_id);
```

### 1.2 `public.profiles`

Profile row per authenticated user, linked to an organization.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);
```

If a `profiles` table already exists, apply:

```sql
alter table public.profiles
  add column if not exists organization_id uuid references public.organizations (id) on delete restrict,
  add column if not exists role text not null default 'owner';

create index if not exists profiles_organization_id_idx
  on public.profiles (organization_id);
```

Populate `organization_id` by creating an organization per existing user and updating their profile row.

### 1.3 `public.organization_members` (optional, for multi-user orgs)

Use this table if you want multiple users per organization with different roles.

```sql
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  invited_at timestamptz not null default now(),
  accepted_at timestamptz
);

create unique index if not exists organization_members_org_user_unique
  on public.organization_members (organization_id, user_id);
```

For the current app, `profiles.organization_id` remains the canonical source for the “current” organization. `organization_members` is useful for future org switching and invitations.

---

## 2. Row Level Security (RLS)

Enable RLS so all tenant data is scoped by `organization_id`.

### 2.1 `organizations`

```sql
alter table public.organizations enable row level security;

create policy if not exists "Org owners/admins can view org"
  on public.organizations
  for select using (
    id in (
      select organization_id
      from public.profiles
      where id = auth.uid()
    )
  );
```

For now, only the user whose profile points at the organization can see it. If you adopt `organization_members`, you can extend this policy to include members.

### 2.2 `profiles`

```sql
alter table public.profiles enable row level security;

create policy if not exists "Users can view own profile"
  on public.profiles
  for select using (id = auth.uid());

create policy if not exists "Users can update own profile"
  on public.profiles
  for update using (id = auth.uid());
```

`organization_id` is driven by onboarding flows (see below); normal users do not change it directly.

### 2.3 `organization_members` (optional)

```sql
alter table public.organization_members enable row level security;

create policy if not exists "Users can view their org memberships"
  on public.organization_members
  for select using (user_id = auth.uid());
```

---

## 3. Onboarding and org resolution

### 3.1 On first login

When a new user signs in:

1. Check if they already have a `profiles` row.\n2. If not, create a new row and a new `organizations` row in a single transaction:\n   - Insert into `organizations` with `owner_user_id = auth.uid()`.\n   - Insert into `profiles` with `id = auth.uid()` and `organization_id` set to the new org id; `role = 'owner'`.\n3. Optionally insert an `organization_members` row for the owner.\n

This keeps `profiles.organization_id` populated for all authenticated users.

### 3.2 Resolving `organization_id` in the app

All server routes must call the existing helper:

```ts
// lib/auth/get-organization-id.ts
export async function getOrganizationIdForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) return null;
  const orgId = data?.organization_id;
  return typeof orgId === 'string' && orgId.length > 0 ? orgId : null;
}
```

No route may read `organization_id` directly from headers, query params, or request bodies.

---

## 4. How this ties into the rest of the app

- All tenant-aware tables (`ai_receptionists`, future `vapi_assistants`, `vapi_phone_numbers`, `calls`, `subscriptions`, etc.) must include an `organization_id uuid not null` column that references `public.organizations(id)`.
- RLS on those tables should follow the same pattern: allow access only where `organization_id` matches the organization returned by `profiles` for `auth.uid()`.
- Frontend components do **not** need to know about organizations directly; they simply call authenticated API routes, and the server resolves the correct organization using `getOrganizationIdForUser`.

