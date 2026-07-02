# Plan: Reschedule notification email

Today, confirming a booking emails the customer, but **rescheduling silently changes the date/time** with no notice. This adds a market-standard reschedule email so everyone stays on the same page when a confirmed booking moves.

## Behavior

- The Reschedule dialog gains two fields:
  - A **"Notify customer by email"** checkbox, **pre-checked** (admin can uncheck for silent corrections).
  - An **optional reason/message** text field (e.g. "Rescheduled at your request").
- On confirm, the booking is updated exactly as it is now. Then, if the checkbox is on and the customer has an email, a reschedule email is sent.
- The email clearly shows the change: **Was: `<old date, old time>` → Now: `<new date, new time>`**, plus the optional reason and service/address.
- The customer's status stays as-is (a reschedule is a change notice, not a re-confirmation).
- Activity log records whether a notice was sent (appended to the existing "rescheduled" log entry).

## Email content

Subject: `Your BlueRiver booking has been rescheduled`

Body:
- Friendly line: "Hi `<name>`, your cleaning appointment has been rescheduled."
- A change table:

```text
Was:  July 5, 2026 — 9:00 AM
Now:  July 8, 2026 — 2:00 PM
Service:  Deep Clean
Address:  123 Main St
```

- Optional reason paragraph (only if admin typed one).
- Reuses the existing red-style note that final timing may be coordinated, matching the booking form's disclaimer tone.
- Closes with "Reply to this email with any questions."

## Technical details

**`supabase/functions/send-transactional-email/index.ts`**
- Add a new payload type `booking_rescheduled`.
- Add `bookingRescheduledTemplate(d)` that renders the was/now rows via the existing `detailRow` helper (new keys: `oldDate`, `oldTimeSlot`, `newDate`, `newTimeSlot`, `reason`).
- Wire it into the type switch like the other booking templates.
- Requires redeploying the `send-transactional-email` function.

**`src/pages/admin/BookingsAdmin.tsx`**
- Add state: `rescheduleNotify` (default `true`) and `rescheduleReason` (default `""`).
- Reset both in `openReschedule`.
- In `handleRescheduleConfirm`, after a successful update: capture the old date/time from `rescheduleTarget` before it's cleared, and if `rescheduleNotify && rescheduleTarget.email`, fire `supabase.functions.invoke("send-transactional-email", { type: "booking_rescheduled", to, data })` fire-and-forget (same pattern as the confirmation email).
- Include the "notice sent" flag in the `logBookingActivity("rescheduled", ...)` details string.
- Add the checkbox + optional reason `Textarea` to the reschedule Dialog, above the footer.
- Toast message reflects whether an email was sent ("Booking rescheduled. Customer notified." vs "Booking rescheduled.").

## Out of scope
- No database/schema changes.
- No changes to the public booking form or the confirm/cancel flows.
- Time-slot conflict logic and the no-backdating guard stay exactly as they are.

## Verification
- Reschedule a confirmed booking with the box checked → customer receives an email showing old → now and the reason; activity log notes the notice.
- Reschedule with the box unchecked → date/time updates, no email sent.
- Reschedule a booking with no email on file → updates cleanly, no send attempted.
