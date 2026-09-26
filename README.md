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
