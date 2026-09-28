# CodeYoung Trial Class Booking System

A parent can book a free **1-hour trial class** without creating an account. They pick a time in their own timezone; the API assigns a mentor, confirms the booking immediately, and emails both the parent and the mentor.

The hard part is not the form — it is keeping **10 mentors** (two IST shifts, a 2-hour lead time, and a cap of **2 confirmed classes per mentor per local day**) from being double-booked when several people hit the same hour. Slots are stored in UTC; Luxon handles DST; PostgreSQL **SERIALIZABLE** transactions plus a **partial unique index** on CONFIRMED mentor-slot pairs back that up.

There is no parent login, no payment, and no HOLD/reservation step. Submit either creates a **CONFIRMED** booking or the slot is gone.

This is a **monolithic layered** API (`domain` / `application` / `infrastructure` / `interfaces`) plus a React frontend. It is not microservices, not event-driven, and does not use Redis, Kafka, or WebSockets.

## Live demo

**Website:** [https://codeyoung-trail-booking.vercel.app/](https://codeyoung-trail-booking.vercel.app/)

| Piece | Host |
|-------|------|
| Frontend | Vercel (root: `frontend`, build: `npm run build`, output: `dist`) |
| Backend | Render (root: `backend`) |
| Database | Neon PostgreSQL |
| Email | Resend |

The production UI talks to `https://codeyoung-trail-booking.onrender.com/api` (set as `VITE_API_URL` at Vercel build time).

## Admin Dashboard Access

The project includes a protected admin dashboard for assignment evaluation/demo purposes.

**Admin Dashboard:** https://codeyoung-trail-booking.vercel.app/admin

**Demo Credentials:**
- Username: `codeyoung`
- Password: `codeyoung`

These credentials are provided specifically for assignment evaluation/demo purposes.

This is an intentionally shared demo account for the evaluator. The credentials must **not** be stored in the frontend bundle or source code. Authentication is handled by the backend using environment-backed credentials and HTTP-only sessions.

Unauthenticated visits to `/admin` redirect to `/admin/login`. After login, the dashboard is read-only.

## Features

- Trial booking: parent name, email, child name, date, 1-hour slot
- Availability in the **browser’s IANA timezone** (not a timezone dropdown)
- Booking date is the parent-local calendar day from that timezone
- Slots grouped Morning / Afternoon / Evening / Night; available / full / blocked / selected
- Loading chrome and aborted/stale availability requests when the date changes (`AbortController`)
- Selected slot is cleared when the date changes
- **10 mentors**: 5 on Shift 1 (09:00–21:00 IST), 5 on overnight Shift 2 (21:00–09:00 IST)
- Least-loaded eligible mentor; the full hour must fit the shift
- **2-hour** minimum lead time (`meetsLeadTime`: slot start ≥ now + 2 hours). Hours that fail this rule are **blocked**, not a bug
- **2 CONFIRMED** classes max per mentor-local calendar day
- Cancelled bookings do not count toward the cap and free the slot
- Idempotent `POST /api/bookings` (`Idempotency-Key`)
- Concurrent last-slot / last-cap races: SERIALIZABLE + unique CONFIRMED slot index + savepoint retry of the next eligible mentor; `P2034` retries the whole transaction up to 3 times
- Concurrent last-slot / last-cap failures return `SLOT_NOT_AVAILABLE` plus up to 3 later hours
- Next available date (searches **30** parent-local days after the selected day)
- Secure booking page `/b/:accessToken` (booking id in the URL is not enough)
- Immediate skeleton/loading chrome on View Booking
- Cancel before start with a one-time token (bcrypt-hashed at rest); rejected at **exact** class start (`now >= startTimeUtc`)
- Parent confirmation email (HTML + plain text) with **Join Class**, **View Booking**, and **Cancel Booking** actions; mentor notification (plain text, no secrets)
- In-app demo classroom (`/class/:bookingId`) — not Zoom/Meet
- Class lifecycle UI: upcoming / live / completed (exact end time is completed)
- Protected admin dashboard at `/admin` (HTTP-only cookie session)
- Landing page links to Admin Dashboard; `/book` does not
- Responsive layout

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, React Router 6, React Hook Form, Zod |
| Backend | Node.js, Express 5, TypeScript, Zod, Luxon, bcrypt |
| Database | PostgreSQL |
| ORM | Prisma 5 |
| Email | Resend (`MockEmailService` when `NODE_ENV=test`) |
| Hosting | Vercel (UI) + Render (API) |
| Testing | Vitest (backend), Node’s test runner (frontend `.mjs`) |

There is **no** root `package.json`. Work in `backend/` or `frontend/`.

## Project structure

```
codeyoung-trail-booking/
  backend/     API, Prisma, tests
  frontend/    Vite app
  docs/        PRD, TRD, API, edge cases
  TRANSCRIPT.md  Prompt 0–13 records (reconstructed where needed)
  .env.example Backend env template (copy into backend/.env)
```

**Backend** is Clean Architecture so booking rules stay out of Express and Prisma:

- `domain` — entities and rules only (no framework imports)
- `application` — use cases + ports
- `infrastructure` — Prisma, Luxon, Resend, HMAC admin sessions, composition root (`src/infrastructure/index.ts`)
- `interfaces` — HTTP routes, Zod, error mapping

**Frontend** is Feature-Sliced Design at assignment scale (FSD-light): pages stay thin; features own user actions.

- `app` — router and global setup
- `pages` — screens
- `widgets` — booking form, admin dashboard
- `features` — book, availability, cancel, booking access, admin auth, dashboard
- `entities` / `shared` — booking/slot bits, API client (`credentials: 'include'`), UI kit

A layer only imports from layers below it. More detail: [docs/TRD.md](docs/TRD.md).

## Prerequisites

- **Git**
- **Node.js** and **npm** (no `engines` field in package.json; use a current Node 20+ LTS if you can)
- A **PostgreSQL** database — local or hosted (Neon is what production uses). You only need a `DATABASE_URL`; you do not have to install Postgres on your machine if the URL points at Neon or similar.

Resend keys are optional for clicking through the UI. Without `RESEND_API_KEY` / `EMAIL_FROM`, bookings still save; sends are skipped or logged as failures.

Local admin login also requires `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in `backend/.env` (never commit real values).

## Running the project locally

### 1. Clone the repository

```bash
git clone https://github.com/sayedshoaibahmed/codeyoung-trail-booking.git
cd codeyoung-trail-booking
```

### 2. Backend — install and env

```bash
cd backend
npm install
cp ../.env.example .env
```

On Windows PowerShell: `Copy-Item ..\.env.example .env`

Edit `backend/.env`:

- Set `DATABASE_URL` to your Postgres URL (local or Neon).
- Leave `PORT=3000` unless that port is taken.
- For real email: `RESEND_API_KEY` and `EMAIL_FROM` (never commit a real key).
- `FRONTEND_ORIGIN` is optional locally. Vite on 5173/5174 is already allowed.
- For `/admin` locally: set `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and a long random `ADMIN_SESSION_SECRET`.

### 3. Database — generate, migrate, seed

From `backend/`:

```bash
npx prisma generate
npm run db:migrate
npm run db:seed
```

`db:migrate` is `prisma migrate dev` (creates/applies migrations locally). Against an already-migrated remote DB you can use `npm run db:migrate:deploy` instead.

Seed creates the **10** mentors (5 per shift). Safe to run more than once.

### 4. Start the API

Still in `backend/`:

```bash
npm run dev
```

You should see it listen on port **3000**. `GET http://localhost:3000/` returns `{ "status": "ok", ... }`.

### 5. Frontend — install and start

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Leave `VITE_API_URL` unset. Vite proxies `/api` to `http://localhost:3000`. Open the URL Vite prints (usually `http://localhost:5173`).

Book at `/book`. Admin at `/admin` (login first). After a successful book, the app goes to `/b/:accessToken`.

### 6. Tests and production-style builds

```bash
# backend/
npm test
npm run build
npm start          # needs dist/ from build; uses PORT from env

# frontend/
npm test
npm run lint
npm run build
```

**Current verified suite (this documentation pass):** backend **263** tests (19 files, Vitest); frontend **71** tests (Node `--test`). Concurrency/`P2034` cases are **mocked UnitOfWork / Prisma** tests, not a live PostgreSQL stress harness.

## Environment variables (names only — never put real secrets in Git or this README)

| Name | Where | Used for |
|------|--------|----------|
| `DATABASE_URL` | Render / local backend | Prisma |
| `PORT` | Render / local backend | API port (default 3000) |
| `NODE_ENV` | Render / local backend | `test` → mock email; `production` → Secure + SameSite=None admin cookie |
| `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS` | Render | Extra CORS origins; first origin prefixes Join Class / email links |
| `RESEND_API_KEY` / `EMAIL_FROM` | Render | Production mail |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Render | Server-side admin login (not in the frontend) |
| `ADMIN_SESSION_SECRET` | Render | HMAC-SHA256 signing of the admin session cookie (not documented as a value) |
| `VITE_API_URL` | **Vercel** build | Public API `/api` URL |

Do not put database, Resend, or admin secrets in `VITE_*` variables. Do not commit production secret values.

Lead time (2 hours), daily cap (2), and “3 alternates in the next 12 hours” are **hardcoded**. Names like `BOOKING_LEAD_TIME_HOURS` in older notes are not read.

## How booking behaves (for reviewers)

- Times in the DB are UTC (`timestamptz`). Parents see their local clock; mentors are IST in seed data.
- **Lead time example (not a bug):** at 10:47 IST, 11:00 and 12:00 are blocked; 13:00 is the first hour that can be eligible.
- Cancel only **before** start (`now < startTimeUtc`). At exact start, cancellation is rejected (`409 CANCELLATION_AFTER_START`). Repeat cancel with a valid token returns `alreadyCancelled: true`.
- Pasted cancellation tokens have whitespace stripped before submit; bcrypt comparison is unchanged.
- `GET /api/bookings/:id` always 404s on purpose. Open a booking at `/b/:accessToken`. `/confirmation/:id` does not load a booking; it points people back to that secure link.
- Same `Idempotency-Key` + same body returns the original booking (HTTP 201). Same key + different body → `IDEMPOTENCY_CONFLICT`.
- If the least-loaded mentor loses the confirmed-slot unique index, booking rolls back to a PostgreSQL savepoint and tries the next eligible mentor in the same transaction. A serialization failure (`P2034`) retries the whole transaction up to 3 times. The request fails with `SLOT_NOT_AVAILABLE` only when no eligible mentor remains.

HTTP details: [docs/API.md](docs/API.md).

## Class lifecycle (UI)

Compared on stored UTC instants:

| Phase | When | Join Class | Cancel |
|-------|------|------------|--------|
| Upcoming | `now < start` | Shown (CONFIRMED) | Shown |
| Live | `start <= now < end` | Shown | Hidden; copy explains the class has started |
| Completed | `now >= end` | Hidden | Hidden |

Exact end time is **completed**. Copy: **Class Completed** / **This class has already ended.** Booking details remain accessible via the access token. Backend cancellation is independent of the UI and still uses the start-time cutoff.

Email **Join Class** uses `/class/:bookingId?access=<accessToken>`; the classroom validates that token against the booking id. In-app Join from View Booking uses router state (no extra access POST). Admin dashboard **Join Room** uses `/class/:id` without an access token (demo classroom).

## Docs

- [PRD](docs/PRD.md) — product
- [TRD](docs/TRD.md) — architecture
- [API](docs/API.md) — routes
- [Edge cases](docs/EDGE_CASES.md)
- [TRANSCRIPT](TRANSCRIPT.md) — Prompt 0–13 plus later product updates

## What this is not (limitations)

- No parent/mentor user accounts, payments, password reset, MFA, or RBAC
- No real video conferencing (demo classroom only)
- No HOLD / reservation state
- No WebSockets or real-time availability push
- No Redis, Kafka, event bus, or microservices (intentionally)
- Admin is a **single shared demo account**; session registry is **process-local** (a Render restart invalidates cookies)
- Email delivery depends on Resend configuration
- Business rules (lead time, cap, alternates) are hardcoded
- Nodemailer is still a dependency but is **not** wired in the composition root
