# CodeYoung Trial Class Booking System

A parent can book a free **1-hour trial class** without creating an account. They pick a time in their own timezone; the API assigns a mentor, confirms the booking immediately, and emails both the parent and the mentor.

The hard part is not the form — it is keeping **10 mentors** (two IST shifts, a 2-hour lead time, and a cap of **2 confirmed classes per mentor per local day**) from being double-booked when several people hit the same hour. Slots are stored in UTC; Luxon handles DST; PostgreSQL serializable transactions plus a partial unique index back that up.

There is no login, no payment, and no “hold this mentor for a few minutes” step. Submit either creates a **CONFIRMED** booking or the slot is gone.

## Live demo

**Website:** [https://codeyoung-trail-booking.vercel.app/](https://codeyoung-trail-booking.vercel.app/)

| Piece | Host |
|-------|------|
| Frontend | Vercel |
| Backend | Render |
| Database | Neon PostgreSQL |
| Email | Resend |

The UI talks to `https://codeyoung-trail-booking.onrender.com/api` (see `frontend/.env.example`).

## Features

- Trial booking: name, email, child, date, 1-hour slot
- Availability in the **browser’s IANA timezone** (not a timezone dropdown)
- Slots grouped Morning / Afternoon / Evening / Night; available / full / blocked / selected
- Loading state and aborted/stale availability requests when the date changes
- **10 mentors**: 5 on Shift 1 (09:00–21:00 IST), 5 on overnight Shift 2 (21:00–09:00 IST)
- Least-loaded eligible mentor; the full hour must fit the shift
- **2-hour** minimum lead time; **2 CONFIRMED** classes max per mentor-local day
- Cancelled bookings do not count toward the cap and free the slot
- Idempotent `POST /api/bookings` (`Idempotency-Key`)
- Concurrent last-slot / last-cap races return `SLOT_NOT_AVAILABLE` plus up to 3 later hours
- Next available date (searches **30** parent-local days after the selected day)
- Secure booking page `/b/:accessToken` (booking id in the URL is not enough)
- Cancel before start with a one-time token (hashed at rest)
- Parent confirmation email + mentor notification (Resend); email failure does not undo the booking
- In-app demo classroom (`/class/:bookingId`) — not Zoom/Meet
- Read-only admin page at `/admin` (no auth in this version)
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
| Testing | Vitest (backend), Node’s test runner (frontend) |

There is **no** root `package.json`. Work in `backend/` or `frontend/`.

## Project structure

```
codeyoung-trail-booking/
  backend/     API, Prisma, tests
  frontend/    Vite app
  docs/        PRD, TRD, API, edge cases
  .env.example Backend env template (copy into backend/.env)
```

**Backend** is Clean Architecture so booking rules stay out of Express and Prisma:

- `domain` — entities and rules only (no framework imports)
- `application` — use cases + ports
- `infrastructure` — Prisma, Luxon, Resend, composition root (`src/infrastructure/index.ts`)
- `interfaces` — HTTP routes, Zod, error mapping

**Frontend** is Feature-Sliced Design so pages stay thin:

- `app` — router and global setup
- `pages` — screens
- `widgets` — booking form
- `features` — book, availability, cancel, dashboard
- `entities` / `shared` — booking/slot bits, API client, UI kit

A layer only imports from layers below it. More detail: [docs/TRD.md](docs/TRD.md).

## Prerequisites

- **Git**
- **Node.js** and **npm** (no `engines` field in package.json; use a current Node 20+ LTS if you can)
- A **PostgreSQL** database — local or hosted (Neon is what production uses). You only need a `DATABASE_URL`; you do not have to install Postgres on your machine if the URL points at Neon or similar.

Resend keys are optional for clicking through the UI. Without `RESEND_API_KEY` / `EMAIL_FROM`, bookings still save; sends are skipped or logged as failures.

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
- For real email: `RESEND_API_KEY` and `EMAIL_FROM=CodeYoung Trial Booking <bookings@dandeliinn.com>` (never commit a real key).
- `FRONTEND_ORIGIN` is optional locally. Vite on 5173/5174 is already allowed.

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

Book at `/book`. Admin at `/admin`. After a successful book, the app goes to `/b/:accessToken`.

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

## Environment variables (short)

| Name | Where | Used for |
|------|--------|----------|
| `DATABASE_URL` | backend | Prisma |
| `PORT` | backend | API port (default 3000) |
| `NODE_ENV` | backend | `test` → mock email; otherwise Resend |
| `FRONTEND_ORIGIN` / `FRONTEND_ORIGINS` | backend | Extra CORS origins; first origin also prefixes Join Class links |
| `RESEND_API_KEY` / `EMAIL_FROM` | backend | Production mail |
| `VITE_API_URL` | frontend **build** | Must be the public API `/api` URL on Vercel; not needed for local `npm run dev` |

Do not put database or Resend secrets in `VITE_*` variables.

Lead time (2 hours), daily cap (2), and “3 alternates in the next 12 hours” are **hardcoded**. Names like `BOOKING_LEAD_TIME_HOURS` in older notes are not read.

## How booking behaves (for reviewers)

- Times in the DB are UTC (`timestamptz`). Parents see their local clock; mentors are IST in seed data.
- Cancel only **before** start, with the token from the create response / parent email. Repeat cancel with a valid token returns `alreadyCancelled: true`.
- `GET /api/bookings/:id` always 404s on purpose. Open a booking at `/b/:accessToken`. `/confirmation/:id` does not load a booking; it points people back to that secure link.
- Same `Idempotency-Key` + same body returns the original booking (HTTP 201). Same key + different body → `IDEMPOTENCY_CONFLICT`.
- If the least-loaded mentor loses the confirmed-slot unique index, booking tries the next eligible mentor in the same transaction. A serialization failure (`P2034`) retries the whole transaction up to 3 times. The request fails with `SLOT_NOT_AVAILABLE` only when no eligible mentor remains.

HTTP details: [docs/API.md](docs/API.md).

## Docs

- [PRD](docs/PRD.md) — product
- [TRD](docs/TRD.md) — architecture
- [API](docs/API.md) — routes
- [Edge cases](docs/EDGE_CASES.md)

## What this is not

No accounts, payments, or real video. Admin `/admin` is open. Emails need Resend in a non-test `NODE_ENV`. Nodemailer is still a dependency but is not what production uses.
