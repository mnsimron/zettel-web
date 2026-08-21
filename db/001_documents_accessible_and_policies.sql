-- View to return documents with collaborator IDs aggregated
-- Run this in your Supabase SQL editor

-- Create view that aggregates collaborators for each document
CREATE OR REPLACE VIEW public.documents_accessible AS
SELECT
  d.*,
  COALESCE(array_agg(dc.user_id) FILTER (WHERE dc.user_id IS NOT NULL), ARRAY[]::uuid[]) AS collaborator_ids
FROM public.documents d
LEFT JOIN public.document_collaborators dc ON dc.document_id = d.id
GROUP BY d.id;

-- Enable RLS on documents (if not already enabled)
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;

-- Policy: allow SELECT for the owner OR any collaborator
DROP POLICY IF EXISTS select_owned_or_collaborator ON public.documents;
CREATE POLICY select_owned_or_collaborator ON public.documents
  FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.document_collaborators dc
      WHERE dc.document_id = public.documents.id
        AND dc.user_id = auth.uid()
    )
  );

-- Note:
-- - The view `documents_accessible` provides a single-row-per-document result
--   with a `collaborator_ids` uuid[] column. Query it from the client to
--   fetch documents visible to the current user in one request.
-- - RLS is enforced on the base table `documents`. The policy above allows
--   users to SELECT documents they own or where they are listed as a
--   collaborator in `document_collaborators`.
-- - If you prefer an RPC instead, create a SECURITY DEFINER function that
--   returns the same rows using `auth.uid()`; I can add that if you want.
