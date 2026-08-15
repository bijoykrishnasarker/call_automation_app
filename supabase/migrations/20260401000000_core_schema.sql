-- Core schema: organizations, profiles, contacts, bookings (calendar events),
-- pipelines, deals, deal_templates.
-- Run before 20260414052000_vapi_canonical_webhooks.sql and later migrations.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Organizations & profiles ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx
  ON public.organizations (owner_user_id);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';

CREATE INDEX IF NOT EXISTS profiles_organization_id_idx
  ON public.profiles (organization_id);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
CREATE POLICY "Users can create organizations"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Owners can view their own organizations" ON public.organizations;
CREATE POLICY "Owners can view their own organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_user_id
    OR id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- ── Contacts ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  company text,
  status text NOT NULL DEFAULT 'New Lead',
  tags text[] DEFAULT '{}',
  source text DEFAULT 'Manual Entry',
  last_activity text DEFAULT 'Just now',
  address text,
  city text,
  state text,
  zip text,
  notes jsonb DEFAULT '[]'::jsonb,
  tasks jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts (user_id);
CREATE INDEX IF NOT EXISTS contacts_organization_id_idx ON public.contacts (organization_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own contacts" ON public.contacts;
CREATE POLICY "Users can read own contacts"
  ON public.contacts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own contacts" ON public.contacts;
CREATE POLICY "Users can insert own contacts"
  ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contacts" ON public.contacts;
CREATE POLICY "Users can update own contacts"
  ON public.contacts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contacts" ON public.contacts;
CREATE POLICY "Users can delete own contacts"
  ON public.contacts FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_contacts_updated_at ON public.contacts;
CREATE TRIGGER set_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ── Bookings (calendar events) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE RESTRICT,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  type text NOT NULL DEFAULT 'Service' CHECK (type IN ('Service', 'Consultation', 'Checkup')),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON public.bookings (user_id);
CREATE INDEX IF NOT EXISTS bookings_contact_id_idx ON public.bookings (contact_id);
CREATE INDEX IF NOT EXISTS bookings_start_at_idx ON public.bookings (start_at);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own bookings" ON public.bookings;
CREATE POLICY "Users can read own bookings"
  ON public.bookings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bookings" ON public.bookings;
CREATE POLICY "Users can insert own bookings"
  ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bookings" ON public.bookings;
CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookings" ON public.bookings;
CREATE POLICY "Users can delete own bookings"
  ON public.bookings FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ── Pipelines & deals ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipelines_user_id_idx ON public.pipelines (user_id);

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id uuid NOT NULL REFERENCES public.pipelines (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'bg-blue-500',
  position int NOT NULL DEFAULT 0,
  has_automation boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_stages_pipeline_id_idx ON public.pipeline_stages (pipeline_id);

CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL REFERENCES public.pipeline_stages (id) ON DELETE RESTRICT,
  title text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  source text DEFAULT 'Direct Lead',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deals_user_id_idx ON public.deals (user_id);
CREATE INDEX IF NOT EXISTS deals_stage_id_idx ON public.deals (stage_id);
CREATE INDEX IF NOT EXISTS deals_contact_id_idx ON public.deals (contact_id);

CREATE TABLE IF NOT EXISTS public.deal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_templates_user_id_idx ON public.deal_templates (user_id);

ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pipelines" ON public.pipelines;
CREATE POLICY "Users can read own pipelines"
  ON public.pipelines FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own pipelines" ON public.pipelines;
CREATE POLICY "Users can insert own pipelines"
  ON public.pipelines FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own pipelines" ON public.pipelines;
CREATE POLICY "Users can update own pipelines"
  ON public.pipelines FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own pipelines" ON public.pipelines;
CREATE POLICY "Users can delete own pipelines"
  ON public.pipelines FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read stages of own pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can read stages of own pipelines"
  ON public.pipeline_stages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_stages.pipeline_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert stages in own pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can insert stages in own pipelines"
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_stages.pipeline_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update stages in own pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can update stages in own pipelines"
  ON public.pipeline_stages FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_stages.pipeline_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete stages in own pipelines" ON public.pipeline_stages;
CREATE POLICY "Users can delete stages in own pipelines"
  ON public.pipeline_stages FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.pipelines p WHERE p.id = pipeline_stages.pipeline_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can read own deals" ON public.deals;
CREATE POLICY "Users can read own deals"
  ON public.deals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own deals" ON public.deals;
CREATE POLICY "Users can insert own deals"
  ON public.deals FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own deals" ON public.deals;
CREATE POLICY "Users can update own deals"
  ON public.deals FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own deals" ON public.deals;
CREATE POLICY "Users can delete own deals"
  ON public.deals FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own deal_templates" ON public.deal_templates;
CREATE POLICY "Users can manage own deal_templates"
  ON public.deal_templates FOR ALL USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
