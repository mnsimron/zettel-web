-- Allow users to SELECT their own collaborator rows so RLS EXISTS checks succeed
ALTER TABLE IF EXISTS public.document_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_by_user ON public.document_collaborators;
CREATE POLICY select_by_user ON public.document_collaborators
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Note:
-- This policy permits a logged-in user to SELECT rows from document_collaborators
-- where they are the collaborator (`user_id = auth.uid()`). This is necessary so
-- the `documents` table RLS policy that uses an EXISTS(...) over
-- document_collaborators can correctly check collaborator membership.
-- Run this in the Supabase SQL editor or include it in your migration pipeline.
