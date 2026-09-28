# Edge cases

**Project:** CodeYoung Trial Class Booking System
**Status:** Expected behavior of the **current** implementation

Use cases are named as in code (`BookClass`, `GetAvailability`, `CancelClass`, …).
HTTP codes match `errorHandler` and the booking/admin routers.

There is **no** HOLD, MentorHold, or 2-minute reservation behavior.

---

## EC-01: Same-slot concurrent booking

Two parents book the same hour; remaining CONFIRMED capacity is one mentor (or both pick the same least-loaded mentor).

**Expected:** SERIALIZABLE transaction + partial unique on CONFIRMED `(mentorId, startTimeUtc)` (`bookings_mentor_slot_confirmed_unique`). If the least-loaded mentor hits that unique index, the same transaction rolls back to savepoint `booking_mentor_insert` and tries the next eligible mentor. `409 SLOT_NOT_AVAILABLE` when no eligible mentor remains (including after a `P2034` retry is exhausted). Alternates: up to 3 eligible hours in the next **12** hours. Emails only for the winner.

`findEligibleMentors` does not lock mentor rows with `FOR UPDATE`.

Automated P2034 tests mock a throwing UnitOfWork; they do not open two real Postgres sessions.

---

## EC-02: Idempotency replay (same key, same payload)

Duplicate `POST /api/bookings` with the same `Idempotency-Key` and body.

**Expected:** Original CONFIRMED result returned; no second booking. Route status is **201**. If the first insert races, `P2002` on the key is resolved by re-reading the stored record when the hash matches.

---

## EC-03: Same idempotency key, different payload

**Expected:** `400 IDEMPOTENCY_CONFLICT`. No new booking. Payload hash is SHA-256 of JSON with sorted keys (`parentName`, `parentEmail`, `childName`, `parentTimezone`, `requestedStartIso`).

---

## EC-04: Concurrent last daily-cap slot

Two CONFIRMED inserts would push the same mentor to a third class on one `mentorLocalDate`.

**Expected:** SSI and eligibility counts serialize the race. A `P2034` serialization failure retries the whole transaction up to 3 times, which re-reads eligible mentors. One succeeds; the other gets `SLOT_NOT_AVAILABLE` only if no mentor is still under the cap. A confirmed-slot unique conflict (same start time) is not this case: that path tries the next eligible mentor inside the transaction.

---

## EC-05: No eligible mentor

**Expected:** `409 SLOT_NOT_AVAILABLE`, `alternateSlots` possibly empty if none of the next 12 hourly candidates work.

Availability UI: that hour is `full` if lead time is met.

---

## EC-06: Shift start / end and full-hour fit

- Shift 1: 09:00 ≤ start < 21:00 IST and end ≤ 21:00 IST (20:00–21:00 last hour).
- Shift 2: overnight 21:00–09:00 IST; last hour 08:00–09:00 IST.
- 20:30–21:30 IST → `400 SLOT_OUTSIDE_SHIFT` (does not enter eligibility).

---

## EC-07: Overnight Shift 2

Parent-local time converts to UTC then IST. Hours after IST midnight belong to Shift 2. `mentorLocalDate` is the IST calendar date of the start (post-midnight IST is the next IST date).

---

## EC-08: Midnight crossing and daily cap

22:00 IST Day 1 and 01:00 IST Day 2 are **different** `mentorLocalDate` values. Each has its own cap of 2 CONFIRMED.

---

## EC-09: US / UK DST — ambiguous local time

Fall-back overlap (e.g. America/New_York 01:30 on the fallback date).

**Expected:** `400 DST_AMBIGUOUS_TIME`. No silent earlier/later pick.

---

## EC-10: US / UK DST — nonexistent local time

Spring-forward gap.

**Expected:** `400 DST_NONEXISTENT_TIME`.

---

## EC-11: India (IST) and non-whole-hour offsets

`Asia/Kolkata` has no DST. `Asia/Kathmandu` and similar IANA zones are accepted if Luxon validates them. Grid is IST-aligned; parent `startLocal` may show `:30`. Frontend display uses `Intl` / label helpers, not a second booking engine.

---

## EC-12: Lead time and past slots

Minimum lead is **2 hours** (`meetsLeadTime`: `slotStart >= now + 120 minutes`). Too soon → `400 LEAD_TIME_VIOLATION` on book; availability marks those hours `blocked`. There is no separate `PAST_SLOT` code.

**Example (not a bug):** at **10:47 IST**, 11:00 and 12:00 are blocked by lead time; **13:00** is the first hourly start that can be considered for eligibility.

Landing copy: “Bookings must be made at least 2 hours in advance.”

---

## EC-13: Daily cap of 2 CONFIRMED

Third CONFIRMED on the same mentor-local day: mentor ineligible. Availability `full` when every on-shift mentor is at cap or overlapping.

---

## EC-14: CANCELLED does not count toward cap

A cancelled class on that date does not increment `dayCount`. Mentor can take another CONFIRMED.

---

## EC-15: CANCELLED releases the slot

Partial unique index ignores CANCELLED. Another parent can book the same mentor+start.

---

## EC-16: Cancel before start

Valid token, `now < startTimeUtc` → CONFIRMED → CANCELLED, email once.

---

## EC-17: Repeated cancellation

Valid token, already CANCELLED → `200` with `alreadyCancelled: true`. No second email. This **is** treated as a successful idempotent cancel (not `409 BOOKING_ALREADY_CANCELLED` on this path).

---

## EC-18: Cancel at or after start

`now >= startTimeUtc` → `409 CANCELLATION_AFTER_START`. Status unchanged. UI copy: “Cancellation is no longer available because the class has started.” Backend enforces this even if the UI still submitted.

---

## EC-19: Secure cancellation credential

Raw token only on create response + parent email (HTML boxed token; plain text on its own line). Compared with bcrypt. Wrong token → `401 CANCELLATION_TOKEN_INVALID`. GET-by-id never returns the token or the booking.

Pasted tokens: wrapping whitespace/newlines are stripped in the cancel UI **before** submit. Entropy/validation rules are unchanged.

---

## EC-20: Cancellation-token leakage prevention

Access DTO and GET-by-id omit hashes and raw tokens. Mentor email builder omits cancel/access material. The access page keeps the cancel token in router state only, not localStorage. `/confirmation/:id` does not fetch the booking. Classroom path does not embed the cancel token.

---

## EC-21: Email failure after commit

Parent and/or mentor send reject → booking API still succeeds (`201`). Logs only. Confirm and mentor sends are independent (`void` + `.catch`). Missing Resend env: skip send, log, booking remains.

---

## EC-22: Database failure

Mid-transaction errors roll back (no CONFIRMED row). Unhandled DB errors → `500 INTERNAL_ERROR` with a generic client message.

---

## EC-23: API validation

Missing `Idempotency-Key` → `400 MISSING_IDEMPOTENCY_KEY`. Bad body/params → `400 VALIDATION_ERROR`. Missing availability query `date`/`timezone` → `400 INVALID_DATE_FORMAT` / `INVALID_TIMEZONE`.

---

## EC-24: Unavailable slot on the booking form

`409 SLOT_NOT_AVAILABLE` → UI message “This time is no longer available…”, clear selection, refetch availability. Next Available Date runs when the **loaded** day has no selectable slot.

---

## EC-25: Next Available Date

Search starts the day **after** `date`, up to **30** parent-local days, using the same eligibility as `GetAvailability`. `nextAvailableDate` may be `null`.

---

## EC-26: Stale / aborted availability requests

`useAvailability` aborts the previous fetch on date/timezone change. Abort and stale request ids do not overwrite slots or show abort as a user-facing fetch failure.

---

## EC-27: Parent timezone conversion

`requestedStartIso` is wall time in `parentTimezone`. Luxon converts to UTC. Display uses parent zone for the grid and parent clock; mentor zone for mentor clock / `mentorLocalDate`. Changing the selected date clears the selected slot.

---

## EC-28: Class lifecycle UI

- Upcoming: Join + cancel (CONFIRMED).
- Live (`start <= now < end`): Join; cancel hidden.
- Completed (`now >= end`): “Class Completed” / “This class has already ended.” No Join. Details still load with a valid access token.

Email Join Class with `?access=` that does not match `:id` → invalid-link copy.

---

## EC-29: Admin authentication

Wrong password → `401 ADMIN_INVALID_CREDENTIALS`. No cookie → dashboard/session `401 ADMIN_UNAUTHORIZED`. Too many logins → `429 ADMIN_LOGIN_RATE_LIMITED`. Frontend `/admin` redirects to `/admin/login`. Logout clears cookie and live token. Render restart drops the in-memory session registry.

Admin password is not in the SPA source. Evaluator demo credentials live in the root README only as a shared demo account.
