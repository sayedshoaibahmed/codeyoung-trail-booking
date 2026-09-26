# Technical Requirements Document (TRD)

**Project**: CodeYoung Trial Class Booking System
**Version**: 1.0
**Status**: Draft

---

## 1. Technology Stack

| Layer              | Technology                                          |
|--------------------|-----------------------------------------------------|
| Frontend framework | React 18 + Vite 5 + TypeScript 5                    |
| Frontend routing   | React Router v6                                     |
| Frontend forms     | React Hook Form + Zod (client-side schema)          |
| Frontend styling   | Tailwind CSS v3 + PostCSS + Autoprefixer            |
| Backend runtime    | Node.js 20 LTS + Express + TypeScript               |
| Validation         | Zod (shared-schema pattern; server-side enforced)   |
| Timezone handling  | Luxon (all timezone arithmetic; no native Date math)|
| ORM                | Prisma (type-safe queries, migrations)              |
| Database           | PostgreSQL 16                                       |
| Email              | Mock adapter (console/log); EmailPort interface exposed for future swap |

---

## 2. Backend Architecture: Clean Architecture

### 2.1 Layer Definitions

```
backend/src/
  domain/          Pure business entities and rules. Zero external dependencies.
  application/     Use cases. Depends only on domain + ports (interfaces).
  infrastructure/  Concrete implementations of ports (Prisma, Luxon, mock email).
  interfaces/      Express routes, controllers, Zod request validation, error middleware.
  config/          Environment loading (dotenv), app bootstrap.
  index.ts         Entry point.
```

### 2.2 Dependency Inversion Rule

> **Inner layers must never import from outer layers.**

```
interfaces  -->  application  -->  domain
                     |
              infrastructure
                  (injected at composition root in config/ or index.ts)
```

- `domain` imports nothing from this project.
- `application` imports `domain` types + **port interfaces** (defined in `application/ports/`).
- `infrastructure` imports `application` ports and provides concrete classes.
- `interfaces` imports `application` use cases (injected), never `infrastructure` directly.
- Dependency injection is done manually at the composition root (no IoC container required at this scale).

### 2.3 Ports (Application-Layer Interfaces)

| Port Interface       | Responsibility                                           | Concrete Adapter (infrastructure) |
|----------------------|----------------------------------------------------------|------------------------------------|
| `BookingRepository`  | Persist and query bookings (with locking)               | `PrismaBookingRepository`          |
| `MentorRepository`   | Query mentors, load counts, find eligible mentors        | `PrismaMentorRepository`           |
| `IdempotencyStore`   | Store and retrieve idempotency key results               | `PrismaIdempotencyStore`           |
| `EmailPort`          | Send (or log) confirmation and cancellation emails       | `ConsoleEmailAdapter`              |
| `MeetingLinkPort`    | Generate a dummy meeting URL for a booking               | `DummyMeetingLinkAdapter`          |
| `ClockPort`          | Return the current UTC instant (injectable for testing) | `SystemClockAdapter`               |

### 2.4 Use Cases (Application Layer)

| Use Case                  | Ports Used                                                         |
|---------------------------|---------------------------------------------------------------------|
| `BookTrialClass`          | `BookingRepository`, `MentorRepository`, `IdempotencyStore`, `EmailPort`, `MeetingLinkPort`, `ClockPort` |
| `CancelBooking`           | `BookingRepository`, `EmailPort`, `ClockPort`                      |
| `GetAvailableSlots`       | `MentorRepository`, `BookingRepository`, `ClockPort`               |
| `ListBookingsForAdmin`    | `BookingRepository`, `MentorRepository`                            |

---

## 3. Frontend Architecture: Feature-Sliced Design (FSD)

### 3.1 Layer Definitions

```
frontend/src/
  app/        Global setup: router, providers, global CSS.
  pages/      Route-level components. Assemble widgets for a full screen.
  widgets/    Composite UI blocks (e.g. BookingFormWidget, AdminTableWidget).
  features/   Specific user interactions with side-effects (e.g. book-slot, cancel-booking).
  entities/   Domain object representations and their basic UI (e.g. Booking, Mentor, Slot).
  shared/     Reusable utilities, API client, UI primitives, Zod schemas, constants.
```

### 3.2 Import Direction Rule

> **Layers may only import from layers below them.**

```
pages --> widgets --> features --> entities --> shared
app   --------------------------------^---------> shared
```

- `pages` may import `widgets`, `features`, `entities`, `shared`.
- `widgets` may import `features`, `entities`, `shared`.
- `features` may import `entities`, `shared`.
- `entities` may import `shared` only.
- `shared` has no intra-project imports.
- No layer may import from `pages` or `app`.

### 3.3 Responsibility Mapping

| Responsibility              | Frontend Layer / Slice                            |
|-----------------------------|---------------------------------------------------|
| Global routing              | `app/`                                            |
| Booking form UI             | `widgets/BookingFormWidget`                       |
| Slot selection              | `features/select-slot`                            |
| Submit booking API call     | `features/book-slot`                              |
| Cancel booking API call     | `features/cancel-booking`                         |
| Booking entity display      | `entities/booking`                                |
| Mentor entity display       | `entities/mentor`                                 |
| Admin table                 | `widgets/AdminTableWidget`                        |
| Admin page                  | `pages/AdminPage`                                 |
| Parent booking page         | `pages/BookingPage`                               |
| Confirmation page           | `pages/ConfirmationPage`                          |
| API client (axios/fetch)    | `shared/api`                                      |
| Zod schemas (client)        | `shared/schemas`                                  |
| Timezone display utilities  | `shared/lib/timezone`                             |

---

## 4. Data Model

### 4.1 `Mentor`

| Column       | Type      | Notes                                                        |
|--------------|-----------|--------------------------------------------------------------|
| `id`         | UUID PK   |                                                              |
| `name`       | String    |                                                              |
| `email`      | String    | Unique                                                       |
| `shift`      | Enum      | `SHIFT_1` (09:00–21:00 IST) or `SHIFT_2` (21:00–09:00 IST) |
| `timezone`   | String    | IANA. Defaults to `Asia/Kolkata` for all mentors (IST)      |
| `createdAt`  | Timestamp |                                                              |

### 4.2 `Booking`

| Column              | Type      | Notes                                                             |
|---------------------|-----------|-------------------------------------------------------------------|
| `id`                | UUID PK   |                                                                   |
| `mentorId`          | UUID FK   | References `Mentor.id`                                            |
| `parentName`        | String    |                                                                   |
| `parentEmail`       | String    |                                                                   |
| `childName`         | String    |                                                                   |
| `parentTimezone`    | String    | IANA timezone string supplied by parent                           |
| `startTimeUtc`      | Timestamp | UTC; start of the 1-hour session                                  |
| `endTimeUtc`        | Timestamp | UTC; always startTimeUtc + 1 hour                                 |
| `status`            | Enum      | `CONFIRMED`, `CANCELLED`                                          |
| `meetingLink`       | String    | Dummy URL                                                         |
| `cancellationToken` | String    | UUID v4; used to authenticate cancellation                        |
| `idempotencyKey`    | String    | Unique; client-supplied key                                       |
| `createdAt`         | Timestamp |                                                                   |
| `cancelledAt`       | Timestamp | Nullable; set on cancellation                                     |

### 4.3 Database Constraints

- `UNIQUE (mentorId, startTimeUtc)` where status = `CONFIRMED` — enforces no double-booking at DB level (implemented via partial unique index).
- `UNIQUE (idempotencyKey)` — enforces idempotency at DB level.

---

## 5. API Contracts

### 5.1 `POST /api/bookings` — Create Booking

**Headers**:
```
Idempotency-Key: <uuid>
Content-Type: application/json
```

**Request Body**:
```json
{
  "parentName": "string",
  "parentEmail": "string (email)",
  "childName": "string",
  "parentTimezone": "string (IANA)",
  "requestedStartUtc": "string (ISO 8601 UTC)"
}
```

**Success 201**:
```json
{
  "bookingId": "uuid",
  "mentorName": "string",
  "startTimeUtc": "ISO 8601",
  "endTimeUtc": "ISO 8601",
  "meetingLink": "string",
  "cancellationToken": "uuid",
  "status": "CONFIRMED"
}
```

**Error responses**: see Section 8.

**Idempotent replay 200**: same body as original 201.

---

### 5.2 `GET /api/slots` — Get Available Slots

**Query params**: `date` (YYYY-MM-DD, in parent's timezone), `timezone` (IANA).

**Success 200**:
```json
{
  "slots": [
    { "startUtc": "ISO 8601", "endUtc": "ISO 8601", "available": true }
  ]
}
```

---

### 5.3 `DELETE /api/bookings/:id` — Cancel Booking

**Headers**:
```
X-Cancellation-Token: <uuid>
```

**Success 200**:
```json
{
  "bookingId": "uuid",
  "status": "CANCELLED",
  "cancelledAt": "ISO 8601"
}
```

---

### 5.4 `GET /api/admin/bookings` — Admin: List All Bookings

**Query params**: `date?`, `mentorId?`, `status?` (`CONFIRMED` | `CANCELLED`).

**Success 200**:
```json
{
  "bookings": [
    {
      "bookingId": "uuid",
      "mentorName": "string",
      "parentName": "string",
      "parentEmail": "string",
      "childName": "string",
      "startTimeUtc": "ISO 8601",
      "endTimeUtc": "ISO 8601",
      "status": "CONFIRMED | CANCELLED"
    }
  ]
}
```

---

## 6. Transaction and Locking Strategy

### 6.1 Booking Transaction

The `BookTrialClass` use case must execute inside a single PostgreSQL transaction with the following steps:

1. **Lock the idempotency key row** (`SELECT FOR UPDATE SKIP LOCKED` or equivalent) to prevent parallel duplicate processing.
2. **Check if idempotency key already exists** — if yes, return stored response immediately.
3. **Load candidate mentors** (shift-eligible) with `SELECT ... FOR UPDATE` on their booking rows for the target slot. This acquires row-level locks to prevent concurrent assignment to the same mentor.
4. **Apply eligibility filters**: no overlap, daily cap < 2.
5. **Select least-loaded** eligible mentor.
6. **Insert the booking record**.
7. **Insert the idempotency key record** (with response payload).
8. **Commit**.
9. **After commit**: send confirmation email (outside the transaction; failure is non-fatal).

### 6.2 Cancellation Transaction

1. **Fetch booking by ID with `SELECT FOR UPDATE`**.
2. **Validate**: status is `CONFIRMED`, cancellation token matches, `now() < startTimeUtc`.
3. **Update status** to `CANCELLED`, set `cancelledAt = now()`.
4. **Commit**.
5. **After commit**: send cancellation email (outside transaction; failure is non-fatal).

### 6.3 Isolation Level

Use PostgreSQL's default **Read Committed** isolation. Row-level `SELECT FOR UPDATE` locking is sufficient for the contention patterns in this system. Serializable isolation is not required.

---

## 7. Timezone Handling (Luxon)

- **All timestamps are stored in UTC** in the database.
- **Luxon** (`DateTime` from `luxon`) is used for all timezone arithmetic. No `new Date()`, no `Date.toLocaleString()`, no manual offset math.
- Conversion pattern:

```typescript
// Parent-local to UTC
const utc = DateTime.fromISO(localIso, { zone: parentTimezone }).toUTC();

// UTC to mentor-local (for daily-cap boundary)
const mentorLocal = DateTime.fromJSDate(booking.startTimeUtc, { zone: 'Asia/Kolkata' });
const mentorDay = mentorLocal.toISODate(); // 'YYYY-MM-DD'

// Shift boundary check (in IST)
const slotInIST = DateTime.fromJSDate(requestedStartUtc, { zone: 'Asia/Kolkata' });
```

- DST handling: Luxon resolves ambiguous local times (e.g. clocks fall back) using the `disambiguation` option (`earlier` | `later` | `reject`). The default behaviour must be made explicit; implementation should **reject** ambiguous input and return a 422 to the client with a human-readable message.

---

## 8. Error Response Format

All API errors follow a consistent envelope:

```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human-readable description",
    "details": {}
  }
}
```

| HTTP Status | Code                        | Condition                                         |
|-------------|-----------------------------|---------------------------------------------------|
| 400         | `VALIDATION_ERROR`          | Zod schema failure on request body                |
| 409         | `IDEMPOTENCY_CONFLICT`      | Same key, different payload                       |
| 409         | `SLOT_UNAVAILABLE`          | No mentor eligible for requested slot             |
| 409         | `ALREADY_CANCELLED`         | Booking already cancelled                         |
| 403         | `INVALID_CANCELLATION_TOKEN`| Token mismatch                                    |
| 422         | `PAST_SLOT`                 | Requested time is in the past                     |
| 422         | `LEAD_TIME_VIOLATION`       | Requested time is within the minimum lead window  |
| 422         | `AFTER_START_CANCELLATION`  | Cancellation attempted after class start time     |
| 422         | `AMBIGUOUS_TIME`            | Luxon rejected a DST-ambiguous local time         |
| 404         | `BOOKING_NOT_FOUND`         | Booking ID does not exist                         |
| 500         | `INTERNAL_ERROR`            | Unhandled server error                            |

---

## 9. Idempotency Implementation

1. Client must generate a UUID v4 and send it as the `Idempotency-Key` HTTP header.
2. Server stores `(idempotencyKey, responsePayload, createdAt)` in the `IdempotencyRecord` table (or as a JSON column on `Booking`).
3. On receipt, before any business logic:
   - If key exists and payload hash matches: return stored response with 200.
   - If key exists and payload hash does NOT match: return 409 `IDEMPOTENCY_CONFLICT`.
   - If key does not exist: proceed with booking logic.
4. Key expiry: records older than 24 hours may be pruned (background job, out of scope for v1).

---

## 10. Cancellation Flow (Technical)

```
Client                     API (interfaces)          Application             DB
  |                              |                        |                   |
  | DELETE /api/bookings/:id     |                        |                   |
  | X-Cancellation-Token: <tok> |                        |                   |
  |----------------------------->|                        |                   |
  |                              | CancelBooking usecase  |                   |
  |                              |----------------------->|                   |
  |                              |                        | BEGIN TRANSACTION |
  |                              |                        | SELECT ... FOR UPDATE (booking row)
  |                              |                        | validate token, status, time
  |                              |                        | UPDATE status=CANCELLED
  |                              |                        | COMMIT            |
  |                              |                        |------------------>|
  |                              |                        | send cancel email (outside TX)
  |<-----------------------------|                        |                   |
  | 200 { status: CANCELLED }    |                        |                   |
```

---

## 11. Responsibility Mapping

| Responsibility            | Backend Layer          | Frontend Layer/Slice          |
|---------------------------|------------------------|-------------------------------|
| Timezone conversion       | `infrastructure/`      | `shared/lib/timezone`         |
| Shift boundary validation | `domain/`              | (server-enforced only)        |
| Daily cap enforcement     | `application/`         | (server-enforced only)        |
| Booking transaction       | `application/` + `infrastructure/` | N/A            |
| Least-loaded assignment   | `application/`         | N/A                           |
| Idempotency check         | `application/`         | (client generates key)        |
| Cancellation flow         | `application/`         | `features/cancel-booking`     |
| Admin read queries        | `application/`         | `widgets/AdminTableWidget`    |
| API route handling        | `interfaces/`          | N/A                           |
| Request validation (Zod)  | `interfaces/`          | `features/`, `shared/schemas` |
| Error formatting          | `interfaces/` (middleware) | `shared/api` (error parse) |
| Meeting link generation   | `infrastructure/`      | (display only in `entities/`) |
| Email dispatch            | `infrastructure/`      | N/A                           |
