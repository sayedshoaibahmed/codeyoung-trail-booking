# Edge Cases Document

**Project**: CodeYoung Trial Class Booking System
**Version**: 1.0
**Status**: Draft

This document enumerates every identified edge case, the expected system behaviour, and any open ambiguities. Each entry specifies the layer responsible for handling it and the corresponding error code from the TRD.

---

## EC-01: Same-Slot Contention

**Scenario**: Two parents submit a booking request for the same slot at approximately the same time, and only one mentor slot remains available.

**Expected behaviour**:
- Both requests enter the `BookTrialClass` use case concurrently.
- PostgreSQL row-level locks (`SELECT FOR UPDATE`) on the candidate mentor rows ensure only one transaction can assign the last available mentor.
- The first transaction to commit succeeds with `201 CONFIRMED`.
- The second transaction finds no eligible mentor after acquiring locks and returns `409 SLOT_UNAVAILABLE` with a list of alternate slots.

**Layer responsible**: `application/` (use case logic) + `infrastructure/` (Prisma transaction + DB locks).

**Ambiguity**: None identified.

---

## EC-02: Double-Click / Client Retry with Same Idempotency Key

**Scenario**: The parent double-clicks the "Book" button or the network retries, resulting in two identical HTTP requests with the same `Idempotency-Key` header and identical body.

**Expected behaviour**:
- The first request creates the booking and stores the idempotency key + response payload.
- The second request hits the idempotency check before any booking logic. The stored response is returned immediately with HTTP `200`.
- No duplicate booking is created.

**Layer responsible**: `application/` (`IdempotencyStore` port), `infrastructure/` (`PrismaIdempotencyStore`), enforced by `UNIQUE (idempotencyKey)` DB constraint.

**Ambiguity**: If the first request is still in-flight when the second arrives (concurrent, not sequential), the DB unique constraint on `idempotencyKey` will cause one insert to fail with a unique violation. The implementation must catch this and re-query for the stored result rather than propagating a 500.

---

## EC-03: Reused Idempotency Key with Changed Payload

**Scenario**: A client sends request A with `Idempotency-Key: key-123` and payload P1 (booking for slot X). Later, the same client sends a new request with the same `Idempotency-Key: key-123` but a different payload P2 (booking for slot Y).

**Expected behaviour**:
- The server detects that `key-123` already exists and that the payload hash of P2 differs from the stored hash of P1.
- Returns `409 IDEMPOTENCY_CONFLICT` immediately. No booking is created or modified.

**Layer responsible**: `application/` (idempotency check with payload hash comparison).

**Ambiguity**: The exact hashing algorithm for payload comparison is not specified. A SHA-256 of the canonical JSON body (keys sorted) is recommended.

---

## EC-04: Daily-Cap Race (Concurrent Requests That Would Push a Mentor Over 2)

**Scenario**: A mentor currently has 1 confirmed booking on a given day. Two parents simultaneously request different slots on that same day for a mentor who would be the least-loaded candidate for both.

**Expected behaviour**:
- Both requests enter the booking transaction.
- Row-level locks on the mentor's existing booking rows (via `SELECT FOR UPDATE`) prevent both from seeing a count of 1 simultaneously without serialisation.
- One transaction commits, incrementing the effective count to 2.
- The second transaction re-reads the count (within the same transaction after acquiring locks) and sees 2, making this mentor ineligible.
- If another mentor is available, the second request proceeds with the next eligible mentor.
- If no other mentor is eligible, the second request returns `409 SLOT_UNAVAILABLE`.

**Layer responsible**: `application/` + `infrastructure/` (transaction + locking).

**Ambiguity**: The locking approach (per-mentor row lock vs. advisory lock vs. serializable isolation) must be decided during implementation. Row-level `SELECT FOR UPDATE` on existing booking rows is the recommended approach per the TRD.

---

## EC-05: No Mentor Available

**Scenario**: The parent requests a slot where every shift-eligible mentor is either already booked for that slot, or has reached the daily cap of 2.

**Expected behaviour**:
- Returns `409 SLOT_UNAVAILABLE`.
- Response body includes a `"alternateSlots"` array containing the next 3 (default) available slots across both shifts.
- Alternate slots are computed by scanning forward from the requested time within the same day, then the next day, until 3 eligible slots are found.

**Layer responsible**: `application/` (`BookTrialClass` + `GetAvailableSlots`).

**Ambiguity**: How far forward to scan for alternates (max days) is not specified. Default to scanning up to 7 days forward. If no slots are found within 7 days, return an empty `alternateSlots` array.

---

## EC-06: Shift Boundary Requests

**Scenario A (exact boundary, Shift 1)**: Parent requests a slot starting at exactly 09:00 IST (Shift 1 open) or ending at exactly 21:00 IST.

**Scenario B (exact boundary, Shift 2)**: Parent requests a slot starting at exactly 21:00 IST (Shift 2 open) or ending at exactly 09:00 IST next day.

**Expected behaviour**:
- A slot is valid if `shiftStart <= slotStart` AND `slotEnd <= shiftEnd`.
- 09:00 IST start is valid for Shift 1. A class starting at 20:00 IST (ending 21:00 IST) is the last valid Shift 1 slot.
- 21:00 IST start is valid for Shift 2. A class starting at 08:00 IST next day (ending 09:00 IST) is the last valid Shift 2 slot.
- A slot starting at 20:30 IST (ending 21:30 IST) violates Shift 1 because the end time exceeds the shift boundary. **Ambiguity**: Whether a class that starts within the shift but ends after the shift boundary is valid or not. This document defines it as **invalid** — the full 1-hour window must fit within the shift.

**Layer responsible**: `domain/` (shift boundary validation rule).

---

## EC-07: Overnight Shift (Shift 2 Crossing Midnight in IST)

**Scenario**: A parent in a timezone that is UTC-5 requests a slot at 19:00 local (which maps to 00:30 IST next day — within Shift 2: 21:00–09:00 IST).

**Expected behaviour**:
- The system converts the parent-local time to UTC, then to IST for shift validation.
- 00:30 IST falls within Shift 2 (21:00 IST Day 0 to 09:00 IST Day 1).
- The slot is eligible for Shift 2 mentors.
- Daily cap is evaluated against the mentor's IST calendar date at the slot's IST start time.

**Layer responsible**: `infrastructure/` (Luxon conversion) + `domain/` (shift check).

**Ambiguity**: None beyond EC-06.

---

## EC-08: Midnight Crossing and Daily Cap

**Scenario**: A Shift 2 mentor has 1 confirmed booking at 22:00 IST on Day 1 (within Shift 2, Day 1). The next booking request is for 01:00 IST on Day 2 (still within Shift 2, but a different IST calendar date).

**Expected behaviour**:
- The daily cap is checked against the IST calendar date of each booking's `startTimeUtc` converted to IST.
- 22:00 IST Day 1 = IST date `Day 1`.
- 01:00 IST Day 2 = IST date `Day 2`.
- These are different IST dates, so each counts toward a separate daily cap. The mentor is eligible for the 01:00 IST Day 2 slot (their Day 2 count is 0).

**Layer responsible**: `application/` (daily cap query groups by `DATE(startTimeUtc AT TIME ZONE 'Asia/Kolkata')`).

---

## EC-09: DST Ambiguous Times

**Scenario**: A parent in `America/New_York` requests a slot at 01:30 local time on the date clocks fall back (November DST transition). 01:30 AM occurs twice that day.

**Expected behaviour**:
- Luxon detects the ambiguous local time when converting with `{ zone: 'America/New_York' }`.
- The server rejects the request with `422 AMBIGUOUS_TIME` and a human-readable message explaining that the time is ambiguous due to DST and asking the parent to specify in UTC or use a time that is unambiguous.
- The system does **not** silently pick `earlier` or `later`.

**Layer responsible**: `infrastructure/` (Luxon adapter), `interfaces/` (error mapping).

---

## EC-10: DST Nonexistent Times

**Scenario**: A parent in `America/New_York` requests a slot at 02:30 local time on the spring-forward date. 02:30 AM does not exist in that timezone that day.

**Expected behaviour**:
- Luxon throws or returns an invalid `DateTime` when attempting to interpret the nonexistent local time.
- The server returns `422 AMBIGUOUS_TIME` (same code; message should say "nonexistent time due to DST").

**Layer responsible**: `infrastructure/` (Luxon adapter).

---

## EC-11: Half-Hour and Non-Standard UTC Offsets

**Scenario**: A parent is in `Asia/Kolkata` (UTC+5:30), `Asia/Kathmandu` (UTC+5:45), or `Australia/Adelaide` (UTC+10:30).

**Expected behaviour**:
- Luxon handles all IANA timezone identifiers natively, including non-integer and non-half-hour offsets.
- Slot start times are stored in UTC with full precision (milliseconds if needed).
- The slot grid (1-hour aligned in UTC) may result in non-round local times for these parents. This is acceptable and must be rendered correctly in the frontend using Luxon.
- No rounding or truncation of UTC times is performed.

**Layer responsible**: `infrastructure/` (Luxon conversion), `shared/lib/timezone` (frontend display).

**Ambiguity**: If the slot grid is defined as 1-hour aligned in IST (not UTC), then slot start times in UTC will always be on the :30-minute mark for IST-aligned slots. The slot grid definition must be finalised.

---

## EC-12: Past Times

**Scenario**: A parent submits a booking request for a slot whose `requestedStartUtc` is before the current UTC time.

**Expected behaviour**:
- The `ClockPort` provides the current UTC instant.
- If `requestedStartUtc < now()`, the use case returns `422 PAST_SLOT` immediately, before any mentor queries.

**Layer responsible**: `application/` (`BookTrialClass` use case, first validation step).

---

## EC-13: Lead-Time Violation

**Scenario**: A parent requests a slot that is in the future but within the minimum lead time window (e.g. 30 minutes from now, if the minimum is 1 hour).

**Expected behaviour**:
- If `requestedStartUtc < now() + leadTime`, the use case returns `422 LEAD_TIME_VIOLATION`.

**Layer responsible**: `application/` (`BookTrialClass`).

**Ambiguity**: The minimum lead time is not specified in the PRD. The implementation will default to **1 hour** and this must be confirmed by the product team. The lead time should be a configurable constant, not a magic number.

---

## EC-14: Cancellation (Happy Path)

**Scenario**: Parent cancels a confirmed booking before the class start time using the correct token.

**Expected behaviour**:
- Booking status becomes `CANCELLED`.
- `cancelledAt` is set to `now()`.
- Mentor capacity for that slot is released (daily cap counter effectively decreases).
- Cancellation confirmation email is sent (logged).
- Returns `200` with the updated booking.

**Layer responsible**: `application/` (`CancelBooking`), `infrastructure/` (Prisma, ConsoleEmailAdapter).

---

## EC-15: Repeated Cancellation

**Scenario**: Parent sends a second `DELETE` request for a booking that is already `CANCELLED`.

**Expected behaviour**:
- The use case reads the booking (with row lock), observes `status = CANCELLED`.
- Returns `409 ALREADY_CANCELLED`.
- No state change occurs. No second email is sent.

**Note**: This is explicitly **not** treated as idempotent. The idempotency mechanism applies to booking *creation*, not to cancellation. The second cancellation is a semantic error.

**Layer responsible**: `application/` (`CancelBooking`).

---

## EC-16: After-Start Cancellation

**Scenario**: Parent attempts to cancel a booking after `startTimeUtc` has already passed.

**Expected behaviour**:
- `now() >= booking.startTimeUtc` → use case returns `422 AFTER_START_CANCELLATION`.
- The booking remains `CONFIRMED`. No state change.

**Layer responsible**: `application/` (`CancelBooking`), using `ClockPort` for the current time.

---

## EC-17: Email Failure

**Scenario**: The booking transaction commits successfully, but the `EmailPort.send()` call throws an error (e.g. the mock logger fails, or in a future real adapter, the SMTP connection times out).

**Expected behaviour**:
- The email call is made **outside** the database transaction.
- The error is caught, logged as a warning/error, and does **not** cause the booking API to return a failure.
- The client receives `201 CONFIRMED` (or `200` for idempotent replay).
- The confirmation email is simply not delivered (or not logged). This is an acceptable degradation in the current version.

**Ambiguity**: There is no retry mechanism for failed emails in v1. A dead-letter queue or retry table is out of scope.

**Layer responsible**: `application/` (wraps email call in try/catch after transaction commit), `infrastructure/` (email adapter).

---

## EC-18: Database Failure

**Scenario A — Transaction fails mid-way**: A PostgreSQL error occurs during the `INSERT` of the booking row within the transaction.

**Expected behaviour**:
- Prisma rolls back the transaction automatically.
- No partial booking record exists.
- The use case propagates the error to the `interfaces/` layer, which returns `500 INTERNAL_ERROR`.

**Scenario B — DB unreachable**: The API cannot connect to PostgreSQL at all.

**Expected behaviour**:
- All endpoints return `500 INTERNAL_ERROR`.
- The error is logged with full context (no sensitive data exposed in the response body).

**Scenario C — Idempotency key insert fails due to unique violation (concurrent duplicate)**: Covered in EC-02.

**Layer responsible**: `infrastructure/` (Prisma error handling), `interfaces/` (global error middleware).

**Ambiguity**: No circuit breaker or connection pool retry strategy is specified for v1. The Prisma default connection pool settings will be used.
