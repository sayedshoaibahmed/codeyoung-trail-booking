# Product Requirements Document (PRD)

**Project**: CodeYoung Trial Class Booking System
**Version**: 1.0
**Status**: Draft

---

## 1. Overview

CodeYoung offers a **free 1-hour trial class** to prospective students. This system allows a parent to self-serve book a single trial session with an available mentor. The system handles mentor shift scheduling, timezone-aware availability, conflict prevention, booking confirmations, and cancellations.

---

## 2. Actors

| Actor  | Description                                                                         |
|--------|-------------------------------------------------------------------------------------|
| Parent | Registers, selects a slot, and books a trial class for their child.                 |
| Mentor | A CodeYoung instructor assigned to a time slot via the shift system.                |
| Admin  | Internal stakeholder who views the read-only dashboard of all bookings and mentors. |

---

## 3. Mentor Roster and Shifts

### 3.1 Roster

There are exactly **10 mentors** in total.

### 3.2 Shifts (IST, UTC+5:30)

| Shift   | IST Window        | Mentors Assigned |
|---------|-------------------|------------------|
| Shift 1 | 09:00 – 21:00 IST | 5                |
| Shift 2 | 21:00 – 09:00 IST | 5                |

- Shift 2 is an **overnight shift** that crosses midnight in IST (and may cross the date boundary in other timezones or in UTC).
- A mentor is exclusively assigned to one shift. Shifts do not rotate (assignment is static in this version).
- **Ambiguity**: The PRD does not specify whether a mentor's shift determines which hours they are _available to be booked_, or only which hours they are _on duty_. For this system, a mentor is **only bookable within their designated shift window**. A trial class starting at 20:30 IST (Shift 1) is valid; one starting at 20:30 IST for a Shift 2 mentor is not.

---

## 4. Booking Journey

### 4.1 Step-by-Step Flow

1. **Parent provides contact details**: name, email address, child's name, and preferred timezone (IANA format, e.g. `America/New_York`).
2. **Parent selects a date and time slot**: the UI displays available 1-hour slots in the parent's local timezone.
3. **System validates the requested slot**: checks shift eligibility, the daily cap, no double-booking, and lead time (see Section 7).
4. **System assigns a mentor**: the least-loaded available mentor for that slot is selected automatically. The parent does not choose the mentor.
5. **System creates a confirmed booking**: a dummy meeting link is generated and stored.
6. **System sends a confirmation email** (mock/log-only in this version) to the parent containing the meeting link, mentor name, slot time in the parent's timezone, and booking reference.
7. **Parent can cancel** the booking before the class starts using a secure cancellation credential (see Section 6).

### 4.2 Slot Duration

Every trial class is exactly **1 hour** long.

### 4.3 Slot Granularity

**Ambiguity**: The PRD does not define the slot grid (e.g. every hour on the hour, every 30 minutes). Implementation should default to **1-hour aligned slots** (e.g. 09:00, 10:00 ...) unless a future requirement specifies otherwise.

---

## 5. Mentor Assignment: Least-Loaded Strategy

When a slot is requested:

1. Filter mentors whose shift covers the requested slot window.
2. From that filtered set, exclude mentors who are already booked in that slot (double-booking prevention).
3. From the remaining set, exclude mentors who have already reached the **daily cap of 2 confirmed classes** for that calendar day in their local timezone (see Section 7.2).
4. From the remaining eligible set, select the mentor with the **fewest confirmed bookings on that day** (mentor-local day). Ties are broken by mentor ID ascending (deterministic).
5. If no eligible mentor is found, return the next available alternate slots (see Section 5.1).

### 5.1 Alternate Slots

If no mentor is available for the requested slot, the API returns a list of the next N available slots (across both shifts) so the frontend can offer alternatives. **Ambiguity**: The number of alternates N is not specified in the product brief; implementation should default to **3 alternate slots**.

---

## 6. Cancellation

### 6.1 Rules

- A parent may cancel **only before the scheduled class start time** (UTC-based comparison).
- Cancellation is authenticated via a **secure cancellation credential** (a token or reference code) issued at booking time. No login is required for cancellation.
- On successful cancellation:
  - The booking status is set to `CANCELLED`.
  - The mentor's capacity for that slot and day is **released** (the daily cap counter decreases and the slot becomes available again).
- **Repeated cancellation**: Attempting to cancel an already-cancelled booking returns an error (idempotency is NOT applied here — the second request is a semantic error, not a duplicate of the first).
- **After-start cancellation**: Attempting to cancel after the class start time returns an error. The booking remains `CONFIRMED`.

### 6.2 Secure Cancellation Credential

- Issued as a cryptographically random token (UUID v4 or equivalent) at booking creation time.
- Stored alongside the booking record.
- **Ambiguity**: Whether the token should be stored hashed or in plaintext is not specified. This will need a decision before implementation.
- Included in the confirmation email sent to the parent.
- Compared on cancellation request; mismatch returns 403 Forbidden.

---

## 7. Business Rules

### 7.1 No Double-Booking

A mentor cannot have two confirmed bookings that overlap in time. The system must enforce this at the database level (not only in application code) to handle concurrent requests.

### 7.2 Daily Cap: Max 2 Confirmed Classes Per Mentor-Local Day

- "Mentor-local day" means the calendar date in the mentor's own timezone (not UTC, not the parent's timezone).
- A mentor may not have more than **2 confirmed bookings** on the same calendar date in their timezone.
- **Ambiguity**: The PRD does not specify mentors' individual timezones. Implementation will use IST (Asia/Kolkata, UTC+5:30) as the mentor's local timezone for all mentors, since the shift definition is in IST.

### 7.3 Lead Time

**Ambiguity**: The PRD does not specify a minimum lead time before booking. Implementation should enforce a reasonable minimum (e.g. **1 hour** before the class start time). This will be flagged for product confirmation.

### 7.4 Single Trial Per Parent

**Ambiguity**: The PRD does not explicitly state whether a parent/email can book more than one trial. This document treats the system as booking-agnostic on this point; the database schema should not enforce uniqueness on parent email at this stage unless specified.

---

## 8. Meeting Link

- A **dummy meeting link** (e.g. a static or UUID-seeded URL such as `https://meet.codeyoung.com/session/{bookingId}`) is generated at booking time.
- No real video conferencing integration is in scope.

---

## 9. Email Notifications

- Email is **mock/log-only** in this version. No real email service (SendGrid, SES, etc.) is integrated.
- The application code must expose an `EmailPort` interface (see TRD) so a real adapter can be dropped in later.
- Emails are sent (logged) for:
  - **Booking confirmation**: includes slot time (parent timezone), mentor name, meeting link, cancellation token.
  - **Cancellation confirmation**: includes booking reference and confirmation of cancellation.
- **Email failure**: A failure to send the email must **not** roll back the booking transaction. The booking is persisted; the email failure is logged as a warning.

---

## 10. Admin Dashboard

- **Read-only**: the admin can view all bookings (with status, mentor, parent, time, slot).
- **No authentication** is specified for the admin dashboard in this version.
- **Ambiguity**: The PRD does not specify auth for admin; it is explicitly omitted from scope for this version.
- The admin can view bookings filtered by date, mentor, or status.
- No admin actions (no create/edit/cancel from admin UI) are in scope for this version.

---

## 11. Idempotency

- The booking creation endpoint must support an **idempotency key** supplied by the client (e.g. via `Idempotency-Key` header).
- If the same key is received again with the **same payload**, the server returns the original response without creating a duplicate booking.
- If the same key is received with a **different payload**, the server returns an error (409 Conflict).
- Idempotency keys should be stored with the booking for a reasonable TTL (e.g. 24 hours).

---

## 12. Scope Exclusions (This Version)

- No recurring classes.
- No real video conferencing integration.
- No real payment processing.
- No real email delivery.
- No mentor authentication or mentor-facing UI.
- No parent login (booking and cancellation via credential only).
- No admin authentication.
- No mobile native app.
