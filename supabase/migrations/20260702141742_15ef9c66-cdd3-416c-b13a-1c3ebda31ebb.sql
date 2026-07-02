ALTER TABLE public.cleaner_applications
  DROP CONSTRAINT IF EXISTS cleaner_applications_status_check;

ALTER TABLE public.cleaner_applications
  ADD CONSTRAINT cleaner_applications_status_check
  CHECK (status IN (
    'new','reviewing','shortlisted','interview','hired','rejected',
    'reviewed','contacted','archived'
  ));