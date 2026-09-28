# Technical Requirements Document (TRD)

**Project:** CodeYoung Trial Class Booking System
**Status:** Describes the repository as implemented

Architecture is **Clean Architecture (backend)** + **Feature-Sliced Design (frontend)** at assignment scale (FSD-light: `app` / `pages` / `widgets` / `features` / `entities` / `shared`). Ports, use cases, and FSD import rules are real.

This is a **single Node process** plus a static SPA. There is **no** MentorHold model, hold API, Redis, Kafka, booking worker, microservice split, or event bus.

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
  infrastructure/   Prisma repos, UoW, LuxonTimezoneService, email, HMAC admin session, composition root.
  interfaces/       Routes, Zod DTOs, CORS is in index.ts, errorHandler. No booking rules.
  index.ts          Express bootstrap, CORS (credentials: true), mount /api.
```

**Dependency rule**

- `domain` depends on nothing internal.
- `application` depends on `domain` and port types only (no Prisma, Express, Resend, Nodemailer).
- `infrastructure` and `interfaces` depend inward on application/domain. They must not be imported by domain/application.
- Binding: `infrastructure/index.ts` (composition root), imported by `src/index.ts`.

### 2.1 Domain

- `Booking` / `BookingStatus` (`CONFIRMED` \| `CANCELLED`), `Mentor`, `MentorShift` types, `shiftValidation` (duration, lead time, shift containment).
- Domain errors (`SLOT_NOT_AVAILABLE`, DST errors, admin auth errors, etc.).

### 2.2 Application — use cases and ports

**Use cases:** `GetAvailability`, `GetNextAvailableDate`, `BookClass`, `CancelClass`, `GetBooking`, `GetBookingByAccess`, `GetAdminDashboard`, `AuthenticateAdmin`.

`GetBooking` exists but HTTP `GET /api/bookings/:id` does **not** call it (privacy).

**Ports:** `MentorRepository` (`findEligibleMentors`, `loadAvailabilitySnapshot`, …), `BookingRepository`, `IdempotencyStore`, `TimezoneService`, `EmailService`, `UnitOfWork`, `AdminDashboardRepository`, `AdminCredentialVerifier`, `AdminSessionService`.

`GetAvailability` loads one mentor+CONFIRMED snapshot (two `findMany`s) and classifies slots in memory (`eligibleMentorsFromSnapshot`). **Booking** still calls `findEligibleMentors` inside the transaction.

`BookClass` hashes the payload (SHA-256 of sorted JSON), bcrypt-hashes the cancel token, SHA-256-hashes the access token, runs `uow.run` (SERIALIZABLE), then fire-and-forget **two** emails.

`AuthenticateAdmin` verifies env credentials (timing-safe string compare) and issues an HMAC session token.

### 2.3 Infrastructure

- `PrismaMentorRepository`, `PrismaBookingRepository` (savepoint around confirmed insert), `PrismaIdempotencyStore`, `PrismaUnitOfWork` (SERIALIZABLE, 20s timeout, 15s maxWait), `PrismaAdminDashboardRepository`.
- `LuxonTimezoneService` (injectable clock).
- `ResendEmailService` (`RESEND_API_KEY`, `EMAIL_FROM`), `createEmailService()`, `MockEmailService`.
- `NodemailerEmailService` implements the port but is **not** wired in the composition root.
- `EnvAdminCredentials`, `HmacAdminSession` (HMAC-SHA256, in-memory `Set` of live tokens, 8h TTL).
- Meeting / email URLs are built in `BookClass` (`/class/{id}`, `/b/{access}`, `/cancel/{id}?token=`), optionally prefixed with `FRONTEND_ORIGIN`.

### 2.4 Interfaces

- Routers under `interfaces/routes/`.
- `errorHandler` maps domain errors to HTTP (see [API.md](API.md)).
- `GET /api/bookings/:id` and `GET /api/classes/:id` intentionally do not invoke `GetBookingUseCase`.
- Admin: login rate limit (8 / 15 min / IP, in-memory), `requireAdminAuth` on session + dashboard.

---

## 3. Frontend — Feature-Sliced Design (FSD-light)

```
frontend/src/
  app/        Router, providers, global styles (`App.tsx` routes).
  pages/      Landing, booking, booking-access, confirmation, class-room,
              cancel-booking-link, admin-login, admin-dashboard.
  widgets/    BookingFormWidget, DashboardWidget.
  features/   book-slot, view-availability, view-booking, cancel-booking,
              view-dashboard, admin-auth.
  entities/   booking, slot, mentor UI/data primitives (class phase helpers).
  shared/     UI kit, API base (`VITE_API_URL`, `credentials: 'include'`),
              timezone labels, classroom path helpers.
```

**Import rule:** `app` / `pages` → `widgets` → `features` → `entities` → `shared`. No upward imports (e.g. features must not import pages).

**Routes**

| Path | Page |
|------|------|
| `/` | Landing (Admin Dashboard + Book CTA; 2-hour lead-time sentence) |
| `/book` | Booking form (no admin link) |
| `/b/:accessToken` | Secure booking access (skeleton while loading) |
| `/confirmation/:id` | Legacy URL. Does not fetch by booking id. Details are `/b/:accessToken`. |
| `/class/:id` | Demo classroom; optional `?access=` validation vs booking id |
| `/cancel/:bookingId` | Email cancel link; token query param, whitespace stripped |
| `/admin/login` | Admin login form |
| `/admin` | Dashboard; unauthenticated → `Navigate` to `/admin/login` |

---

## 4. Database (Prisma / PostgreSQL)

Tables: **`mentors`**, **`mentor_shifts`**, **`bookings`**, **`idempotency_keys`**.
No hold table. No cron. No session table (admin sessions are process-local).

Migrations: `20260926_init` (including partial unique index), `20260927_booking_access_token`.

### Mentor

`id`, `name`, `email` unique, `timezone` (default `Asia/Kolkata`), `shift` (`SHIFT_1` \| `SHIFT_2`), `active`, timestamps (`timestamptz`).

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
| `meetingLink` | in-app class path (may be absolute with `FRONTEND_ORIGIN`) |

**Indexes / constraints**

- Unique `accessTokenHash`, `idempotencyKey`.
- Partial unique **`bookings_mentor_slot_confirmed_unique`** on `(mentorId, startTimeUtc) WHERE status = 'CONFIRMED'` (raw SQL in `20260926_init`). CANCELLED rows are not in the index, so the same mentor+start can be rebooked after cancel.
- Indexes on `(mentorId, startTimeUtc)`, `(mentorId, mentorLocalDate, status)`, `status`.

Prisma schema comments document the partial unique index; Prisma does not express the `WHERE` clause in `schema.prisma` itself.

### IdempotencyKey

`key` unique, `payloadHash` (SHA-256 of canonical JSON), `responseJson`, `bookingId` unique. No TTL job.

---

## 5. Transactions and concurrency

`PrismaUnitOfWork.run` uses **Serializable** isolation (not Read Committed).

1. Optional pre-tx idempotency lookup.
2. Inside tx: eligible mentors, least-loaded first. Insert uses `SAVEPOINT booking_mentor_insert`. A confirmed-slot unique violation (`P2002` on that index) rolls back to the savepoint and tries the next eligible mentor. Then the idempotency row is inserted.
3. After commit: emails.

`P2034` (serialization failure) retries the whole transaction up to **3** times. Other `P2002` conflicts (idempotency key, access token) are not treated as “try the next mentor.” Cancel uses `SELECT … FOR UPDATE` on the booking row.

`findEligibleMentors` does **not** issue `SELECT FOR UPDATE` on mentor rows; safety is isolation + unique index.

Automated `P2034` tests inject a throwing UnitOfWork. They are **not** a live multi-connection PostgreSQL soak test.

---

## 6. Timezone (Luxon)

All persisted instants are UTC. `TimezoneService.toUtc` / `toLocal` / `validateTimezone` / `now` wrap Luxon. Ambiguous and nonexistent local times throw domain errors (HTTP 400). Daily cap uses precomputed `mentorLocalDate`, not a SQL `AT TIME ZONE` expression at read time.

Frontend display uses `Intl` in the parent/mentor IANA zones. Availability date is browser-local calendar date.

---

## 7. Email (production)

```
NODE_ENV === 'test'  → MockEmailService
otherwise            → createEmailService() → ResendEmailService
```

Missing API key or from-address: log failure, return without throwing.

`EmailService`: `sendBookingConfirmation` (html + text), `sendBookingCancellation` (text), `sendMentorBookingNotification` (text).

---

## 8. Admin security (implemented)

- Credentials: `ADMIN_USERNAME`, `ADMIN_PASSWORD` from the server environment only.
- Signing secret: `ADMIN_SESSION_SECRET` from the server environment only. Never in the frontend or README **value**.
- Cookie name: `cy_admin_session`. `httpOnly`, `path: /`, max-age 8 hours. Production (`NODE_ENV === 'production'`): `secure: true`, `sameSite: 'none'`. Local: `sameSite: 'lax'`, `secure: false`.
- Token: base64url JSON `{ exp }` + HMAC-SHA256 (base64url). Verify uses `timingSafeEqual` and requires membership in a process-local `Set`.
- Logout: `revoke` removes from the Set + `clearCookie`.
- CORS: `credentials: true`; browser `fetch` uses `credentials: 'include'`.
- No admin password in localStorage.

**Limitation:** the live token `Set` is not shared across Render instances or surviving restarts. Redis is intentionally not used.

---

## 9. Error envelope

`{ "code", "message" }` plus optional `alternateSlots`. See [API.md](API.md) for status codes (e.g. `SLOT_NOT_AVAILABLE` not `SLOT_UNAVAILABLE`; cancel token `401`; idempotency conflict `400`; admin `401` / `429`).

---

## 10. Frontend availability and access UX (implemented)

- `useAvailability`: abort previous GET when date/timezone changes; ignore stale completions.
- Slot grouping: `groupSlots.ts` day parts (morning 05–12, afternoon 12–17, evening 17–21, night otherwise).
- `useNextAvailableDate` when the loaded day has no selectable slot.
- Slot conflict: clear selection, refetch, copy from `useBookSlot` (`SLOT_NOT_AVAILABLE`).
- `useBookingAccess`: abort on unmount/token change; immediate loading skeleton; safe error copy (does not assert booking existence).
- Join Class from details: `/class/:id` + router state (`accessToken`, `classSummary`) — no second access POST.
- Email Join: `?access=` triggers `POST /booking-access`; mismatch of booking id vs token → same invalid-link message.

---

## 11. Testing (verified counts)

| Suite | Result |
|-------|--------|
| Backend `npm test` (Vitest) | **263** passed, **19** files |
| Frontend `npm test` (Node `--test`) | **71** passed |

Coverage includes (not every test is a live DB test): booking correctness, timezone/DST, lead time, shift boundaries, daily cap, cancellation (including after start), idempotency, mocked concurrency/`P2034`, unique-index helper, API routes, admin auth routes, booking access, email HTML/text, frontend lifecycle/Join/cancel/admin redirect, landing 2-hour copy.

Prisma repository tests in this repo use **mocked** Prisma clients.

TypeScript: backend `npm run build` (`tsc`); frontend `npm run build` (`tsc -b && vite build`). Frontend lint: `oxlint`. Prisma: `npm run db:generate` / migrate scripts as in README.

---

## 12. Deployment (from repo config)

**Frontend (Vercel)**

- Root: `frontend`
- Build: `npm run build`
- Output: `dist`
- SPA rewrite: `frontend/vercel.json` → `index.html`
- Env: `VITE_API_URL` (public API `/api` prefix)

**Backend (Render)**

- Root: `backend`
- Build: `npm install && npm run db:generate && npm run build`
- Start: `npm start` (`node dist/index.js`)
- Env: `DATABASE_URL`, `FRONTEND_ORIGIN`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `NODE_ENV`, `PORT` as provided by the host

**Database:** Neon PostgreSQL. Apply migrations with `prisma migrate deploy` in the backend deploy pipeline as configured on Render.

This document does not assert a live production probe.

---

## 13. Architecture decisions (assignment-focused)

| Choice | Why |
|--------|-----|
| PostgreSQL | Relational integrity, `timestamptz`, partial unique indexes, SERIALIZABLE SSI for cap races |
| Prisma | Typed access, migrations, composition-root repositories without leaking SQL into domain |
| Layered Clean Architecture | Booking rules stay testable without Express/Prisma; assignment-sized, not a distributed system |
| FSD-light frontend | Route pages compose features; no “pages importing pages” |
| Luxon | IANA + DST (ambiguous / nonexistent local times) in one backend clock |
| UTC storage + browser TZ display | One source of truth for instants; parents see local wall time without a dropdown |
| SERIALIZABLE + unique CONFIRMED slot + savepoints | Correct mentor assignment under concurrency without Redis locks |
| Idempotency keys | Safe retries of `POST /api/bookings` |
| SHA-256 access / bcrypt cancel hashes | Details and cancel are not “guess the UUID” |
| HTTP-only cookie admin | Credentials stay off the SPA bundle; CORS credentials for Vercel→Render |
| No Redis/Kafka/microservices | Out of assignment scope; process-local admin sessions are an accepted limitation |
