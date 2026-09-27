# CODEYOUNG TRIAL CLASS BOOKING SYSTEM

## AI-Assisted Development Transcript & Implementation Record

This document keeps the development prompts and the important implementation results in a submission-focused format. The prompt text is retained from the project prompt record; implementation results summarize verified project state, tests, documentation, and Git history.

### Project Overview

The system lets a parent book a free **one-hour trial class** without an account. It uses 10 mentors across two IST shifts, UTC/timestamptz persistence, Luxon for timezone/DST handling, a two-hour minimum lead time, a maximum of two confirmed classes per mentor-local calendar day, secure cancellation, idempotency, and concurrency protection. The frontend uses React/FSD-style boundaries and the backend uses layered/Clean Architecture boundaries.

**Stack:** React, Vite, TypeScript, Tailwind, Express, Prisma, PostgreSQL, Zod, Luxon, Resend.

---

# Prompt 0 – Project Setup & Conventions

## User / Development Prompt

Prompt 0 — Skill Setup
Part: PRE-SETUP

Before starting the CodeYoung Trial Class Booking System, set up the development skills/conventions specified for this project.

Do NOT build the application yet.

1. CLEAN CODE SKILL

Install:
npx skills add btseee/clean-code-skills --skill clean-code --agent cursor

Use it for small functions, single responsibility, clear naming, low duplication, separation of concerns, maintainability and proper error handling.

2. FEATURE-SLICED SKILL

Install:
npx skills add feature-sliced/skills --agent cursor

Use Feature-Sliced Design LIGHTLY. This project is intentionally small. Prefer:

frontend/src/pages
frontend/src/components
frontend/src/hooks
frontend/src/services
frontend/src/types
frontend/src/utils

Backend should use a simple layered structure:

backend/src/controllers
backend/src/services
backend/src/repositories
backend/src/routes
backend/src/middleware
backend/src/utils
backend/src/types
backend/src/config

Do NOT introduce full enterprise Clean Architecture.

Do not introduce unnecessary microservices, Redis, Kafka, Kubernetes, event buses or WebSockets.

After installation:
1. Verify both skills succeeded.
2. Inspect generated rule/skill files.
3. Explain what rules were added.
4. Do not create the database.
5. Do not implement features.

Stop after skill setup is complete.

## Implementation Result

Development conventions were established before implementation. Clean-code practices and Feature-Sliced/layered boundaries were adopted for the project. No application features or database work were performed in this phase.

---

# Prompt 1 – Project Foundation

## User / Development Prompt

Prompt 1 — Project Setup + Foundation
Part: PROJECT FOUNDATION

Set up the CodeYoung Trial Class Booking System project foundation.

Inspect the repo first, confirm branch/state, and use a dedicated feature branch. Do not overwrite unrelated work.

STACK

Frontend: React, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form, Zod.
Backend: Node.js, Express, TypeScript, Prisma, Zod, Luxon.
Database: PostgreSQL.

Use lightweight frontend and layered backend structures.

CORE RULES

- Class duration: 1 hour.
- 10 mentors: 5 on Shift 1 (09:00–21:00 IST), 5 on Shift 2 (21:00–09:00 IST).
- No shift gap/overlap.
- Complete 1-hour interval must fit inside a shift.
- Store booking timestamps in UTC using PostgreSQL timestamptz.
- Use Luxon for timezone/DST.
- Minimum lead time: 2 hours.
- Maximum 2 CONFIRMED classes per mentor-local calendar day.
- CANCELLED bookings do not count toward the cap.
- Cancellation is supported before class start and must use a secure credential.
- Cancellation is idempotent.
- Booking must be concurrency-safe.

Initial task only:
- Set up repo/project structure.
- Install dependencies.
- Configure TypeScript and Tailwind.
- Configure Prisma.
- Add .env.example.
- Add README scaffold.
- Add start/build scripts.
- Verify the project starts/builds.

Do not implement full UI, booking logic or database schema yet.

## Implementation Result

The monorepo foundation was created with separate `frontend/` and `backend/` packages, TypeScript, Tailwind, Prisma, environment templates, scripts, and build configuration. The project was kept as a single deployable application rather than split into services.

---

# Prompt 2 – PRD / TRD / Edge Cases

## User / Development Prompt

Prompt 2 — PRD + TRD + Edge Cases
Part: PLANNING / DOCUMENTATION

Create:
- docs/PRD.md
- docs/TRD.md
- docs/EDGE_CASES.md

PRD: document the parent booking journey, free 1-hour trial class, parent/mentor timezones, DST, 10 mentors, Shift 1 (09:00–21:00 IST, 5 mentors), Shift 2 (21:00–09:00 IST, 5 mentors), max 2 confirmed classes per mentor-local day, no double booking, least-loaded mentor assignment, alternate slots, dummy meeting link, email/mock email, read-only admin dashboard, and cancellation before class start with secure credential, idempotency, released capacity and slot.

TRD: document React/Vite/TypeScript, Node/Express/TypeScript, PostgreSQL + Prisma, Zod, Luxon, API contracts, data model, transaction/locking strategy, idempotency, error format and cancellation flow.

EDGE_CASES: same-slot contention, double-click/retry, reused idempotency key with changed payload, daily-cap race, no mentor, shift boundaries, overnight shift, midnight crossing, DST ambiguous/nonexistent times, half-hour offsets, past times, lead-time violation, cancellation/repeated cancellation/after-start cancellation, email failure and database failure.

Do not invent extra product features. Document ambiguities explicitly. Stop after documentation is checked.

## Implementation Result

PRD, TRD, and edge-case documentation were created and used as the implementation reference. The key booking rules, timezone behavior, concurrency expectations, cancellation flow, idempotency, and error contracts were documented before feature implementation.

---

# Prompt 3 – PostgreSQL & Prisma

## User / Development Prompt

Prompt 3 — PostgreSQL + Prisma
Part: BACKEND + DATABASE

Implement the PostgreSQL + Prisma database layer.

Create models:
1. Mentor
2. MentorShift (or equivalent availability model)
3. Booking
4. IdempotencyKey

Mentor: id, name, email, timezone, active, createdAt, updatedAt.

MentorShift: mentor relation, day of week, local start time, local end time, active, and support for overnight 21:00–09:00.

Booking: id, parent name/email, parent timezone, mentor relation, startTimeUtc, endTimeUtc, mentor timezone, mentor local date, meeting link, status, cancellation token hash/secure representation, cancelledAt, createdAt, updatedAt.

Statuses: CONFIRMED, CANCELLED.

IdempotencyKey: unique key plus booking/result reference needed to safely return the original result.

Use timestamptz-compatible DateTime storage. Do not create a naive unique constraint that permanently blocks rebooking a cancelled slot. Cancelled bookings must release slot and capacity.

Create proper Prisma migrations.

Seed exactly 10 mentors idempotently:
- 5 assigned to Shift 1: 09:00–21:00 IST
- 5 assigned to Shift 2: 21:00–09:00 IST

Add .env.example. Run migration and seed checks. Do not implement the full booking service yet.

## Implementation Result

PostgreSQL + Prisma persistence was implemented with Mentor, MentorShift, Booking, and IdempotencyKey models. A partial unique index protects confirmed mentor/slot collisions while allowing cancelled slots to be rebooked. Seed data creates exactly 10 mentors: 5 on Shift 1 and 5 on overnight Shift 2.

---

# Prompt 4 – Timezone & Availability

## User / Development Prompt

Prompt 4 — Timezone + Availability
Part: BACKEND — TIMEZONE & AVAILABILITY

Implement timezone and availability using Luxon only for timezone conversion/DST calculations.

Requirements:
- Validate IANA timezones.
- Convert parent local requested time to UTC.
- Convert UTC interval into each mentor timezone.
- Validate the COMPLETE 1-hour interval against the mentor shift.
- Correctly handle overnight 21:00–09:00 shifts.
- Determine mentor-local calendar date from class start.
- Never manually add/subtract offsets.
- Handle DST ambiguous/nonexistent times safely.
- Support non-whole-hour timezone offsets.

Availability:
- 1-hour slots.
- Minimum 2-hour lead time.
- Slot must fit entirely inside a shift.
- CANCELLED bookings do not block availability.
- CONFIRMED bookings block overlapping intervals.
- Max 2 confirmed classes per mentor-local day.

Implement GET /api/availability?date=&timezone=.

Add focused tests for US DST, UK DST, India, overnight shifts, boundaries, 1-hour duration, mentor-local date and lead time. Do not implement final booking assignment yet.

## Implementation Result

Luxon-based timezone/DST handling and availability were implemented. Availability validates the complete one-hour interval, supports the overnight shift, applies the two-hour lead time, ignores cancelled bookings, and calculates mentor-local dates for the daily cap. Later optimization batched availability queries without changing the business rules.

---

# Prompt 5 – Booking Engine & Mentor Assignment

## User / Development Prompt

Prompt 5 — Booking Transaction + Mentor Assignment
Part: BACKEND — BOOKING ENGINE

Implement the core booking service with transaction and concurrency safety.

Validate with Zod, timezone, local date/time, convert to UTC with Luxon, enforce 2-hour lead time and exactly 1-hour duration.

Idempotency:
- Same key + same payload => original result.
- Same key + materially different payload => conflict.

Inside ONE database transaction:
- Find candidate active mentors.
- Lock relevant mentor/booking rows as needed.
- Convert requested UTC interval to mentor local time.
- Validate the full interval against shift.
- Determine mentor-local date.
- Count only CONFIRMED bookings.
- Enforce max 2 per mentor-local day.
- Check interval overlap.
- Choose least-loaded eligible mentor with deterministic tie-break.
- Create booking.
- Persist idempotency result.
- Commit.

Overlap:
ExistingStart < RequestedEnd AND ExistingEnd > RequestedStart

Protect against simultaneous same-slot bookings, simultaneous last-cap bookings and retries.

If no mentor is available, return a controlled response and alternate slots where supported.

After commit, create/use dummy meeting link and send email/mock email. Email failure must NOT roll back a successful booking.

Add tests for double booking, daily cap, concurrent last slot, idempotency, least-loaded selection and no mentor.

## Implementation Result

The booking use case was implemented with idempotency, mentor eligibility checks, daily-cap enforcement, overlap detection, deterministic least-loaded assignment, and transactional concurrency protection. No HOLD state or external locking infrastructure was introduced. Email is handled after a successful booking commit.

---

# Prompt 6 – API & Cancellation

## User / Development Prompt

Prompt 6 — API Layer + Cancellation
Part: BACKEND — API + CANCELLATION

Implement:
GET /api/availability
POST /api/bookings
GET /api/bookings/:id
POST /api/bookings/:id/cancel
GET /api/classes/:id
GET /api/admin/dashboard

Cancellation:
- Parent can cancel before class start.
- Use a secure token/credential because there is no full auth.
- Store only a secure representation/hash where appropriate.
- Only CONFIRMED bookings can transition to CANCELLED.
- Cancellation is atomic and idempotent.
- Repeated cancellation returns a controlled successful/already-cancelled result.
- Cancellation after class start is rejected.
- Record cancelledAt.
- CANCELLED bookings no longer count toward daily capacity and release the slot.

Use Zod validation and one consistent JSON error format.

Security: do not expose cancellation credentials, validate inputs and avoid leaking internal DB errors.

Use Nodemailer/Ethereal or logged mock email. Keep business logic in services and API code separated into routes/controllers. Test cancellation and API errors.

## Implementation Result

The API and cancellation flow were implemented with Zod validation, consistent errors, secure cancellation credentials, atomic/idempotent cancellation, and controlled booking access. Booking IDs alone do not expose private booking details; secure access tokens are used for the parent booking view.

---

# Prompt 7 – Parent Booking Frontend

## User / Development Prompt

Prompt 7 — Frontend Booking Flow
Part: FRONTEND — BOOKING

Implement the main frontend booking experience using React, TypeScript, React Router, Tailwind, React Hook Form and Zod.

Create:
- Booking page
- Confirmation page
- Dummy class room: /class/:id

Booking page:
- Parent information form.
- Detect/show parent timezone where practical.
- Show 1-hour available slots and explicit timezone.
- Zod validation.
- Loading, validation, no-availability and alternate-slot states.

Submit:
- Generate idempotency key.
- Disable submit while submitting.
- Handle retries safely.
- Display controlled backend errors.

Confirmation shows:
- Booking reference
- Parent name
- Mentor
- Class time in parent timezone
- Mentor-local time where useful
- Duration: 1 hour
- Meeting link
- Cancellation option

Cancellation UI:
- Cancel Class button
- Confirmation dialog
- Send secure credential/token as required
- Success/error states
- No active cancel option after cancellation

Class room is clearly a mock/demo meeting room. Keep components simple and reusable.

## Implementation Result

The React booking flow was implemented with timezone-aware slot selection, form validation, idempotent submission, confirmation, cancellation, and an in-app demo classroom. The UI displays both parent-local and mentor-local times where useful and keeps booking decisions server-authoritative.

---

# Prompt 8 – Admin Dashboard & UI

## User / Development Prompt

Prompt 8 — Admin Dashboard + UX
Part: FRONTEND — ADMIN / UX

Implement the read-only admin dashboard and polish frontend UX.

Use GET /api/admin/dashboard.

Show:
- Today's confirmed classes
- Today's cancelled classes
- Upcoming classes
- Mentor load
- Booking status
- Mentor shift
- Useful date/time information

Display exactly:
- Shift 1: 09:00–21:00 IST
- Shift 2: 21:00–09:00 IST

Do not call them day/international shifts.

UX:
- Responsive/mobile-friendly
- Clear hierarchy
- Accessible labels
- Keyboard-friendly controls
- Loading, empty, error and confirmation states
- Clear timezone display
- Clear 1-hour duration
- Clear cancellation status

Do not add unnecessary animation, complex state management or extra features.

## Implementation Result

The read-only admin dashboard was implemented with today's/upcoming bookings, mentor load, status, and shift information. Responsive and accessibility-focused UI improvements were applied without changing the booking rules.

---

# Prompt 9 – Automated Testing

## User / Development Prompt

Prompt 9 — Testing
Part: TESTING

Create and run a comprehensive booking-correctness test suite.

Test:
1. Parent timezone conversion
2. US DST
3. UK DST
4. India timezone
5. Non-whole-hour offsets
6. Exact 1-hour duration
7. Shift start boundary
8. Shift end boundary
9. Overnight 21:00–09:00
10. Midnight crossing
11. 2-hour lead time
12. Daily cap of 2 confirmed classes per mentor-local day
13. Cancelled booking not counting toward cap
14. Cancelled booking releasing slot
15. Same-slot concurrent booking
16. Concurrent last-cap position
17. Same idempotency key + same payload
18. Same idempotency key + changed payload
19. Different keys targeting same slot
20. Cancellation before start
21. Repeated cancellation
22. Cancellation after start
23. No eligible mentor
24. Email failure after booking commit
25. API validation errors

Run the full suite, fix failures without changing requirements, and report tests passed/failed, root causes and fixes.

## Implementation Result

The comprehensive backend test suite reached 180 passing tests with coverage across timezone/DST, shifts, lead time, daily cap, cancellation, idempotency, mentor assignment, no-mentor cases, email failure, and API validation. Failures found during the run were corrected without weakening requirements.

---

# Prompt 10 – Integration & Bug Fixes

## User / Development Prompt

Prompt 10 — Full Integration + Bug Fix
Part: INTEGRATION / BUG FIX

Audit the entire application: frontend, backend, Prisma/PostgreSQL, APIs, timezone logic, availability, booking transaction, mentor assignment, daily cap, cancellation, idempotency, concurrency, email/mock email, admin dashboard and documentation.

Verify the complete flow from parent opening the booking page through booking, confirmation, meeting link, cancellation, released capacity/slot and admin status.

Check specifically for:
- Type/API mismatches
- Incorrect API paths
- Timezone conversion errors
- 30-minute remnants
- Old 09:00–18:00 remnants
- Cancellation treated as out of scope
- Shift naming inconsistencies
- DB constraint problems
- Idempotency bugs
- Concurrency bugs
- Error handling inconsistencies

Do not add new product features. Fix real bugs/inconsistencies only and verify again.

## Implementation Result

The integration audit fixed seven concrete defects: complete shift-fit validation, idempotency conflict handling, mentor display, UTC/admin time formatting, browser-local date defaults, stale slot selection after date changes, and loading-state flashes. Verification reached 182 passing backend tests, with builds and lint passing.

---

# Prompt 11 – Documentation

## User / Development Prompt

Prompt 11 — Documentation Finalization
Part: DOCUMENTATION FINALIZATION

Finalize documentation based ONLY on the actual implementation.

Update:
- README.md
- docs/PRD.md
- docs/TRD.md
- docs/EDGE_CASES.md
- API documentation where applicable
- .env.example documentation

Remove outdated statements such as 30-minute classes, cancellation being out of scope and only 09:00–18:00 availability.

Document final rules:
- 1-hour classes
- Shift 1: 09:00–21:00 IST
- Shift 2: 21:00–09:00 IST
- 5 mentors per shift
- UTC storage
- Luxon timezone/DST
- 2-hour lead time
- 2 confirmed classes per mentor-local calendar day
- cancellation before class start
- secure cancellation credential
- idempotent cancellation
- transaction/concurrency strategy
- idempotency
- alternate slots/no-mentor response

README should cover overview, architecture, stack, setup, env vars, migration, seed, run/test commands, API overview, business rules, assumptions and demo flow.

Do not document features that do not exist.

## Implementation Result

README, PRD, TRD, EDGE_CASES, API documentation, frontend documentation, and `.env.example` were aligned to the implemented product. Outdated 30-minute, 09:00–18:00, and cancellation-out-of-scope statements were removed.

---

# Prompt 12 – Senior Engineering Review

## User / Development Prompt

Prompt 12 — Final Senior Code Review
Part: FINAL CODE REVIEW

Perform a final senior-engineer review.

Review:
- Booking correctness
- Timezone/DST correctness
- Overnight shift correctness
- 1-hour interval handling
- Daily-cap correctness
- Concurrency safety
- Idempotency
- Cancellation security
- Database schema/indexes
- API validation/errors
- Frontend UX/accessibility
- Separation of concerns
- Dead/duplicate code
- Environment configuration/secrets
- Build reliability
- Test coverage

Pay special attention to race conditions, transaction boundaries, state transitions, timezone assumptions, Prisma queries, rebooking cancelled slots, idempotency and cancellation credential leakage.

Make only necessary fixes. Do not rewrite architecture unnecessarily.

Run TypeScript checks, frontend build, backend build, tests and Prisma validation/generation.

Report critical issues, fixes, remaining non-critical issues and final verification status.

## Implementation Result

Senior review found and fixed two important correctness defects: mentor-collision handling now rolls back a failed mentor insert to a savepoint and tries another eligible mentor, while serialization failures retry the transaction; the confirmation page now uses secure booking access instead of the intentionally locked public-ID endpoint. Final verification reached 244 backend and 61 frontend tests.

---

# Prompt 13 – Final Verification & Submission

## User / Development Prompt

Prompt 13 — Git + Submission
Part: GIT + SUBMISSION

Prepare the project for final CodeYoung assignment submission.

Run tests, frontend/backend builds, Prisma validation, migration/seed checks and .env.example checks.

Search tracked files for secrets/API keys/passwords. Confirm no unnecessary files are committed. Confirm README, PRD, TRD, EDGE_CASES and API docs are complete and match implementation. Confirm cancellation, 1-hour booking and Shift 1/Shift 2 rules are consistent. Confirm no old 30-minute or 09:00–18:00 requirements remain.

TRANSCRIPT.md must contain the actual development conversation/prompts and important implementation decisions. Do not fabricate history.

Git:
- Inspect git status.
- Inspect git diff.
- Review staged files.
- Create a clear final commit message.
- Do NOT push automatically unless explicitly instructed.

Final report:
1. Project status
2. Tests passed
3. Builds passed
4. Database/migration status
5. Main implemented features
6. Known limitations
7. Git commit hash
8. Anything remaining before submission

Stop after final verification and commit preparation.

## Implementation Result

Final submission checks confirmed the implemented business rules, builds/tests, Prisma validation, migration/seed state, documentation consistency, and tracked-file secret scan. Implementation was finalized in commit `2055eb0`; the transcript was added separately in commit `64da4b5`.

---

# Additional Important Development Work

These were important implementation and verification activities completed alongside the numbered prompts. Minor debugging details and repetitive UI tweaks are intentionally omitted so the record stays focused on evaluation-relevant work.

## 1. 24-hour availability UX

Availability was organized into Morning, Afternoon, Evening, and Night groups with clear available/unavailable/selected states and explicit timezone context.

## 2. Production email with Resend

Parent confirmation/cancellation and mentor notification emails were integrated through a Resend adapter. Email runs after the booking transaction commits so an email failure cannot undo a successful booking.

## 3. Secure booking access

A SHA-256-hashed access token and `/b/:accessToken` flow were added; the public booking-ID endpoint remains locked to prevent unauthorized disclosure.

## 4. Demo classroom

The class flow was moved to an in-app demo classroom so the assignment does not depend on an external meeting service.

## 5. Timezone presentation

The UI and emails show parent-local and mentor-local times with explicit timezone labels while calculations continue to use IANA zones and UTC storage.

## 6. Availability reliability

Availability queries were optimized, stale requests were guarded with AbortController/request IDs, loading states were corrected, and a next-available-date endpoint was added.

## 7. Deployment

The frontend was deployed on Vercel, the API on Render, and PostgreSQL on Neon. SPA routing, CORS, production API configuration, migrations, seed data, and real booking/cancellation flows were verified.

## 8. Real database verification

The application was checked against real PostgreSQL runtime paths, including the partial confirmed-slot unique index, idempotency, secure access, mentor seed data, booking transactions, and cancellation.

## 9. UI quality

Landing-page content, responsive layouts, accessibility focus states, image alt text, booking confirmation, and admin presentation were polished for the submitted product.

## 10. Final senior-review fixes

The mentor-collision savepoint/retry logic and secure confirmation-route fix were regression-tested and included in the final implementation.

# Final Verification Summary

| Check | Result |
| --- | --- |
| Backend tests | **244 passed** |
| Frontend tests | **61 passed** |
| Backend/frontend builds | Passed |
| oxlint | Passed |
| Prisma validation | Passed |
| Database migrations | Up to date |
| Seed | Idempotent; 10 mentors (5 + 5) |
| Tracked-file secret scan | No committed secrets |

### Core Implemented Rules

- One-hour trial classes.
- Exactly 10 seeded mentors: 5 on Shift 1 (`09:00–21:00 IST`) and 5 on overnight Shift 2 (`21:00–09:00 IST`).
- UTC/timestamptz storage with Luxon/IANA timezone calculations.
- Two-hour minimum lead time.
- Maximum two **CONFIRMED** classes per mentor-local calendar day.
- Cancelled bookings release capacity and can be rebooked.
- Idempotent booking and cancellation.
- Transactional/concurrency-safe mentor assignment.
- Secure booking access and cancellation credentials.
- Parent and mentor email notifications.
- Read-only admin dashboard.
- In-app demo classroom.
- No HOLD state.

### Submission Scope Notes

The product intentionally remains within the assignment scope: no user accounts, payments, or real video-conferencing system were added. The classroom is explicitly a demo flow, and the admin dashboard is read-only.

### Final Git Record

- **Implementation commit:** `2055eb0`
- **Transcript commit:** `64da4b5`
- **Branch:** `feature/project-setup`
- **Repository:** `https://github.com/sayedshoaibahmed/codeyoung-trail-booking.git`
- **Live frontend:** `https://codeyoung-trail-booking.vercel.app/`
- **Live API:** `https://codeyoung-trail-booking.onrender.com`
