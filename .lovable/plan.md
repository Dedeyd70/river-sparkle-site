# Plan: Booking times = single specific times, no buffer, no ranges + red disclaimer

The client kept **date + time selection** on the booking form, but wants three changes to how times work, plus one new task carried over.

---

## Part 1 — Booking form time slots (public `src/pages/BookService.tsx`)

### 1a. Single specific times instead of ranges
Today the slot generator produces ranges like `"9:00 AM - 10:00 AM"`. Change it to emit a single clock time per slot: `"7:00 AM"`, `"8:00 AM"`, `"9:00 AM"`, … stepping by the configured slot duration across the working-hours window.

```text
Before:  [ 9:00 AM - 10:00 AM ] [ 10:00 AM - 11:00 AM ]
After:   [ 9:00 AM ]  [ 10:00 AM ]  [ 11:00 AM ]
```

- `generateTimeSlots` pushes `fmt(h, mm)` only (drop the `- endTime` part).
- The chosen value stored in `bookings.time_slot` becomes e.g. `"9:00 AM"`.

### 1b. Remove the buffer concept entirely
- Delete the buffer logic from the slot grid: no more `isSlotBlocked` / `configFromSettings`, no `"(Buffer)"` label, and remove the helper line *"Slots adjacent to existing bookings are reserved as travel/setup buffer."*
- A time is disabled **only** if that exact time is already booked for that date (shown as `"(Booked)"`, greyed out).
- In `handleSubmit`, keep the exact-match "just booked" guard but drop the `check_slot_overlap` RPC call (overlap/buffer is no longer a concept).
- Remove the now-unused `availability.ts` import from this file. (The `availability.ts` helper file itself stays in the repo; nothing else needs it changed.)

### 1c. Red disclaimer note on the form
Add a clearly **red** note (using the destructive text token, not a hardcoded color) near the time selection so customers understand the time is provisional:

> **Please note:** Selecting a time is required to complete your booking, but it is for scheduling purposes only. Your chosen time is **not guaranteed** — our team will contact you to confirm the final appointment time, which may change.

Rendered with `text-destructive` styling so it reads red in the design system.

### What stays the same
- Date calendar, working days, blocked dates, and all pricing logic are untouched.
- `time_slot` stays **required** — the customer still must pick a time to submit.
- No database migration: `bookings.time_slot` already stores free text, the unique `(booking_date, time_slot)` guard still prevents exact double-booking, and `get_booked_slots` still works.

---

## Part 2 — Admin email alert for cleaner applications (carried over)

Separate confirmed item still pending: the "Become a Cleaner" form creates an in-app notification and an applicant acknowledgement, but sends **no admin email**. In `src/pages/BecomeACleaner.tsx`, after a successful insert, also fire the shared admin-alert email (same `admin_new_submission` type the booking/quote/contact forms use), fire-and-forget:

```ts
supabase.functions.invoke("send-transactional-email", {
  body: {
    type: "admin_new_submission",
    to: "info@blueriverservices.co",
    data: {
      kind: "Cleaner Application",
      name: fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      dashboardUrl: `${window.location.origin}${ADMIN_BASE}/cleaner-applications`,
    },
  },
}).catch((err) => console.error("[admin-email] application failed:", err));
```

No backend/template changes — the admin-alert template already exists.

---

## Consistency note (admin bookings)
If the admin reschedule/edit screen (`BookingsAdmin.tsx`) generates its own time slots as ranges, its generator will be switched to the same single-time format so admin-edited times match customer-selected ones. If it uses a free-text field, no change is needed. (Confirmed during implementation.)

---

## Verification
- Booking form shows single times (`9:00 AM`, `10:00 AM`) — no ranges, no `(Buffer)` labels.
- An already-booked exact time shows `(Booked)` and is unselectable; every other time is selectable regardless of neighbors.
- The red disclaimer is visible near the time picker.
- Submitting still stores the time and sends the confirmation email.
- Submitting a cleaner application delivers a "New Cleaner Application" email to the admin inbox.