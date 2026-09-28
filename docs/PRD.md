# Product Requirements Document (PRD)

**Project:** CodeYoung Trial Class Booking System
**Status:** Matches the current repository (not a hold/reservation design)

This document describes the **implemented** product. It does not specify a 2-minute mentor HOLD, reservation countdown, or pre-confirmation lock.

---

## 1. Overview

CodeYoung offers a **free 1-hour trial class**. A parent books a single session; the system assigns an eligible mentor, confirms immediately, emails parent and mentor, and allows token-based cancellation before start.

**Booking states that exist:** `CONFIRMED` and `CANCELLED` only.

Architecture is a single Express service plus a Vite SPA. Not microservices or event-driven.

---

## 2. Actors

| Actor | Role in this version |
|-------|----------------------|
| Parent | Books without an account; later opens `/b/{accessToken}` or uses the cancel token / email cancel link. |
| Mentor | Assigned automatically; receives a notification email after confirm. No mentor UI. |
| Admin | Logs in with server-side env credentials; views a **read-only** dashboard. Single shared demo account. |

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

1. **Landing:** Marketing page with CTA to `/book`, 2-hour lead-time copy, and **Admin Dashboard** link to `/admin`.
2. **Timezone:** The booking UI uses the **browser-resolved IANA timezone**. Parents do not pick a zone from a list. The selected date is that timezone’s calendar day.
3. **Details:** Parent name, email, child name, date.
4. **Availability:** 1-hour IST-aligned slots whose start is on the selected parent-local day. Presentation groups: Morning, Afternoon, Evening, Night (by parent local hour). States: selectable (`available`), fully booked (`full`), unavailable/lead-blocked (`blocked`), plus selected styling in the grid.
5. **Loading:** Availability fetch shows a loading state. Date changes abort in-flight requests and ignore stale responses (`AbortController` + request id). Changing date **clears** the selected slot immediately.
6. **Next Available Date:** If the selected day has no selectable slot (after load, without a fetch error), the UI asks for the next parent-local date with an `available` slot. Server searches **30** days after the selected date.
7. **Book:** One submit creates a **CONFIRMED** booking (no hold). Mentor is the least-loaded eligible mentor (fewest CONFIRMED that mentor-local day, then mentor id).
8. **Confirmation:** Navigate to `/b/:accessToken`. Immediate skeleton while `POST /api/booking-access` runs. Details show parent-local and mentor-local times.
9. **Emails:** After commit — parent confirmation (HTML + text: Join Class, View Booking, Cancel Booking, plus token on its own line in text) and mentor notification (operational details only).
10. **Demo class:** In-app room at `/class/:bookingId`. Email Join Class includes `?access=` so the room can validate the token. In-app Join from View Booking uses React Router state.
11. **Cancel:** Before start, with the cancellation token (email link `/cancel/:bookingId?token=…`, paste field, or in-session router state). Whitespace is stripped from pasted tokens; validation remains bcrypt.

**Legacy route:** `/confirmation/:id` does not call `GET /api/bookings/:id`. It tells the parent to use the email link `/b/:accessToken`.

**`/book` navigation:** Home only; no Admin Area link.

---

## 5. Mentor assignment

1. Mentors on the shift that contains the slot.
2. Exclude mentors with a **CONFIRMED** overlap on `[start, end)`.
3. Exclude mentors with **2 CONFIRMED** bookings on that `mentorLocalDate`.
4. Pick lowest day-count, then id.
5. If the chosen mentor hits `bookings_mentor_slot_confirmed_unique`, the same SERIALIZABLE transaction rolls back to a savepoint and tries the next eligible mentor.
6. `P2034` (serialization failure) retries the **entire** transaction up to 3 times.
7. If none: `SLOT_NOT_AVAILABLE` and up to **3** alternate 1-hour starts in the **next 12 hours** that still fit a shift and have an eligible mentor.

The parent never chooses a mentor.

Availability classification uses a batched mentor+CONFIRMED snapshot in memory. Booking still calls `findEligibleMentors` inside the transaction.

---

## 6. Confirmation vs cancellation

| Status | Meaning |
|--------|---------|
| CONFIRMED | Occupies the mentor slot and counts toward the daily cap. |
| CANCELLED | Does not occupy the slot or the cap. `cancelledAt` set. |

There is no third booking status and no HOLD.

---

## 7. Secure booking access

Three different identifiers:

| Identifier | Purpose | Storage |
|------------|---------|---------|
| Booking ID (UUID) | Internal / classroom path / cancel URL path | Public-ish; **not** enough to load details |
| Access token | Reopen booking details (`/b/{token}`, `POST /api/booking-access`) | SHA-256 hash only |
| Cancellation token | Cancel (`POST /api/bookings/:id/cancel`) | bcrypt hash only |

- At create time the API returns raw **access** and **cancellation** tokens once.
- Email View Booking uses `/b/{rawAccessToken}`.
- Email Join Class uses `/class/{id}?access={rawAccessToken}` (access token, not cancel token).
- Email Cancel Booking uses `/cancel/{id}?token={rawCancellationToken}`.
- `GET /api/bookings/:id` does not disclose the booking (`404 BOOKING_LINK_INVALID`).
- Mentor emails include booking id and `meetingLink` (classroom path). They do **not** include cancellation or access secrets.

---

## 8. Cancellation (product)

- Only **before** class start: backend rejects when `now >= startTimeUtc` (exact start is too late).
- Credential: high-entropy token, bcrypt-hashed at rest; compared with bcrypt.
- Successful first cancel → `CANCELLED`, capacity released, parent cancellation email.
- Repeat cancel with **valid** token → `alreadyCancelled: true`, no extra email (idempotent for the parent).
- Invalid token → 401. After start → 409, booking stays CONFIRMED.
- Normal GET booking-access DTO does **not** include the raw cancellation token.
- UI hides cancel in live and completed phases; backend still enforces the cutoff if the API is called.

---

## 9. Email notifications

Production: **Resend**. Tests: console mock. If `RESEND_API_KEY` or `EMAIL_FROM` is missing, send is skipped and logged; the booking stays CONFIRMED.

- **No email** until the booking transaction has committed.
- Parent confirmation: HTML buttons (Join Class, View Booking, Cancel Booking) plus a boxed token; plain text has the same links and the token on its **own line** (not only a wrapping raw string).
- Mentor: assignment notice (names, times, timezones, Join Class via stored `meetingLink`, booking id). **No** cancel token, access token, hashes, or API keys.
- Cancel: parent email after a new cancellation only (plain text).
- Provider failure does not un-confirm the booking.

---

## 10. Class lifecycle (parent UI)

On View Booking and classroom (when a summary exists):

- **Upcoming** (`now < start`): details accessible; Join Class available for CONFIRMED; cancel available.
- **During class** (`start <= now < end`): Join Class available; cancel hidden / unavailable.
- **After class** (`now >= end`): **Class Completed** / **This class has already ended.** Join Class not shown; details remain accessible.

Admin dashboard listing still shows a Join Room link for CONFIRMED upcoming rows from the API (not gated by the same completed-phase helper).

---

## 11. Admin dashboard

- Purpose: assignment/demo overview of bookings and mentor load. **Read-only** (no booking mutations).
- Login: `POST /api/admin/login` with env `ADMIN_USERNAME` / `ADMIN_PASSWORD`. Session: HTTP-only cookie `cy_admin_session`, HMAC-SHA256, 8-hour TTL, process-local live token set.
- Production cookie: `Secure` + `SameSite=None` so Vercel can call Render with `credentials: 'include'`.
- Logout revokes the token in-process and clears the cookie.
- Login throttled: 8 attempts / 15 minutes / IP (in-memory).
- Dashboard API and session endpoint require a valid cookie (`401 ADMIN_UNAUTHORIZED`).
- UI: totals (all / confirmed / cancelled), mentor table (name, email, shift, confirmed/cancelled counts), next 10 upcoming CONFIRMED, 5 recently cancelled. Times shown as UTC and mentor-local using stored `mentorTimezone`.
- Frontend never stores the admin password in localStorage or the bundle.
- Limitation: process restart on Render invalidates sessions. No Redis session store.

Evaluator demo username/password are documented only in the root README (not as production secrets).

---

## 12. Business rules (authoritative)

- 1-hour classes; 2-hour minimum lead time (exact millisecond threshold, no rounding up to the next hour).
- 10 mentors; 5 per IST shift; overnight Shift 2 documented above.
- Full hour must fit the shift.
- UTC storage; Luxon for zone/DST.
- Daily cap 2 **CONFIRMED** per mentor-local day.
- CANCELLED ignored for cap and unique slot index.
- Idempotent create via `Idempotency-Key`.
- SERIALIZABLE booking transaction + CONFIRMED partial unique index + savepoint mentor retry + P2034 retry (3).
- Alternate slots when the requested hour cannot be booked.
- Email failure isolated from commit.

---

## 13. Assumptions and out of scope

- One email may book multiple trials (no unique parent-email constraint).
- No payments, no real video vendor, no mentor app.
- No HOLD / reservation product.
- No background job for idempotency TTL (env name unused).
- No Redis/Kafka/WebSockets/microservices.
- Admin is simple single-account auth, not RBAC.

---

## 14. Display conventions

- Friendly timezone labels in the booking UI (`formatTimezoneLabel`) for several IANA zones; booking still stores IANA.
- Admin times come from API ISO timestamps (UTC formatter + mentor zone), not a separate “admin IST-only” API.
