# Fix: Cleaner application status won't update (400 error)

## Root cause
The `cleaner_applications` table still has an old validation rule that only allows these status values:

```
new, reviewed, contacted, archived
```

The admin dashboard was upgraded to a hiring pipeline that uses new stages:

```
new, reviewing, shortlisted, interview, hired, rejected
```

When you pick a new stage (e.g. "Reviewing", "Shortlisted", "Hired"), the database rejects it because the value isn't in the old allowed list. That rejection is the `400 ()` error you see, and the status silently fails to change.

The "expand card to see what the applicant filled in" feature already exists in the current code (click the chevron to expand full details, references, resume, etc.) — your preview is just showing the last saved version. Once the constraint is fixed and the app rebuilds, both the expand and the status updates will work.

## The change
One database migration that replaces the outdated status validation rule with one that accepts the full pipeline plus the legacy values (so older rows still validate).

### Technical details
- Drop `cleaner_applications_status_check` if it exists, then recreate it allowing:
  `new, reviewing, shortlisted, interview, hired, rejected, reviewed, contacted, archived`.
- Written idempotently (`DROP CONSTRAINT IF EXISTS` + guarded `ADD CONSTRAINT`) so it runs cleanly on both the current database and a brand-new database.

```sql
ALTER TABLE public.cleaner_applications
  DROP CONSTRAINT IF EXISTS cleaner_applications_status_check;

ALTER TABLE public.cleaner_applications
  ADD CONSTRAINT cleaner_applications_status_check
  CHECK (status IN (
    'new','reviewing','shortlisted','interview','hired','rejected',
    'reviewed','contacted','archived'
  ));
```

## What stays the same
- No UI changes needed — the expandable card, status dropdown, references, resume viewer, and email response panel are all already built.
- No changes to any other table, policy, or app functionality.

## Verification
After the migration runs, change an application's status from the dropdown and confirm the "Status updated" toast appears and the badge changes with no 400 error.
