-- ============================================================
-- Cleaner recruitment workflow: schema + storage policies
-- Idempotent so it runs cleanly on a fresh database.
-- ============================================================

-- 1. Extend cleaner_applications
ALTER TABLE public.cleaner_applications
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS resume_url  text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- 2. Response / audit table for admin decisions + emails
CREATE TABLE IF NOT EXISTS public.cleaner_application_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES public.cleaner_applications(id) ON DELETE CASCADE,
  decision        text,
  subject         text,
  body            text,
  recipient_email text,
  sent_by         uuid,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_app_responses_application
  ON public.cleaner_application_responses(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaner_application_responses TO authenticated;
GRANT ALL ON public.cleaner_application_responses TO service_role;

ALTER TABLE public.cleaner_application_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can view application responses"
  ON public.cleaner_application_responses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'can_manage_applications')
  );

DROP POLICY IF EXISTS "Staff can add application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can add application responses"
  ON public.cleaner_application_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'can_manage_applications')
  );

DROP POLICY IF EXISTS "Staff can update application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can update application responses"
  ON public.cleaner_application_responses FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'can_manage_applications')
  );

DROP POLICY IF EXISTS "Staff can delete application responses" ON public.cleaner_application_responses;
CREATE POLICY "Staff can delete application responses"
  ON public.cleaner_application_responses FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_permission(auth.uid(), 'can_manage_applications')
  );

-- 3. Ensure the permission key exists (idempotent) for new databases
INSERT INTO public.permission_registry (key, label, description)
VALUES (
  'can_manage_applications',
  'Manage Cleaner Applications',
  'View, update, and triage cleaner job applications submitted via the public Become a Cleaner form.'
)
ON CONFLICT (key) DO NOTHING;

-- 4. Storage policies for the private cleaner-resumes bucket
-- Applicants (anonymous) may upload; only staff/admins may read via signed URLs.
DROP POLICY IF EXISTS "Anyone can upload a cleaner resume" ON storage.objects;
CREATE POLICY "Anyone can upload a cleaner resume"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'cleaner-resumes');

DROP POLICY IF EXISTS "Staff can read cleaner resumes" ON storage.objects;
CREATE POLICY "Staff can read cleaner resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cleaner-resumes'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_permission(auth.uid(), 'can_manage_applications')
    )
  );

DROP POLICY IF EXISTS "Staff can delete cleaner resumes" ON storage.objects;
CREATE POLICY "Staff can delete cleaner resumes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cleaner-resumes'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_permission(auth.uid(), 'can_manage_applications')
    )
  );