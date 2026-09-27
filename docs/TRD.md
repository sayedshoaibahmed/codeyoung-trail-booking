# Technical Requirements Document (TRD)

**Project:** CodeYoung Trial Class Booking System
**Status:** Describes the repository as implemented

Architecture is **Clean Architecture (backend)** + **Feature-Sliced Design (frontend)**.
This is not a “lightweight FSD” or “simple layered” sketch. Ports, use cases, and FSD import rules are real.

There is **no** MentorHold model, hold API, Redis, Kafka, or booking worker.

---

## 1. Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind 3, React Router 6, RHF, Zod |
| Backend | Node.js, Express 5, TypeScript, Zod, Prisma 5, Luxon, bcrypt, Resend |
| Database | PostgreSQL (`timestamptz`) |
| Tests | Vitest (backend); Node `--test` (frontend `.mjs`) |

---

## 2. Backend — Clean Architecture

```
backend/src/
  domain/           Entities, shift/lead rules, domain errors. No Prisma/Express/Luxon/Resend.
  application/      Use cases, ports, snapshot eligibility, token hashing helpers.
  infrastructure/   Prisma repos, UoW, LuxonTimezoneService, email, composition root.
  interfaces/       Routes, Zod DTOs, CORS is in index.ts, errorHandler. No booking rules.
  index.ts          Express bootstrap, CORS, mount /api.
```

**Dependency rule**

- `domain` depends on nothing internal.
- `application` depends on `domain` and port types only (no Prisma, Express, Resend, Nodemailer).
- `infrastructure` and `interfaces` depend inward on application/domain. They must not be imported by domain/application.
- Binding: `infrastructure/index.ts` (composition root), imported by `src/index.ts`.

### 2.1 Domain

- `Booking` / `BookingStatus` (`CONFIRMED` \| `CANCELLED`), `Mentor`, `MentorShift` types, `shiftValidation` (duration, lead time, shift containment).
- Domain errors (`SLOT_NOT_AVAILABLE`, DST errors, etc.).

### 2.2 Application — use cases and ports

**Use cases:** `GetAvailability`, `GetNextAvailableDate`, `BookClass`, `CancelClass`, `GetBooking`, `GetBookingByAccess`, `GetAdminDashboard`.

**Ports:** `MentorRepository` (`findEligibleMentors`, `loadAvailabilitySnapshot`, …), `BookingRepository`, `IdempotencyStore`, `TimezoneService`, `EmailService`, `UnitOfWork`, `AdminDashboardRepository`.

`GetAvailability` loads one mentor+CONFIRMED snapshot (two `findMany`s) and classifies slots in memory (`eligibleMentorsFromSnapshot`). **Booking** still calls `findEligibleMentors` inside the transaction.

`BookClass` hashes the payload (SHA-256 of sorted JSON), bcrypt-hashes the cancel token, SHA-256-hashes the access token, runs `uow.run` (SERIALIZABLE), then fire-and-forget **two** emails.

### 2.3 Infrastructure

- `PrismaMentorRepository`, `PrismaBookingRepository`, `PrismaIdempotencyStore`, `PrismaUnitOfWork` (SERIALIZABLE, 20s timeout), `PrismaAdminDashboardRepository`.
- `LuxonTimezoneService` (injectable clock).
- `ResendEmailService` (`RESEND_API_KEY`, `EMAIL_FROM`), `createEmailService()`, `MockEmailService`.
- `NodemailerEmailService` implements the port but is **not** wired in the composition root.
- Meeting links are built in `BookClass` (`/class/{id}` or `FRONTEND_ORIGIN` prefix), not a separate MeetingLink port.

### 2.4 Interfaces

- Routers under `interfaces/routes/`.
- `errorHandler` maps domain errors to HTTP (see [API.md](API.md)).
- `GET /api/bookings/:id` and `GET /api/classes/:id` intentionally do not invoke `GetBookingUseCase`.

---

## 3. Frontend — Feature-Sliced Design

```
frontend/src/
  app/        Router, providers, global styles (`App.tsx` routes).
  pages/      Landing, booking, booking-access, confirmation, class-room, admin-dashboard.
  widgets/    BookingFormWidget (and tests).
  features/   book-slot, view-availability, view-booking, cancel-booking, view-dashboard.
  entities/   booking, slot, mentor UI/data primitives.
  shared/     UI kit, API base (`VITE_API_URL`), timezone labels, classroom path helpers.
```

**Import rule:** `app` / `pages` → `widgets` → `features` → `entities` → `shared`. No upward imports (e.g. features must not import pages).

**Routes**

| Path | Page |
|------|------|
| `/` | Landing |
| `/book` | Booking form |
| `/b/:accessToken` | Secure booking access |
| `/confirmation/:id` | Legacy URL. Does not fetch by booking id. Details are `/b/:accessToken`. |
| `/class/:id` | Demo classroom |
| `/admin` | Dashboard |

---

## 4. Database (Prisma / PostgreSQL)

Tables: **`mentors`**, **`mentor_shifts`**, **`bookings`**, **`idempotency_keys`**.
No hold table. No cron.

### Mentor

`id`, `name`, `email` unique, `timezone` (default `Asia/Kolkata`), `shift` (`SHIFT_1` \| `SHIFT_2`), `active`, timestamps.

### MentorShift

Per-mentor schedule: `dayOfWeek` (null = every day), `localStartTime` / `localEndTime`, `crossesMidnight`. Seeded; booking eligibility uses `Mentor.shift`.

### Booking

| Field | Notes |
|-------|--------|
| `startTimeUtc` / `endTimeUtc` | `timestamptz`, 1 hour apart |
| `mentorLocalDate` | `YYYY-MM-DD` IST date for the cap |
| `status` | `CONFIRMED` (default) \| `CANCELLED` |
| `cancellationTokenHash` | bcrypt; raw token never stored |
| `accessTokenHash` | SHA-256 hex, unique |
| `idempotencyKey` | unique |
| `cancelledAt` | set on cancel |
| `meetingLink` | in-app class path |

**Indexes / constraints**

- Unique `accessTokenHash`, `idempotencyKey`.
- Partial unique `bookings_mentor_slot_confirmed_unique` on `(mentorId, startTimeUtc) WHERE status = 'CONFIRMED'` (raw SQL migration).
- Indexes on `(mentorId, startTimeUtc)`, `(mentorId, mentorLocalDate, status)`, `status`.

**Cancellation and capacity:** Updating to `CANCELLED` drops the row out of the partial unique index and out of CONFIRMED counts.

### IdempotencyKey

`key` unique, `payloadHash`, `responseJson`, `bookingId` unique. No TTL job.

---

## 5. Transactions and concurrency

`PrismaUnitOfWork.run` uses **Serializable** isolation (not Read Committed).

1. Optional pre-tx idempotency lookup.
2. Inside tx: eligible mentors, least-loaded first. A confirmed-slot unique violation rolls back to a savepoint and tries the next eligible mentor. Then the idempotency row is inserted.
3. After commit: emails.

`P2034` (serialization failure) retries the whole transaction up to 3 times. Other `P2002` conflicts (idempotency key, access token) are not treated as “try the next mentor.” Cancel uses `SELECT … FOR UPDATE` on the booking row.

`findEligibleMentors` does **not** issue `SELECT FOR UPDATE` on mentor rows despite an older comment on the port; safety is isolation + unique index.

---

## 6. Timezone (Luxon)

All persisted instants are UTC. `TimezoneService.toUtc` / `toLocal` / `validateTimezone` / `now` wrap Luxon. Ambiguous and nonexistent local times throw domain errors (HTTP 400). Daily cap uses precomputed `mentorLocalDate`, not a SQL `AT TIME ZONE` expression at read time.

---

## 7. Email (production)

```
NODE_ENV === 'test'  → MockEmailService
otherwise            → createEmailService() → ResendEmailService
```

`EmailService`: `sendBookingConfirmation`, `sendBookingCancellation`, `sendMentorBookingNotification`.

---

## 8. Error envelope

`{ "code", "message" }` plus optional `alternateSlots`. See [API.md](API.md) for status codes (e.g. `SLOT_NOT_AVAILABLE` not `SLOT_UNAVAILABLE`; cancel token `401`; idempotency conflict `400`).

---

## 9. Frontend availability UX (implemented)

- `useAvailability`: abort previous GET when date/timezone changes; ignore stale completions.
- Slot grouping: `groupSlots.ts` day parts (morning 05–12, afternoon 12–17, evening 17–21, night otherwise).
- `useNextAvailableDate` when the loaded day has no selectable slot.
- Slot conflict: clear selection, refetch, copy from `useBookSlot` (`SLOT_NOT_AVAILABLE`).

---

## 10. Deployment (from repo config)

- Frontend: Vite build; Vercel SPA rewrite in `frontend/vercel.json`.
- Backend: `tsc` + `node dist/index.js`; `PORT`.
- CORS and join-link prefix: `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS`.
- Email: Resend env vars only.

This document does not assert a live production probe.
