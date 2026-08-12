-- ============================================================
-- LeadOps AI — Complete Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Helper: auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Organizations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx ON public.organizations (owner_user_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners can view their own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Owners can update their own organizations" ON public.organizations;
CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owners can view their own organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));
CREATE POLICY "Owners can update their own organizations"
  ON public.organizations FOR UPDATE TO authenticated
  USING (auth.uid() = owner_user_id);
GRANT ALL ON public.organizations TO authenticated;

-- ============================================================
-- 3. Profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';
CREATE INDEX IF NOT EXISTS profiles_organization_id_idx ON public.profiles (organization_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
GRANT ALL ON public.profiles TO authenticated;

-- ============================================================
-- 4. Contacts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  email_confirmed boolean DEFAULT false,
  phone text NOT NULL DEFAULT '',
  company text,
  status text DEFAULT 'New Lead',
  tags text[] NOT NULL DEFAULT '{}',
  source text DEFAULT 'Manual Entry',
  last_activity text,
  address text,
  city text,
  state text,
  zip text,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Vapi call fields
  external_contact_id text,
  primary_phone text,
  mobile_phone text,
  job_title text,
  canonical_created_at timestamptz,
  last_canonical_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts (user_id);
CREATE INDEX IF NOT EXISTS contacts_organization_id_idx ON public.contacts (organization_id);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON public.contacts (email);
CREATE INDEX IF NOT EXISTS contacts_phone_idx ON public.contacts (phone);

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Org members can manage contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts"
  ON public.contacts FOR ALL
  USING (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ))
  WITH CHECK (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));
GRANT ALL ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;

-- ============================================================
-- 5. Pipelines + Stages
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pipelines
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  position integer NOT NULL DEFAULT 0,
  has_automation boolean NOT NULL DEFAULT false
);
ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS has_automation boolean NOT NULL DEFAULT false;

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON public.pipelines;
CREATE POLICY "Users can manage own pipelines"
  ON public.pipelines FOR ALL
  USING (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ))
  WITH CHECK (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stages inherit pipeline access" ON public.pipeline_stages;
CREATE POLICY "Stages inherit pipeline access"
  ON public.pipeline_stages FOR ALL
  USING (pipeline_id IN (SELECT id FROM public.pipelines));
GRANT ALL ON public.pipelines TO authenticated;
GRANT ALL ON public.pipeline_stages TO authenticated;

-- ============================================================
-- 6. Deals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  pipeline_id uuid REFERENCES public.pipelines (id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.pipeline_stages (id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  title text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  status text DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS deals_user_id_idx ON public.deals (user_id);
CREATE INDEX IF NOT EXISTS deals_pipeline_id_idx ON public.deals (pipeline_id);
CREATE INDEX IF NOT EXISTS deals_stage_id_idx ON public.deals (stage_id);

DROP TRIGGER IF EXISTS set_deals_updated_at ON public.deals;
CREATE TRIGGER set_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;
CREATE POLICY "Users can manage own deals"
  ON public.deals FOR ALL
  USING (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ))
  WITH CHECK (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));
GRANT ALL ON public.deals TO authenticated;

-- ============================================================
-- 7. Deal Templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own deal templates" ON public.deal_templates;
CREATE POLICY "Users can manage own deal templates"
  ON public.deal_templates FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
GRANT ALL ON public.deal_templates TO authenticated;

-- ============================================================
-- 8. Bookings (Calendar Events)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  -- Vapi booking fields (from webhook)
  customer_name text,
  customer_phone text,
  customer_email text,
  subject text,
  call_notes text,
  timezone text DEFAULT 'UTC',
  -- Calendar UI fields
  title text NOT NULL DEFAULT 'Appointment',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  type text NOT NULL DEFAULT 'Service',
  status text NOT NULL DEFAULT 'Pending',
  -- Vapi link
  provider text DEFAULT 'manual',
  provider_call_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS call_notes text;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider text DEFAULT 'manual';
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_call_id text;
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_organization_id_idx ON public.bookings (organization_id);
CREATE INDEX IF NOT EXISTS bookings_start_at_idx ON public.bookings (start_at);
CREATE INDEX IF NOT EXISTS bookings_contact_id_idx ON public.bookings (contact_id);

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own bookings" ON public.bookings;
CREATE POLICY "Users can manage own bookings"
  ON public.bookings FOR ALL
  USING (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ))
  WITH CHECK (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));
GRANT ALL ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

-- ============================================================
-- 9. AI Receptionists (Voice Receptionist Settings)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_receptionists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  agent_name text NOT NULL DEFAULT 'Sarah',
  voice text NOT NULL DEFAULT 'sarah',
  speed double precision NOT NULL DEFAULT 1.0,
  live_transfer_number text,
  answer_after_hours_only boolean NOT NULL DEFAULT false,
  business_name text,
  business_type text,
  business_address text,
  business_hours text,
  can_answer_questions boolean NOT NULL DEFAULT true,
  can_take_messages boolean NOT NULL DEFAULT true,
  can_book_appointments boolean NOT NULL DEFAULT false,
  transfer_urgent_calls boolean NOT NULL DEFAULT false,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  additional_business_info text,
  greeting_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Add any missing columns if table already exists
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS business_address text;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS business_hours text;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS can_answer_questions boolean NOT NULL DEFAULT true;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS can_take_messages boolean NOT NULL DEFAULT true;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS can_book_appointments boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS transfer_urgent_calls boolean NOT NULL DEFAULT false;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS additional_business_info text;
ALTER TABLE public.ai_receptionists ADD COLUMN IF NOT EXISTS greeting_message text;

CREATE UNIQUE INDEX IF NOT EXISTS ai_receptionists_organization_id_unique
  ON public.ai_receptionists (organization_id);
CREATE INDEX IF NOT EXISTS ai_receptionists_is_enabled_idx
  ON public.ai_receptionists (is_enabled);

DROP TRIGGER IF EXISTS set_ai_receptionists_updated_at ON public.ai_receptionists;
CREATE TRIGGER set_ai_receptionists_updated_at
  BEFORE UPDATE ON public.ai_receptionists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.ai_receptionists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read receptionist settings" ON public.ai_receptionists;
DROP POLICY IF EXISTS "Org members can upsert receptionist settings" ON public.ai_receptionists;
DROP POLICY IF EXISTS "Org members can update receptionist settings" ON public.ai_receptionists;
CREATE POLICY "Org members can read receptionist settings"
  ON public.ai_receptionists FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can upsert receptionist settings"
  ON public.ai_receptionists FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Org members can update receptionist settings"
  ON public.ai_receptionists FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- ============================================================
-- 10. Vapi Assistants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vapi_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  vapi_assistant_id text NOT NULL,
  name text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  assistant_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_auth_mode text NOT NULL DEFAULT 'optional',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  last_test_call_at timestamptz
);
ALTER TABLE public.vapi_assistants ADD COLUMN IF NOT EXISTS assistant_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.vapi_assistants ADD COLUMN IF NOT EXISTS webhook_auth_mode text NOT NULL DEFAULT 'optional';

CREATE UNIQUE INDEX IF NOT EXISTS vapi_assistants_org_primary_unique
  ON public.vapi_assistants (organization_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS vapi_assistants_org_idx
  ON public.vapi_assistants (organization_id);

ALTER TABLE public.vapi_assistants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can manage assistants" ON public.vapi_assistants;
CREATE POLICY "Org members can manage assistants"
  ON public.vapi_assistants FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.vapi_assistants TO authenticated;
GRANT ALL ON public.vapi_assistants TO service_role;

-- ============================================================
-- 11. Vapi Phone Numbers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vapi_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  vapi_phone_number_id text NOT NULL,
  e164_number text NOT NULL,
  is_primary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vapi_phone_numbers_org_primary_unique
  ON public.vapi_phone_numbers (organization_id) WHERE is_primary;
CREATE UNIQUE INDEX IF NOT EXISTS vapi_phone_numbers_e164_unique
  ON public.vapi_phone_numbers (e164_number);

ALTER TABLE public.vapi_phone_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can manage phone numbers" ON public.vapi_phone_numbers;
CREATE POLICY "Org members can manage phone numbers"
  ON public.vapi_phone_numbers FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.vapi_phone_numbers TO authenticated;

-- ============================================================
-- 12. Calls (Vapi Call Logs)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE CASCADE,
  vapi_call_id text UNIQUE,
  vapi_assistant_id text,
  caller_phone text,
  full_name text,
  email text,
  email_confirmed boolean DEFAULT false,
  requested_service text,
  preferred_date text,
  preferred_time text,
  message text,
  call_reason text,
  contact_complete boolean DEFAULT false,
  needs_human_review boolean DEFAULT false,
  missing_fields jsonb,
  transcript text,
  summary text,
  raw_payload jsonb,
  raw_structured_data jsonb,
  status text DEFAULT 'completed',
  direction text DEFAULT 'inbound',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calls_organization_id_idx ON public.calls (organization_id);
CREATE INDEX IF NOT EXISTS calls_vapi_call_id_idx ON public.calls (vapi_call_id);

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view calls" ON public.calls;
CREATE POLICY "Org members can view calls"
  ON public.calls FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
GRANT ALL ON public.calls TO service_role;
GRANT SELECT ON public.calls TO authenticated;

-- ============================================================
-- 13. Vapi Webhook Tables (idempotency + telemetry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vapi_webhook_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'vapi',
  provider_delivery_id text NOT NULL UNIQUE,
  provider_event_type text NOT NULL,
  provider_call_id text,
  provider_assistant_id text,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  auth_verified boolean NOT NULL DEFAULT false,
  auth_mode text NOT NULL DEFAULT 'optional',
  auth_method text,
  auth_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_payload jsonb NOT NULL,
  raw_payload_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 0,
  last_error jsonb,
  first_received_at timestamptz NOT NULL DEFAULT now(),
  last_received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vapi_webhook_receipts_status_retry_idx ON public.vapi_webhook_receipts (status, next_retry_at);
CREATE INDEX IF NOT EXISTS vapi_webhook_receipts_call_idx ON public.vapi_webhook_receipts (provider_call_id);

DROP TRIGGER IF EXISTS set_vapi_webhook_receipts_updated_at ON public.vapi_webhook_receipts;
CREATE TRIGGER set_vapi_webhook_receipts_updated_at
  BEFORE UPDATE ON public.vapi_webhook_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.vapi_webhook_receipts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.vapi_webhook_receipts TO service_role;

-- ============================================================
-- 14. Reload Schema Cache
-- ============================================================
NOTIFY pgrst, 'reload schema';
