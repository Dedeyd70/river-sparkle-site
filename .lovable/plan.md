# Plan: Remove buffer from admin Reschedule

The public booking form was already cleaned up (single times, no buffer). The **admin Reschedule Booking modal** in `src/pages/admin/BookingsAdmin.tsx` still uses the old buffer concept. This makes reschedule times get disabled as "— Buffer" and can block valid reschedules. We'll bring it in line with the public form: a time is unavailable **only** if that exact time is already booked.

## Changes (all in `src/pages/admin/BookingsAdmin.tsx`)

### 1. Drop the buffer import
Remove `import { configFromSettings, isSlotBlocked } from "@/lib/availability";`. (`availability.ts` stays in the repo; nothing else uses it there.)

### 2. Reschedule confirm handler (`handleRescheduleConfirm`)
- Keep the exact-match guard: if the chosen time is already booked (and it's not the booking's own current slot), block it.
- Remove the `check_slot_overlap` RPC call and its "overlaps an existing booking" toast — overlap/buffer is no longer a concept.

### 3. Reschedule time-slot dropdown (JSX)
- Remove `configFromSettings(siteSettings)` and the `isSlotBlocked(...)` call.
- A slot is `disabled` only when `isBooked` is true.
- Label becomes just the time plus `" — Booked"` when booked; drop the `" — Buffer"` case.
- Replace the helper line that mentions the buffer:

  > 30-minute intervals from 8:00 AM to 6:00 PM. A time is unavailable only if it is already booked for the selected date.

### What stays the same
- `RESCHEDULE_TIME_SLOTS` (already single times, 30-min intervals) — unchanged.
- Date guard / no-backdating rule — unchanged.
- `get_booked_slots` exact-match check — unchanged.
- No database migration.

## Verification
- Open a booking → Reschedule: no "— Buffer" labels appear; only already-booked exact times show "— Booked" and are disabled.
- Rescheduling to a time adjacent to another booking succeeds.
- The helper text no longer mentions a buffer.
