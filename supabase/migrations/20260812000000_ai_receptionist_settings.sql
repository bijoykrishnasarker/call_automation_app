-- Migration: AI Receptionist Settings, Vapi Assistants & Phone Numbers
-- Extends existing migrations: 20260414052000_vapi_canonical_webhooks.sql & 20260419000000_vapi_telemetry.sql

-- 1. AI Receptionists Table
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

-- Add columns if ai_receptionists already exists
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
CREATE POLICY "Org members can read receptionist settings"
  ON public.ai_receptionists FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can upsert receptionist settings" ON public.ai_receptionists;
CREATE POLICY "Org members can upsert receptionist settings"
  ON public.ai_receptionists FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can update receptionist settings" ON public.ai_receptionists;
CREATE POLICY "Org members can update receptionist settings"
  ON public.ai_receptionists FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Vapi Assistants Table
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

CREATE UNIQUE INDEX IF NOT EXISTS vapi_assistants_org_primary_unique
  ON public.vapi_assistants (organization_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS vapi_assistants_org_idx
  ON public.vapi_assistants (organization_id);

ALTER TABLE public.vapi_assistants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read assistants" ON public.vapi_assistants;
CREATE POLICY "Org members can read assistants"
  ON public.vapi_assistants FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can manage assistants" ON public.vapi_assistants;
CREATE POLICY "Org members can manage assistants"
  ON public.vapi_assistants FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Vapi Phone Numbers Table
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

DROP POLICY IF EXISTS "Org members can read phone numbers" ON public.vapi_phone_numbers;
CREATE POLICY "Org members can read phone numbers"
  ON public.vapi_phone_numbers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org members can manage phone numbers" ON public.vapi_phone_numbers;
CREATE POLICY "Org members can manage phone numbers"
  ON public.vapi_phone_numbers FOR ALL
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload schema';
