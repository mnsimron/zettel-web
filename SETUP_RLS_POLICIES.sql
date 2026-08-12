-- Fix RLS policies and privileges for public tables
-- Run these commands in Supabase SQL Editor (https://app.supabase.com/)
-- Navigate to your project > SQL Editor > Create a new query and paste this

-- Required for anon and authenticated roles to access tables
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO anon, authenticated;

-- Enable RLS on workspaces table (if not already enabled)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Allow anon users to SELECT workspaces
CREATE POLICY "Allow anon select workspaces"
ON public.workspaces
FOR SELECT
USING (true);

-- Allow anon users to INSERT workspaces
CREATE POLICY "Allow anon insert workspaces"
ON public.workspaces
FOR INSERT
WITH CHECK (true);

-- Allow anon users to UPDATE workspaces
CREATE POLICY "Allow anon update workspaces"
ON public.workspaces
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Allow anon users to DELETE workspaces
CREATE POLICY "Allow anon delete workspaces"
ON public.workspaces
FOR DELETE
USING (true);

-- Also apply the same policies to documents table for consistency
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

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

-- Optional: Apply same policies to profiles and workspace_members tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

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
-- This ensures profiles always exist when workspace_members references them
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger as $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the new trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
