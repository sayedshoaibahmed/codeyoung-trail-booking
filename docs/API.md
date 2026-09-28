# HTTP API

Base URL locally: `http://localhost:3000`. The Vite app proxies `/api` to that host. Production clients use `VITE_API_URL` (typically `https://codeyoung-trail-booking.onrender.com/api`).

Browser clients send `credentials: 'include'` so the admin session cookie can be set and read across Vercel and Render.

Errors (except some route-local Zod bodies) use:

```json
{ "code": "SNAKE_CASE", "message": "…" }
```

`409 SLOT_NOT_AVAILABLE` may include `alternateSlots`: `{ "startUtc": "ISO", "endUtc": "ISO" }[]`.

Validation failures from Zod on booking/cancel/admin login: `400` with `code: "VALIDATION_ERROR"` and `errors: [{ field, message }]`.

There is **no** hold/reserve API.

---

## `GET /`

Health. `{ "status": "ok", "service": "CodeYoung API", "version": "1.0.0" }`. No auth.

---

## `GET /api/availability`

**Auth:** none.

**Query:** `date` (YYYY-MM-DD, parent-local calendar day), `timezone` (IANA). Both required.

**200:**

```json
{
  "date": "YYYY-MM-DD",
  "timezone": "IANA",
  "slots": [
    {
      "startUtc": "ISO-8601",
      "endUtc": "ISO-8601",
      "startLocal": "HH:mm",
      "endLocal": "HH:mm",
      "status": "available | full | blocked"
    }
  ]
}
```

- `available` — 2-hour lead met and ≥ 1 eligible mentor (shift fit, daily CONFIRMED cap, no CONFIRMED collision).
- `full` — lead met, 0 eligible mentors.
- `blocked` — lead time not met (still listed so the UI can show a full day). **Example:** at 10:47 IST, 11:00 and 12:00 are blocked; 13:00 may be `available` or `full`. This is the 2-hour rule, not a defect.

**Errors:** `400 INVALID_DATE_FORMAT`, `400 INVALID_TIMEZONE`.

---

## `GET /api/availability/next`

**Auth:** none.

**Query:** same as availability (`date` is the **selected** parent-local day; search starts the **next** calendar day).

**200:**

```json
{
  "date": "YYYY-MM-DD",
  "timezone": "IANA",
  "searchDays": 30,
  "nextAvailableDate": "YYYY-MM-DD | null"
}
```

`nextAvailableDate` is the first later parent-local date with at least one `available` slot, or `null` if none in 30 days.

---

## `POST /api/bookings`

**Auth:** none. **Headers:** `Content-Type: application/json`, **`Idempotency-Key`** (required, non-empty).

**Body:**

| Field | Rule |
|-------|------|
| `parentName` | non-empty string, max 200 |
| `parentEmail` | email |
| `childName` | non-empty string, max 200 |
| `parentTimezone` | IANA |
| `requestedStartIso` | `YYYY-MM-DDTHH:mm:ss` **without** timezone suffix (interpreted in `parentTimezone`) |

**201:**

```json
{
  "bookingId": "uuid",
  "mentorName": "string",
  "startUtc": "ISO-8601",
  "endUtc": "ISO-8601",
  "meetingLink": "string",
  "cancellationToken": "hex",
  "accessToken": "hex",
  "status": "CONFIRMED"
}
```

Idempotent replay of the same key and payload returns the **same JSON**; the handler still responds **201**.

**Errors (selected):**

| Status | Code |
|--------|------|
| 400 | `MISSING_IDEMPOTENCY_KEY` |
| 400 | `VALIDATION_ERROR` |
| 400 | `INVALID_TIMEZONE`, `DST_AMBIGUOUS_TIME`, `DST_NONEXISTENT_TIME` |
| 400 | `LEAD_TIME_VIOLATION` |
| 400 | `SLOT_OUTSIDE_SHIFT` |
| 400 | `IDEMPOTENCY_CONFLICT` |
| 409 | `SLOT_NOT_AVAILABLE` (+ `alternateSlots` when found) |

Tokens appear **only** on this create response (and in the parent email). They are not stored in plaintext.

---

## `GET /api/bookings/:id`

**Auth:** none (intentionally useless for data).

`:id` must be a UUID or `400 VALIDATION_ERROR`.

Always **`404 BOOKING_LINK_INVALID`**. Does not call the booking read use case. Booking id is not a secret.

---

## `GET /api/classes/:id`

Same privacy behavior as `GET /api/bookings/:id` (`404 BOOKING_LINK_INVALID` for a valid UUID). Classroom UX is frontend-only.

---

## `POST /api/booking-access`

**Auth:** none. Possession of the access token is the credential.

**Body:** `{ "accessToken": "string" }` (1–256 chars). Token is **not** accepted as a query parameter on this endpoint.

Server hashes the token (SHA-256) and looks up `accessTokenHash`.

**200:** booking DTO (no token hashes, no raw tokens):

`id`, `parentName`, `parentEmail`, `childName`, `parentTimezone`, `startTimeUtc`, `endTimeUtc`, `mentorId`, `mentorName`, `mentorTimezone`, `mentorLocalDate`, `meetingLink`, `status`, `cancelledAt`, `createdAt`, `updatedAt`.

**404** `BOOKING_LINK_INVALID` for missing, wrong, or invalid-format tokens (same message).

---

## `POST /api/bookings/:id/cancel`

**Auth:** cancellation token in body (not cookie).

**Body:** `{ "cancellationToken": "string" }` (1–256). Frontend may strip whitespace before send; the API still bcrypt-compares the provided string.

**200:**

```json
{
  "bookingId": "uuid",
  "status": "CANCELLED",
  "cancelledAt": "ISO-8601",
  "alreadyCancelled": false
}
```

If already cancelled and the token is valid: same shape with `alreadyCancelled: true` (no second email).

| Status | Code |
|--------|------|
| 400 | `VALIDATION_ERROR` |
| 401 | `CANCELLATION_TOKEN_INVALID` |
| 404 | `BOOKING_NOT_FOUND` |
| 409 | `CANCELLATION_AFTER_START` |

`CANCELLATION_AFTER_START` when `now >= startTimeUtc` (exact start included). Booking stays CONFIRMED.

---

## `POST /api/admin/login`

**Auth:** none (throttled). Rate limit: 8 attempts per 15 minutes per IP (process-local map). CORS must allow credentials.

**Body:** `{ "username", "password" }` (1–200 chars each). Compared to `ADMIN_USERNAME` / `ADMIN_PASSWORD` (timing-safe). Username is trimmed.

**200:** `{ "authenticated": true }` plus `Set-Cookie` `cy_admin_session` (HTTP-only).

| Status | Code |
|--------|------|
| 400 | `VALIDATION_ERROR` |
| 401 | `ADMIN_INVALID_CREDENTIALS` |
| 429 | `ADMIN_LOGIN_RATE_LIMITED` |

If `ADMIN_SESSION_SECRET` is missing, issuing a token fails as an unexpected 500 after successful credential check (configure the secret on the server).

---

## `POST /api/admin/logout`

**Auth:** optional cookie. Always clears the cookie. If a session token is present, it is revoked from the in-process registry.

**200:** `{ "authenticated": false }`.

---

## `GET /api/admin/session`

**Auth:** valid admin session cookie.

**200:** `{ "authenticated": true }`.

**401** `ADMIN_UNAUTHORIZED` if missing, expired, unsigned, or not in the live set (e.g. after process restart).

---

## `GET /api/admin/dashboard`

**Auth:** valid admin session cookie (same as session).

**200:** `generatedAt`, `summary` (`totalBookings`, `confirmedBookings`, `cancelledBookings`), `upcomingConfirmed` (up to 10 CONFIRMED with `startTimeUtc >= now`), `recentlyCancelled` (5 most recent by `cancelledAt`), `mentorUtilization` (active mentors: name, email, shift, confirmed/cancelled counts).

**401** `ADMIN_UNAUTHORIZED` without a valid cookie.
