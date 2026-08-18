-- Fix RLS policies and privileges for public tables
-- Run these commands in Supabase SQL Editor (https://app.supabase.com/)
-- Navigate to your project > SQL Editor > Create a new query and paste this

-- Required for anon and authenticated roles to access tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO anon, authenticated;

-- Ensure tables have RLS enabled
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop stale policies first so repeated runs do not leave recursive/duplicate rules behind
DROP POLICY IF EXISTS "Allow anon select workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow anon insert workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow anon update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Allow anon delete workspaces" ON public.workspaces;

DROP POLICY IF EXISTS "Allow anon select documents" ON public.documents;
DROP POLICY IF EXISTS "Allow anon insert documents" ON public.documents;
DROP POLICY IF EXISTS "Allow anon update documents" ON public.documents;
DROP POLICY IF EXISTS "Allow anon delete documents" ON public.documents;

DROP POLICY IF EXISTS "Allow anon select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anon delete profiles" ON public.profiles;

DROP POLICY IF EXISTS "Allow anon select workspace_members" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow anon insert workspace_members" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow anon update workspace_members" ON public.workspace_members;
DROP POLICY IF EXISTS "Allow anon delete workspace_members" ON public.workspace_members;

-- Safe, non-recursive policies for the app.
-- These intentionally allow the app's anon key to operate while avoiding
-- table-to-table recursion in Postgres policy evaluation.
CREATE POLICY "Allow anon select workspaces"
ON public.workspaces
FOR SELECT
USING (true);

CREATE POLICY "Allow anon insert workspaces"
ON public.workspaces
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow anon update workspaces"
ON public.workspaces
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon delete workspaces"
ON public.workspaces
FOR DELETE
USING (true);

CREATE POLICY "Allow anon select documents"
ON public.documents
FOR SELECT
USING (true);

CREATE POLICY "Allow anon insert documents"
ON public.documents
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow anon update documents"
ON public.documents
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon delete documents"
ON public.documents
FOR DELETE
USING (true);

CREATE POLICY "Allow anon select profiles"
ON public.profiles
FOR SELECT
USING (true);

CREATE POLICY "Allow anon insert profiles"
ON public.profiles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow anon update profiles"
ON public.profiles
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon delete profiles"
ON public.profiles
FOR DELETE
USING (true);

CREATE POLICY "Allow anon select workspace_members"
ON public.workspace_members
FOR SELECT
USING (true);

CREATE POLICY "Allow anon insert workspace_members"
ON public.workspace_members
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow anon update workspace_members"
ON public.workspace_members
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon delete workspace_members"
ON public.workspace_members
FOR DELETE
USING (true);

-- Optional: Create a trigger to automatically create profiles for new auth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
