-- ============================================================
-- RUN THIS IN YOUR SUPABASE SQL EDITOR at supabase.bizhq.cloud
-- ============================================================

-- 1. Create organizations table (if it doesn't exist or is missing columns)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add owner_user_id if the table exists but is missing the column
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS organizations_owner_user_id_idx
  ON public.organizations (owner_user_id);

-- 2. Create / fix profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add organization_id if profiles table exists but column is missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id) ON DELETE RESTRICT;

-- role: CREATE TABLE IF NOT EXISTS does not add columns to an existing profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'admin', 'member'));

CREATE INDEX IF NOT EXISTS profiles_organization_id_idx
  ON public.profiles (organization_id);

-- 3. Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they're correct
DROP POLICY IF EXISTS "Org members can view org" ON public.organizations;
DROP POLICY IF EXISTS "Owners can view their own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;

CREATE POLICY "Users can create organizations"
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Owners can view their own organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id OR id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 4. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 5. Grant permissions
GRANT ALL ON public.organizations TO authenticated;
GRANT ALL ON public.profiles TO authenticated;

-- 6. RELOAD SCHEMA CACHE (critical - run this last)
NOTIFY pgrst, 'reload schema';

-- 7. (Optional but recommended) Auto-reload on any future DDL changes
CREATE OR REPLACE FUNCTION public.pgrst_watch() RETURNS event_trigger
  LANGUAGE plpgsql AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

DROP EVENT TRIGGER IF EXISTS pgrst_watch;
CREATE EVENT TRIGGER pgrst_watch ON ddl_command_end
  EXECUTE FUNCTION public.pgrst_watch();
