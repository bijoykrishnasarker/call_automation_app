# Billing & Usage: Subscriptions and Call Usage

This document outlines a Stripe-style billing model for the AI receptionist SaaS.

It focuses on per-organization subscriptions and metered usage based on call activity.

---

## 1. `public.subscriptions`

Tracks each organization’s current plan and status.

```sql
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_code text not null, -- e.g. 'starter', 'pro'
  status text not null, -- 'active', 'past_due', 'canceled', 'trialing'
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_org_unique
  on public.subscriptions (organization_id);
```

RLS:

```sql
alter table public.subscriptions enable row level security;

create policy if not exists "Org members can read subscription"
  on public.subscriptions
  for select using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );
```

---

## 2. `public.call_usage`

Aggregated usage per organization and billing period.

```sql
create table if not exists public.call_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_calls integer not null default 0,
  total_seconds integer not null default 0,
  total_billable_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists call_usage_org_period_unique
  on public.call_usage (organization_id, period_start, period_end);
```

Usage rows can be updated by a scheduled job that aggregates from the `calls` table.

---

## 3. Stripe webhook (high level)

- Add a Next.js route (not yet implemented here) such as:

```text
POST /api/billing/stripe-webhook
```

This route should:

1. Verify the Stripe signature.
2. On `customer.subscription.created` / `updated` / `deleted`, upsert a row in `subscriptions` keyed by `organization_id` (which you can store in `stripe_customer_id` or metadata).
3. On `invoice.paid`, you can choose to reset usage counters or mark the period as billed.

---

## 4. Gating features by subscription

Application code can use `subscriptions.status` and `plan_code` to control:

- Whether an organization is allowed to enable the AI receptionist.
- The maximum allowed minutes per period (derived from `plan_code` and `call_usage.total_billable_minutes`).
- When to show warnings in the UI (e.g. 80% of quota used).

