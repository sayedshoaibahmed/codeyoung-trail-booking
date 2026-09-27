# HTTP API

Base URL locally: `http://localhost:3000`. The Vite app proxies `/api` to that host. Production clients use `VITE_API_URL` (typically `https://<render-host>/api`).

Errors (except some route-local Zod bodies) use:

```json
{ "code": "SNAKE_CASE", "message": "…" }
```

`409 SLOT_NOT_AVAILABLE` may include `alternateSlots`: `{ "startUtc": "ISO", "endUtc": "ISO" }[]`.

Validation failures from Zod on booking/cancel: `400` with `code: "VALIDATION_ERROR"` and `errors: [{ field, message }]`.

There is **no** hold/reserve API.

---

## `GET /`

Health. `{ "status": "ok", "service": "CodeYoung API", "version": "1.0.0" }`.

---

## `GET /api/availability`

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

- `available` — 2-hour lead met and ≥ 1 eligible mentor.
- `full` — lead met, 0 eligible mentors.
- `blocked` — lead time not met (still listed so the UI can show a full day).

**Errors:** `400 INVALID_DATE_FORMAT`, `400 INVALID_TIMEZONE`.

---

## `GET /api/availability/next`

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

**Headers:** `Content-Type: application/json`, **`Idempotency-Key`** (required, non-empty).

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

`:id` must be a UUID or `400 VALIDATION_ERROR`.

Always **`404 BOOKING_LINK_INVALID`**. Does not call the booking read use case. Booking id is not a secret.

---

## `GET /api/classes/:id`

Same privacy behavior as `GET /api/bookings/:id` (`404 BOOKING_LINK_INVALID` for a valid UUID).

---

## `POST /api/booking-access`

**Body:** `{ "accessToken": "string" }` (1–256 chars). Token is **not** accepted as a query parameter.

**200:** booking DTO (no token hashes, no raw tokens):

`id`, `parentName`, `parentEmail`, `childName`, `parentTimezone`, `startTimeUtc`, `endTimeUtc`, `mentorId`, `mentorName`, `mentorTimezone`, `mentorLocalDate`, `meetingLink`, `status`, `cancelledAt`, `createdAt`, `updatedAt`.

**404** `BOOKING_LINK_INVALID` for missing, wrong, or invalid-format tokens (same message).

---

## `POST /api/bookings/:id/cancel`

**Body:** `{ "cancellationToken": "string" }` (1–256).

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

---

## `GET /api/admin/dashboard`

No query params, no auth.

**200:** `generatedAt`, `summary` (`totalBookings`, `confirmedBookings`, `cancelledBookings`), `upcomingConfirmed` (up to 10 future CONFIRMED), `recentlyCancelled` (5), `mentorUtilization` (per-mentor confirmed/cancelled counts).
