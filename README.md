# CodeYoung Trial Class Booking System

## Architecture

### Backend: Clean Architecture
- **domain**: Pure business logic (entities, values, rules). No external dependencies.
- **application**: Use cases coordinating the domain logic, using interfaces for external services (ports).
- **infrastructure**: Concrete implementations for the application ports (Prisma, Luxon, etc.).
- **interfaces**: Express routes, controllers, and middlewares. HTTP layer only.

### Frontend: Feature-Sliced Design (FSD)
- **app**: Global setup (router, providers, styles).
- **pages**: Route components aggregating widgets.
- **widgets**: Composite UI blocks combining features/entities.
- **features**: Specific user actions (e.g., book-slot).
- **entities**: Domain objects and their basic UI.
- **shared**: Reusable utilities, UI kit, and types.

## Tech Stack
- Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, Zod.
- Backend: Node.js, Express, TypeScript, Prisma, Zod, Luxon.
- Database: PostgreSQL.

## Core Rules
- 1 hour class duration.
- 10 mentors (5 on Shift 1, 5 on Shift 2).
- UTC timezone storage, Luxon for timezone calculations.
- Concurrency-safe booking.

## Getting Started

1. Install dependencies in both `backend` and `frontend`.
2. Configure `.env` in `backend`.
3. Run `npm run start` or `npm run build` from the respective directories, or use the root workspace scripts.

## Production frontend (Vercel)

The Vite app reads `VITE_API_URL` at **build** time (`frontend/src/shared/api/base.ts`). Locally it defaults to `/api` and uses the Vite proxy to `http://localhost:3000`.

On Vercel set:

```
VITE_API_URL=https://codeyoung-trail-booking.onrender.com/api
```

See `frontend/.env.example`. Do not put `DATABASE_URL` or other backend secrets in any `VITE_*` variable.

On Render, optionally set `FRONTEND_ORIGIN` to the exact Vercel production URL (and any custom domain) so CORS allows that origin. `https://*.vercel.app` preview hosts are already allowed. Local Vite origins (`localhost` / `127.0.0.1` ports 5173–5174) are always allowed.
