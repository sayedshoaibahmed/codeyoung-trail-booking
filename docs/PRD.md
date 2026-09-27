# Product Requirements Document (PRD)

**Project:** CodeYoung Trial Class Booking System
**Status:** Matches the current repository (not a hold/reservation design)

This document describes the **implemented** product. It does not specify a 2-minute mentor HOLD, reservation countdown, or pre-confirmation lock.

---

## 1. Overview

CodeYoung offers a **free 1-hour trial class**. A parent books a single session; the system assigns an eligible mentor, confirms immediately, emails parent and mentor, and allows token-based cancellation before start.

**Booking states that exist:** `CONFIRMED` and `CANCELLED` only.

---

## 2. Actors

| Actor | Role in this version |
|-------|----------------------|
| Parent | Books without an account; later opens `/b/{accessToken}` or uses the cancel token. |
| Mentor | Assigned automatically; receives email after confirm. No mentor UI. |
| Admin | Views a **read-only, unauthenticated** dashboard. |

---

## 3. Mentor roster and shifts

Exactly **10** mentors are seeded (5 + 5). All use IANA `Asia/Kolkata`.

| Shift | IST window | Count | Notes |
|-------|------------|-------|--------|
| Shift 1 | 09:00–21:00 | 5 | Same IST calendar day |
| Shift 2 | 21:00–09:00 | 5 | Overnight; crosses IST midnight |

A mentor is bookable only when the **full 1-hour class** lies inside their shift. Mentors do not rotate shifts in this version.

`MentorShift` rows are seeded as schedule metadata. Eligibility uses the mentor’s `shift` enum plus CONFIRMED overlap and daily cap.

---

## 4. Parent journey

1. **Timezone:** The booking UI uses the **browser-resolved IANA timezone**. Parents do not pick a zone from a list.
2. **Details:** Parent name, email, child name, date.
3. **Availability:** 1-hour IST-aligned slots whose start is on the selected parent-local day. Presentation groups: Morning, Afternoon, Evening, Night (by parent local hour). States: selectable (`available`), fully booked (`full`), unavailable/lead-blocked (`blocked`), plus selected styling in the grid.
4. **Loading:** Availability fetch shows a loading state. Date changes abort in-flight requests and ignore stale responses (`AbortController` + request id).
5. **Next Available Date:** If the selected day has no selectable slot (after load, without a fetch error), the UI asks for the next parent-local date with an `available` slot. Server searches **30** days after the selected date.
6. **Book:** One submit creates a **CONFIRMED** booking (no hold). Mentor is the least-loaded eligible mentor (fewest CONFIRMED that mentor-local day, then mentor id).
7. **Confirmation:** Navigate to `/b/:accessToken`. Details show parent-local and mentor-local times, Join Class, cancel when allowed.
8. **Emails:** After commit — parent confirmation (including secure cancel + view-booking material) and mentor notification (operational details only).
9. **Demo class:** In-app room at `/class/:bookingId`.
10. **Cancel:** Before start, with the cancellation token (email or in-session router state).

**Legacy route:** `/confirmation/:id` does not call `GET /api/bookings/:id`. It tells the parent to use the email link `/b/:accessToken`.

---

## 5. Mentor assignment

1. Mentors on the shift that contains the slot.
2. Exclude mentors with a **CONFIRMED** overlap on `[start, end)`.
3. Exclude mentors with **2 CONFIRMED** bookings on that `mentorLocalDate`.
4. Pick lowest day-count, then id.
5. If none: `SLOT_NOT_AVAILABLE` and up to **3** alternate 1-hour starts in the **next 12 hours** that still fit a shift and have an eligible mentor.

The parent never chooses a mentor.

---

## 6. Confirmation vs cancellation

| Status | Meaning |
|--------|---------|
| CONFIRMED | Occupies the mentor slot and counts toward the daily cap. |
| CANCELLED | Does not occupy the slot or the cap. `cancelledAt` set. |

There is no third booking status.

---

## 7. Secure booking access

- At create time the API returns a raw **access token** (once). It is stored only as SHA-256.
- Email “View Booking” uses `/b/{rawAccessToken}`.
- `POST /api/booking-access` with the token in the **body**.
- `GET /api/bookings/:id` does not disclose the booking.

---

## 8. Cancellation (product)

- Only **before** class start (UTC instant vs `startTimeUtc`).
- Credential: high-entropy token, bcrypt-hashed at rest; compared with bcrypt.
- Successful first cancel → `CANCELLED`, capacity released, parent cancellation email.
- Repeat cancel with **valid** token → `alreadyCancelled: true`, no extra email (idempotent for the parent).
- Invalid token → 401. After start → 409, booking stays CONFIRMED.
- Normal GET booking-access DTO does **not** include the raw cancellation token.

---

## 9. Email notifications

Production: **Resend**. Tests: console mock.

- **No email** until the booking transaction has committed.
- Parent: confirmation (class times, parent + mentor clocks, Join Class, View Booking, cancellation token).
- Mentor: assignment notice (names, times, timezones, Join Class, booking id). **No** cancel token, access token, hashes, or API keys.
- Cancel: parent email after a new cancellation only.
- Provider failure does not un-confirm the booking.

---

## 10. Admin dashboard

Read-only summary: totals, upcoming CONFIRMED, recent CANCELLED, mentor utilization. No login. No admin mutations.

---

## 11. Business rules (authoritative)

- 1-hour classes; 2-hour minimum lead time.
- 10 mentors; 5 per IST shift; overnight Shift 2 documented above.
- Full hour must fit the shift.
- UTC storage; Luxon for zone/DST.
- Daily cap 2 **CONFIRMED** per mentor-local day.
- CANCELLED ignored for cap and unique slot index.
- Idempotent create via `Idempotency-Key`.
- SERIALIZABLE booking transaction + CONFIRMED partial unique index.
- Alternate slots when the requested hour cannot be booked.
- Email failure isolated from commit.

---

## 12. Assumptions and out of scope

- One email may book multiple trials (no unique parent-email constraint).
- No payments, no real video vendor, no mentor app, no admin auth.
- No HOLD / reservation product.
- No background job for idempotency TTL (env name unused).

---

## 13. Display conventions

- Friendly timezone labels in the booking UI (`formatTimezoneLabel`) for several IANA zones; booking still stores IANA.
- Admin times come from API ISO timestamps (not a separate “admin IST-only” API).
