-- Migration: Add missing telemetry to calls and contacts table

-- Table: contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS email_confirmed boolean NOT NULL DEFAULT false;

-- Table: calls (might already exist, so we use IF NOT EXISTS for columns)
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  vapi_call_id text UNIQUE,
  vapi_assistant_id text,
  direction text,
  from_number text,
  to_number text,
  status text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS caller_phone text,
ADD COLUMN IF NOT EXISTS full_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS email_confirmed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS requested_service text,
ADD COLUMN IF NOT EXISTS preferred_date text,
ADD COLUMN IF NOT EXISTS preferred_time text,
ADD COLUMN IF NOT EXISTS message text,
ADD COLUMN IF NOT EXISTS call_reason text,
ADD COLUMN IF NOT EXISTS contact_complete boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_human_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS missing_fields jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS transcript text,
ADD COLUMN IF NOT EXISTS summary text,
ADD COLUMN IF NOT EXISTS raw_payload jsonb,
ADD COLUMN IF NOT EXISTS raw_structured_data jsonb;

CREATE INDEX IF NOT EXISTS calls_vapi_call_id_idx ON public.calls (vapi_call_id);
CREATE INDEX IF NOT EXISTS calls_organization_id_idx ON public.calls (organization_id);
CREATE INDEX IF NOT EXISTS calls_created_at_idx ON public.calls (created_at);

-- RLS
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_select_for_org_members ON public.calls;
CREATE POLICY calls_select_for_org_members
  ON public.calls
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.organization_id = public.calls.organization_id
    )
  );

DROP POLICY IF EXISTS calls_modify_for_org_members ON public.calls;
CREATE POLICY calls_modify_for_org_members
  ON public.calls
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.organization_id = public.calls.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE public.profiles.id = auth.uid()
        AND public.profiles.organization_id = public.calls.organization_id
    )
  );

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
