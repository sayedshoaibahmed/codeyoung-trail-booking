# CODEYOUNG TRIAL CLASS BOOKING SYSTEM

## AI-Assisted Development Transcript & Implementation Record

### Transcript Format Note

This document presents the major AI-assisted development prompts, implementation decisions, significant corrections, and verification results from the development of the CodeYoung Trial Class Booking System.

Minor conversational exchanges, repetitive debugging messages, routine confirmations, and small clarification messages have been intentionally omitted for readability.

Where the original conversation was unavailable, implementation records have been reconstructed only from verifiable project artifacts such as source files, documentation, tests, and Git history. Such sections are clearly identified and are not presented as verbatim conversation.

The stage summaries below are **reconstructed from the retained project prompt record and the implementation**. They are not quoted as a complete chat log.

---

## 1. Project Overview

The CodeYoung Trial Class Booking System lets a parent book a free one-hour trial class without creating an account. The parent supplies contact details and a child name, sees availability in the browser timezone, and receives an immediate confirmed booking or a clear unavailable response.

**Problem.** Several parents can request the same hour while only a limited set of mentors is eligible. The system must assign a mentor, prevent double booking, respect shift boundaries and a daily cap, and still allow a cancelled hour to be booked again.

**Users.**

- Parents book, review, join a demo classroom, and cancel before the class starts.
- Mentors are assigned by the system and notified by email. They do not sign in.
- Administrators use a read-only dashboard of bookings and mentor load.

**Technology.** React 18, Vite, TypeScript, and Tailwind on the frontend. Node.js, Express, TypeScript, Zod, Luxon, and Prisma on the backend. PostgreSQL is the database. Resend sends production email. The deployed shape recorded in the project is Vercel for the interface, Render for the API, and Neon for PostgreSQL.

**Architecture.** The backend uses Clean Architecture: `domain`, `application`, `infrastructure`, and `interfaces`. The frontend uses Feature-Sliced Design: `app`, `pages`, `widgets`, `features`, `entities`, and `shared`. A layer depends only on layers below it. Redis, Kafka, Kubernetes, event buses, and WebSockets were excluded as unnecessary for this system.

---

## 2. Development Approach

Development proceeded incrementally through Prompt 0 to Prompt 13. Each major stage was implemented and checked before the next stage added behavior on top of it.

The sequence was conventions, project foundation, planning documents, database, timezone and availability, booking engine, HTTP API and cancellation, parent frontend, admin interface, automated tests, integration corrections, documentation, senior review, and final verification.

Later product work that is part of the same system—batched availability, next available date, secure booking links, the demo classroom, Resend email, and the landing page—is recorded in the stages where the Git history and source show it landing. Those items are implementation records, not separate invented prompts.

---

## 3. Prompt 0 – Project Setup & Conventions

### Objective

Establish architecture and dependency rules before feature code was written.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

The backend was required to use four layers:

- `domain` — entities and rules, with no Prisma or Express imports
- `application` — use cases and ports only
- `infrastructure` — Prisma, Luxon, email, idempotency, and transactions
- `interfaces` — Express routes, validation, and error mapping

The frontend was required to use Feature-Sliced Design: `app`, `pages`, `widgets`, `features`, `entities`, and `shared`, with imports only toward lower layers.

Microservices, Redis, Kafka, Kubernetes, event buses, and WebSockets were out of scope.

### Implementation Record

- Conventions were recorded as the project rule set used for later implementation.
- Backend and frontend directory intent matched the layers above.
- Business rules were kept out of route handlers.
- Framework types were kept out of the domain layer.

### Important Engineering Decisions

Clean Architecture plus full Feature-Sliced Design was adopted as a binding constraint, not as optional packaging. That decision determined where booking rules, Prisma, and React screens were allowed to live.

### Verification

**Reconstructed project record.** The retained record states that conventions were fixed before feature implementation. No separate automated test count is recorded for this stage.

### Issues & Corrections

None recorded as a distinct defect group. The retained record notes that an earlier lightweight draft was replaced by the Clean Architecture and Feature-Sliced Design requirement.

### Result

Prompt 0 completed by fixing the architecture rules that the rest of the system follows.

---

## 4. Prompt 1 – Project Foundation

### Objective

Create a buildable application skeleton without the full booking product.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Required stack: React, Vite, TypeScript, Tailwind, React Router, React Hook Form, and Zod on the frontend; Node.js, Express, TypeScript, Prisma, Zod, Luxon, and PostgreSQL on the backend. The stage was to add configuration, directory structure, `.env.example`, a README scaffold, and build scripts. Full booking UI, booking rules, and the final database schema were explicitly deferred.

### Implementation Record

- Git history records `1d4b36c` (`chore(setup): initialize project scaffolding and resolve build configurations`).
- Frontend and backend packages were separated. There is no root `package.json`.
- TypeScript, Tailwind, Prisma, and environment templates were introduced.
- Later stages added domain, application, infrastructure, interfaces, and frontend slices on this skeleton.

### Important Engineering Decisions

The repository stayed a single application with two packages. Distributed infrastructure was not introduced to satisfy the architecture labels.

### Verification

**Reconstructed project record.** The setup commit is in Git history. A dedicated test total for Prompt 1 is not recorded.

### Issues & Corrections

The setup commit message records that build configuration issues were resolved as part of scaffolding. No product defect is recorded for this stage.

### Result

Prompt 1 completed with a buildable foundation and no booking behavior yet.

---

## 5. Prompt 2 – PRD, TRD & Edge Cases

### Objective

Write the planning documents that later implementation and tests would follow.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Create `docs/PRD.md`, `docs/TRD.md`, and `docs/EDGE_CASES.md`. The documents had to cover the parent journey, a one-hour trial, parent and mentor timezones, daylight-saving time, ten mentors, two shifts, the daily cap, mentor assignment, alternate slots, a dummy meeting link, email, the admin dashboard, and cancellation.

The technical document had to describe architecture, API contracts, the data model, transactions, idempotency, and the error format. Edge cases had to include contention, idempotency payload changes, daily-cap races, shift boundaries, overnight shifts, daylight-saving time, lead time, cancellation, email failure, and database failure.

### Implementation Record

- Git history records `d4623fd` (`docs(project): create comprehensive PRD, TRD, and Edge Cases documentation`).
- Those three documents became the reference used by later code and tests.
- Prompt 11 later revised them so they describe the implemented system rather than an earlier draft.

### Important Engineering Decisions

Planning documents were treated as the source for business rules, including the decision that a booking is confirmed immediately. A temporary hold state was not part of the finalized product.

### Verification

**Reconstructed project record.** The documentation commit is in Git history. No test suite is recorded for this documentation-only stage.

### Issues & Corrections

Outdated draft language, including shorter class duration and a narrower daytime shift, was removed in the later documentation pass rather than in this initial write.

### Result

Prompt 2 completed by establishing the product, technical, and edge-case documents.

---

## 6. Prompt 3 – PostgreSQL & Prisma

### Objective

Persist mentors, shifts, bookings, and idempotency keys in PostgreSQL.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Domain entities: Mentor, MentorShift, and Booking, with statuses `CONFIRMED` and `CANCELLED`. Prisma models for those entities plus `IdempotencyKey`. Instants stored as UTC `timestamptz`. Overnight `21:00–09:00` shifts supported. Cancellation credentials stored only in a non-reversible form. A unique constraint must not permanently block rebooking a cancelled slot. Seed exactly ten mentors, five on each shift, in an idempotent way.

### Implementation Record

- Git history records `24b226d` (data model, Prisma schema, repositories, and seed) and `571133d` (MentorShift model added for compliance with this stage).
- `BookingStatus` is only `CONFIRMED` or `CANCELLED`. There is no HOLD status.
- A partial unique index, `bookings_mentor_slot_confirmed_unique`, applies to `(mentorId, startTimeUtc)` only where `status = 'CONFIRMED'`.
- `idempotencyKey` and `accessTokenHash` are unique. Cancellation tokens are stored as bcrypt hashes.
- The seed upserts ten mentors in `Asia/Kolkata`: five Shift 1 (`09:00–21:00`) and five Shift 2 (`21:00–09:00`, crossing midnight).

### Important Engineering Decisions

Cancelled rows are excluded from the slot unique index so a cancelled hour can be booked again. Daily-cap math uses a stored mentor-local date rather than converting timestamps in every query.

### Verification

**Reconstructed project record.** The retained record states that a Neon PostgreSQL database was connected, migrations were applied, and the seed produced ten mentors with five in each shift. Prompt 13 repeated that check: two migrations, schema up to date, seed idempotent, mentors 10, MentorShifts 10, Shift 1 count 5, Shift 2 count 5, and the confirmed-slot partial unique index present.

### Issues & Corrections

The follow-up commit `571133d` added the MentorShift Prisma model after the first schema pass. That was a compliance correction, not a change of business rules.

### Result

Prompt 3 completed with a transactional PostgreSQL model and an idempotent ten-mentor seed.

---

## 7. Prompt 4 – Timezone & Availability

### Objective

Convert parent-local times safely and expose bookable one-hour slots.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Validate IANA timezones. Convert parent local time to UTC and UTC intervals to mentor local time using Luxon, not manual offsets. Require the full one-hour interval to fit the shift, including overnight Shift 2. Derive the mentor-local calendar date. Reject ambiguous and nonexistent local times. Enforce a two-hour lead time. Ignore cancelled bookings. Block overlapping confirmed bookings. Enforce the daily cap. Expose `GET /api/availability`.

### Implementation Record

- Git history records `b44b17e` (`feat(availability): implement timezone/availability logic and GET /api/availability`).
- Timezone conversion lives behind a timezone port implemented with Luxon in infrastructure.
- Availability returns a full day of hourly slots with available, full, and blocked states.
- Cancelled bookings do not occupy a slot or consume the daily cap.

### Important Engineering Decisions

Parent timezone comes from the browser IANA zone. Mentors in the seed use `Asia/Kolkata`. Stored instants remain UTC.

### Verification

**Reconstructed project record.** Timezone, daylight-saving time, overnight shifts, and lead time were covered by the automated suite introduced in Prompt 9. No separate Prompt 4 test total is recorded.

### Issues & Corrections

A later integration fix closed a gap where a slot could start inside a shift and still end outside it. That correction is recorded under Prompt 10.

### Result

Prompt 4 completed with timezone-aware availability and UTC persistence.

---

## 8. Prompt 5 – Booking Engine & Mentor Assignment

### Objective

Confirm a one-hour trial inside one database transaction and assign an eligible mentor.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

`BookClass` must enforce timezone conversion, a two-hour lead time, a one-hour duration, and idempotency. The same key and payload return the original result. The same key with a different payload is a conflict.

Inside one transaction the use case finds candidate mentors, checks the shift and the full hour, derives the mentor-local date, counts only confirmed bookings, enforces the cap of two, checks overlap (`existing start < requested end` and `existing end > requested start`), selects the least-loaded eligible mentor, inserts the booking, and stores the idempotency result.

Email is sent only after commit and must not undo a successful booking.

### Implementation Record

- Git history records `2520158` (`feat(booking): implement BookClass use case with UoW, idempotency, and concurrency safety`).
- The unit of work runs at serializable isolation.
- Least-loaded assignment uses confirmed bookings on the mentor-local date, then mentor identity.
- Idempotency stores a SHA-256 hash of the canonical request and the original response.
- Parent and mentor emails are invoked after the transaction returns. Each send is isolated so a mail failure does not roll back the booking.

### Important Engineering Decisions

Concurrency safety was placed in the database transaction, the confirmed-slot unique index, and later retry behavior, not in an in-memory lock or a hold row.

### Verification

**Reconstructed project record.** Booking rules were exercised by the Prompt 9 suite and again after Prompt 10 and Prompt 12. The retained record notes that remote transaction timing on Neon led to an adjustment of the Prisma interactive transaction wait settings without dropping serializable isolation.

### Issues & Corrections

Prompt 12 later found that a uniqueness collision on the first mentor could fail the request even when another mentor was eligible. That fix is recorded in Prompt 12. It is not claimed as part of the original Prompt 5 behavior.

### Result

Prompt 5 completed with a transactional booking use case and post-commit email.

---

## 9. Prompt 6 – API & Cancellation

### Objective

Expose booking, availability, cancellation, class lookup, and the admin read model over HTTP.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Routes included `GET /api/availability`, `POST /api/bookings`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`, `GET /api/classes/:id`, and `GET /api/admin/dashboard`.

Cancellation is allowed only before the start, only for a confirmed booking, with a secure credential, atomically and idempotently. A repeat cancel is safe. Cancel after start is rejected. `cancelledAt` is stored and capacity is released. Zod validates input. Errors use a consistent JSON shape. Controllers do not contain business rules or Prisma calls.

### Implementation Record

- Git history records `4bc6a04` (`feat(interfaces): complete all API routes, CancelClass use case, and admin dashboard`).
- Cancel compares the presented token with the bcrypt hash and locks the booking row with `SELECT … FOR UPDATE`.
- A later security pass locked `GET /api/bookings/:id` and the class-id alias so an id alone returns an invalid-link response and does not load the booking.
- Secure reopen uses `POST /api/booking-access` with a separate access token stored as a SHA-256 hash.

### Important Engineering Decisions

The booking id is not a public credential. Cancellation and view-access tokens are different secrets, and only their hashes are stored.

### Verification

**Reconstructed project record.** API validation, cancel-before-start, repeat cancel, and cancel-after-start are part of the automated scenarios listed under Prompt 9. Prompt 13 reconfirmed the locked GET-by-id behavior in the router.

### Issues & Corrections

An early confirmation page called the locked GET-by-id route. Prompt 12 removed that fetch. Details are under Prompt 12.

### Result

Prompt 6 completed with a validated HTTP API and secure, idempotent cancellation.

---

## 10. Prompt 7 – Parent Booking Frontend

### Objective

Let a parent choose a slot and complete a booking in the browser.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Build the flow with Feature-Sliced Design: booking, mentor, and slot entities; view-availability, book-slot, and cancel-booking features; a booking-form widget; booking, confirmation, and classroom pages; routing; and shared API and UI primitives.

The booking page collects parent details, uses the browser timezone, lists one-hour slots, validates input, and handles loading, errors, empty availability, and alternate slots. Booking requests send an idempotency key. The classroom is a demo room, not a video provider.

### Implementation Record

- Git history records `3e41bb5` (`feat(frontend): implement FSD frontend, DB config, and UI redesign`).
- The booking form posts to the booking API and navigates to the secure booking page after success.
- Slot selection is cleared when the date changes (corrected in Prompt 10).
- The parent timezone is read from `Intl`, not from a country picker.

### Important Engineering Decisions

The frontend does not assign mentors or enforce the cap. Those rules stay on the server. The client displays the result and refreshes availability after a conflict.

### Verification

**Reconstructed project record.** Frontend tests were expanded in later stages. The Prompt 12 and Prompt 13 totals are 61 frontend tests passed. A Prompt 7-only count is not recorded.

### Issues & Corrections

Date defaulting, stale slot selection, and a loading flash are recorded under Prompt 10.

### Result

Prompt 7 completed with a parent booking flow on the Feature-Sliced Design structure.

---

## 11. Prompt 8 – Admin Dashboard & UI

### Objective

Show operations data without adding write actions or authentication.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

A read-only dashboard backed by `GET /api/admin/dashboard` shows today's confirmed classes, today's cancelled classes, upcoming classes, mentor load, status, and shift. Shift labels are exactly `09:00–21:00 IST` and `21:00–09:00 IST`. The interface should be responsive, keyboard usable, and explicit about timezones. No extra product features were requested.

### Implementation Record

- The admin API and dashboard widget were added with the interface stage (`4bc6a04`) and the frontend stage (`3e41bb5`).
- Mentor shift text comes from stored shift data.
- Admin clocks distinguish UTC from the mentor-local zone. A frontend test checks that the mentor clock uses the stored mentor timezone rather than the browser zone.

### Important Engineering Decisions

The dashboard is intentionally unauthenticated in this version. That limitation is documented rather than hidden.

### Verification

**Reconstructed project record.** Admin display behavior is covered by frontend tests included in the later 61-test total. No separate Prompt 8 count is recorded.

### Issues & Corrections

Prompt 10 fixed hardcoded mentor labels and a UTC label that was actually browser-local time. Those fixes are listed under Prompt 10.

### Result

Prompt 8 completed with a read-only admin dashboard and the required shift labels.

---

## 12. Prompt 9 – Automated Testing

### Objective

Lock the business rules with automated tests and fix real failures without redesigning the system.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

The required scenarios were parent timezone conversion, United States and United Kingdom daylight-saving time, India time, non-whole-hour offsets, exact one-hour duration, shift start and end, overnight shift, midnight crossing, two-hour lead time, daily cap, cancelled bookings excluded from the cap and releasing the slot, same-slot contention, concurrent last daily-cap position, idempotency replay and payload conflict, different keys for the same slot, cancellation before start, repeated cancellation, cancellation after start, no eligible mentor, email failure after commit, and API validation errors.

### Implementation Record

- Backend tests use Vitest and cover domain rules, use cases, and HTTP behavior through ports and fixtures.
- The first comprehensive run recorded in the project is **180 tests passed, 0 failed, across 8 files**.
- Fixture problems found during that run, including an India-time assertion and invalid UUID fixtures, were corrected without changing product rules.

### Important Engineering Decisions

Concurrency cases at this stage simulated database conflict codes. They were not a full parallel test against a live PostgreSQL race. That limit was kept visible for the integration stage.

### Verification

| Check | Result |
| --- | --- |
| First comprehensive automated run | 180 passed, 0 failed, 8 files |

### Issues & Corrections

Test fixtures and assertions were corrected. No product redesign is recorded for this stage.

### Result

Prompt 9 completed with 180 passing tests and a documented limit on how concurrency was simulated.

---

## 13. Prompt 10 – Integration & Bug Fixes

### Objective

Compare the running system with the architecture and business rules, and fix real integration defects without adding features.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Review Feature-Sliced Design, Clean Architecture, Prisma, APIs, timezones, availability, assignment, the daily cap, cancellation, idempotency, concurrency, email, admin behavior, and documentation. Check for mismatched routes, old 30-minute or `09:00–18:00` rules, shift naming, constraints, and layer violations. Do not add product features.

### Implementation Record

Seven defect groups were corrected:

1. A slot could start inside a shift and end outside it. The full one-hour interval is now validated. Intervals that cross the shift boundary are rejected for booking and skipped when building alternates.
2. An idempotency race with a different body could be treated as a full slot. A payload mismatch now returns an idempotency conflict.
3. Admin class cards used a generic mentor label. They show the assigned mentor name.
4. Admin times were labeled UTC while formatted in the browser zone. UTC and mentor-local clocks are formatted explicitly.
5. The booking date could default to the UTC calendar day. It uses the browser-local date.
6. Changing the date kept the previously selected slot. The selection is cleared when the date changes.
7. Availability and confirmation could flash an empty or error state because loading began as false. The initial loading state was corrected.

Git history records `0ce2cb0` (`fix(booking+ui): enforce shift fit, harden availability errors, and add booking tests`) among the integration fixes.

### Important Engineering Decisions

Fixes stayed inside existing use cases and UI state. No hold status, queue, or new service was added to paper over the defects.

### Verification

| Check | Result |
| --- | --- |
| Backend tests after the fixes | **182 passed, 0 failed** |
| Backend TypeScript and build | Passed |
| Frontend TypeScript and Vite build | Passed |
| oxlint | Passed |

**Reconstructed project record.** The retained integration notes state that a real Neon database was in use and that Prisma repositories were on the runtime path. Migration, seed, and the ten-mentor roster were verified in the database records associated with this project and were checked again in Prompt 13. The retained Prompt 10 notes do not include a separate log of one live booking-and-cancel script, so that exercise is not claimed as a numbered Prompt 10 test result. The retained deployment record states that booking and cancellation were manually exercised on the deployed system during development.

### Issues & Corrections

The seven groups above are the significant corrections. Smaller assertion and environment messages from the same pass are omitted.

### Result

Prompt 10 completed after the identified integration issues were corrected and the implementation was re-verified at 182 passing tests.

---

## 14. Prompt 11 – Documentation

### Objective

Make the written docs match the system that was actually built.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Update `README.md`, `docs/PRD.md`, `docs/TRD.md`, `docs/EDGE_CASES.md`, the API document, `.env.example`, and the frontend README. Remove outdated claims such as 30-minute classes, a `09:00–18:00` shift, cancellation being out of scope, and a lighter architecture. Document the one-hour class, both shifts, UTC storage, Luxon, the two-hour lead time, the cap of two confirmed classes, cancellation, idempotency, concurrency, and the layer rules.

### Implementation Record

- The files above were rewritten against the implementation.
- `docs/API.md` describes the live routes, including locked GET-by-id and token-based booking access.
- `.env.example` uses placeholders. Lead time, daily cap, and alternate-slot counts are documented as hardcoded, not as live environment variables.
- The README is a setup guide and records the public site `https://codeyoung-trail-booking.vercel.app/` and the repository URL. It does not contain secrets.
- A wording fix during final verification updated the README, edge cases, and technical document so they describe next-mentor retry and serialization retry. That correction is included in commit `2055eb0`.

### Important Engineering Decisions

Documentation claims only behavior present in code. HOLD, MentorHold, and a temporary reservation are explicitly described as not implemented.

### Verification

**Reconstructed project record.** Prompt 11 was a documentation pass. Prompt 13 reviewed the same files for consistency with the code. No new test count is attributed solely to Prompt 11.

### Issues & Corrections

Early drafts still described a failed booking when another mentor was free. That sentence was corrected after the Prompt 12 retry behavior existed.

### Result

Prompt 11 completed with documentation aligned to the implemented product.

---

## 15. Prompt 12 – Senior Engineering Review

### Objective

Review correctness, security, and architecture, and apply only the defects that were real.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Review booking rules, timezones, overnight shifts, one-hour fit, the daily cap, concurrency, idempotency, cancellation, indexes, API errors, frontend behavior, layer boundaries, dead code, secrets, builds, and tests. Change only what was necessary. Run tests, builds, and Prisma checks.

### Implementation Record

Two defects were fixed.

1. **Mentor collision.** If the least-loaded mentor lost the confirmed-slot unique index, the booking failed even when another eligible mentor remained. The insert now uses a PostgreSQL savepoint. A confirmed-slot unique violation rolls back to that savepoint and the use case tries the next eligible mentor in the same transaction. A serialization failure (`P2034`) retries the whole transaction up to three times. Idempotency-key and access-token unique violations are not treated as “try the next mentor.”
2. **Confirmation route.** `/confirmation/:id` called the locked GET-by-id API. The page no longer loads private booking details by id. Parents use `/b/:accessToken`.

Regression coverage was added for the collision path and for the confirmation page behavior.

The same review period’s surrounding product work, already in Git history before the final commit, includes batched availability (`aa1c5e5`), next-available-date (`c225e0e`), secure access links (`22fd934`), the in-app classroom (`7289481`, `974b328`), and Resend email (`ef7b0f8`). Those are recorded here as verified repository history, not as extra Prompt 12 requirements.

### Important Engineering Decisions

The collision fix stays inside the existing serializable transaction. It does not add a hold row. The confirmation page does not bypass the locked booking-id endpoint.

### Verification

| Check | Result |
| --- | --- |
| Backend Vitest | **244 passed, 0 failed, 17 files** |
| Frontend tests | **61 passed, 0 failed** |
| Backend TypeScript and build | Passed |
| Frontend TypeScript and Vite build | Passed |
| oxlint | 0 warnings, 0 errors |
| Prisma schema validation | Passed |
| Secret scan and `git diff --check` | Passed, as recorded for this review |

`prisma generate` hit the known Windows `EPERM` lock while renaming the query-engine DLL. No files were deleted to force the rename.

### Issues & Corrections

Only the mentor-collision and confirmation-route defects above were treated as review findings that required code changes.

### Result

Prompt 12 completed after those two defects were fixed and the recorded checks passed.

---

## 16. Prompt 13 – Final Verification & Submission

### Objective

Confirm the finished system, correct only genuine mismatches, and create one local commit without pushing or deploying.

### Development Prompt / Requirements

Reconstructed from the project prompt documentation and implementation.

Re-check booking rules, availability, email, the frontend, the absence of HOLD, tests, Prisma, secrets, documentation, architecture direction, and Git contents. Run backend and frontend tests and builds. Validate the schema, migration status, and seed without resetting the database. Stage only reviewed files. Create one commit, `feat(submission): finalize CodeYoung assignment`. Do not push or deploy. Do not treat this transcript file as part of that commit.

### Implementation Record

- No new product feature was added in this stage.
- Documentation lines that still denied next-mentor retry were updated to match Prompt 12.
- The final commit is `2055eb08fd50500269324de42ad3ae1bca9ce0a6` (`2055eb0`) on `feature/project-setup`.
- That commit includes the review fixes, documentation, landing page updates, and `frontend/src/pages/landing/ui/hero-study.webp`.
- The landing page at `/` shows CodeYoung branding, the hero image, benefits, how it works, and calls to action that route to `/book`. A headless render of the local page confirmed those sections, the image alt text, four links to `/book`, `overflow-x-hidden`, and focus-visible styles. The interactive IDE browser did not connect for a keyboard walkthrough.
- `TRANSCRIPT.md` was intentionally left out of commit `2055eb0`.

### Important Engineering Decisions

Submission verification did not weaken tests, reset data, or introduce a hold feature to close residual race cases.

### Verification

| Check | Result |
| --- | --- |
| Backend Vitest | **244 passed, 17 files** |
| Frontend tests | **61 passed, 0 failed** |
| Backend type check and build | Passed |
| Frontend type check and Vite build | Passed |
| oxlint | 0 warnings, 0 errors |
| Prisma validate | Passed |
| Prisma generate | Windows `EPERM` on the query-engine DLL; reported, not forced |
| Migration status | 2 migrations, schema up to date |
| Seed | Idempotent; 10 mentors and 10 shift rows remained |
| Mentors | 5 Shift 1, 5 Shift 2 |
| Indexes | Confirmed-slot partial unique index, unique idempotency key, unique access-token hash |
| Tracked secret scan | No Resend key, cloud access key, or database password in tracked files |
| `.env` | Ignored; not committed |
| Git after commit | Working tree clean except this untracked transcript; branch ahead of origin by 1; push not performed |
| Deployment | Not performed in Prompt 13 |

The public site already recorded in the README is `https://codeyoung-trail-booking.vercel.app/`, with the API on Render and data in Neon. That deployment predates this verification stage.

### Issues & Corrections

The only change required by the audit was documentation that lagged the mentor-retry behavior. No further product defect was fixed in this stage.

### Result

Prompt 13 completed with the recorded verification results and local commit `2055eb0`. The branch was not pushed and the application was not redeployed.

---

## Additional implementation records

These items are part of the finished system. They are **reconstructed from Git history, source, and tests**, and they are not presented as missing prompt numbers.

### Availability performance

The earlier availability path could run about **24 slots × 3 sequential database queries** for one date. Commit `aa1c5e5` loads active mentors and relevant confirmed bookings in batch and evaluates eligibility in memory. Booking assignment still uses the transactional mentor query. The retained record says latency improved after the change. A precise before-and-after benchmark is not preserved here, so no millisecond claim is stated.

### Slot loading and grouping

Commit `94f2b4f` and related UI work added abort and stale-response protection, loading placeholders, and a disabled submit control while slots are loading. The day is grouped into Morning, Afternoon, Evening, and Night. Unavailable slots stay visible and are not selectable. Night ordering keeps late evening before the after-midnight hours.

### Next available date

Commit `c225e0e` adds `GET /api/availability/next`. When the selected parent-local date has no bookable slot, the client asks for the next date. The server searches up to 30 days in that timezone. The page shows a loading state, an error state, or the next date. Choosing “Select this date” sets the booking date. It does not change the date until the parent uses that control. If nothing is free in the window, the page says so.

### Secure booking access

Commit `22fd934` separates view access from cancellation. The raw access token is returned on create and in the parent email, then stored only as a SHA-256 hash. The cancellation token is stored only as a bcrypt hash. `GET /api/bookings/:id` does not return the booking. Mentor mail includes class details and the join link, not the cancellation token or the `/b/:accessToken` secret. Mock confirmation logs redact the raw token and the view URL.

### Demo classroom

Commits `7289481` and `974b328` replace an external meeting URL with `/class/<booking-id>`. Ending the call returns the parent to the booking view or home. It does not cancel the class. Cancellation remains on the booking detail page and still requires the cancellation token.

### Resend email

Commit `ef7b0f8` sends parent confirmation, mentor notification, and cancellation mail through the email port. Production uses Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set. Tests use the mock sender. Mail runs after the booking or cancellation has been saved. A send failure is logged and does not roll back the database write. The API key is read from the environment and is not in the repository. The documented sender is `CodeYoung Trial Booking <bookings@dandeliinn.com>`.

### Landing page

The public home page and `hero-study.webp` are in commit `2055eb0`. There is no `cygirlstudying` asset in the repository. The optimized WebP is the file the landing page imports.

---

## 17. Major Engineering Decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Architecture | Clean Architecture and Feature-Sliced Design | Keep booking rules out of Express, Prisma, and page components |
| Database | PostgreSQL and Prisma | Relational transactions and constraints for one booking at a time |
| Timezone | Luxon and IANA zones | Daylight-saving time and non-whole-hour offsets |
| Persistence | UTC `timestamptz` plus a stored mentor-local date | One instant in the database; stable daily-cap dates |
| Concurrency | Serializable transactions, a partial unique index, savepoints, and limited serialization retries | Stop two confirmed bookings for the same mentor and start time, and try another eligible mentor when one collides |
| Cancellation | Bcrypt hash of a one-time token | The raw cancel secret is not stored |
| Booking access | SHA-256 access token and a locked GET-by-id route | A booking id is not enough to read parent details |
| Email | Resend after commit, behind an email port | Notify parent and mentor without coupling mail success to the booking transaction |
| Frontend | React with Feature-Sliced Design | Organize booking, availability, and admin UI by feature without upward imports |
| Scope | No HOLD status and no extra messaging infrastructure | Immediate confirm-or-reject matched the assignment; Redis, queues, and sockets were unnecessary |

---

## 18. Testing & Verification Summary

| Stage | Verification | Result |
| --- | --- | --- |
| Prompt 9 | Automated tests | 180 passed initially (8 files) |
| Prompt 10 | Regression and integration tests | 182 passed |
| Prompt 12 | Backend tests | 244 passed (17 files) |
| Prompt 12 | Frontend tests | 61 passed |
| Prompt 12 | Type checks, builds, oxlint, Prisma validate | Passed |
| Prompt 13 | Final tests, builds, database, secrets, and Git review | Passed, with the known Windows Prisma generate `EPERM` |

Prompt 9 concurrency tests simulated database errors. They were not full parallel live-database races. Later reviews added savepoint and serialization-retry coverage in the application and repository tests. That still does not replace an unbounded multi-client load test.

---

## 19. Final Feature Summary

### Parent Features

A parent opens the landing page, books at `/book` in the browser timezone, sees a grouped 24-hour grid, and receives a confirmed booking or an unavailable response with alternate hours. Booking details reopen at `/b/:accessToken`. The parent can cancel before the start with the cancellation token and can open the demo classroom.

### Mentor Features

Ten seeded mentors are assigned automatically. Five work Shift 1 and five work overnight Shift 2, in India Standard Time. A mentor email reports the assignment, parent and student names, both time contexts, and the class link. It does not include cancellation or access secrets.

### Admin Features

`/admin` is a read-only view of confirmed and cancelled classes, upcoming classes, and mentor load, with explicit shift labels and separate UTC and mentor-local times. It has no login.

### Booking and Availability

Classes last one hour and must fit the shift. Lead time is two hours. A mentor may have at most two confirmed classes on a mentor-local calendar day. Cancelled bookings do not count and free the slot. Assignment prefers the least-loaded eligible mentor and continues to the next mentor if the confirmed-slot unique index rejects the first. Idempotent replays return the original booking. Availability is batched in memory. A fully booked day can search the next 30 parent-local days.

### Security

Raw cancellation and access tokens are not stored. GET by booking id does not return the booking. Secrets are not committed. Local `.env` files are gitignored.

### Email

Resend sends parent confirmation, mentor notification, and cancellation mail after the corresponding database write. Tests use a mock. Missing mail configuration does not undo the booking.

### Timezone Handling

Instants are stored in UTC. Luxon converts parent and mentor zones, including daylight-saving gaps and overlaps and India Standard Time. The interface shows parent and mentor times where the booking is displayed.

### Testing

Backend Vitest and frontend Node tests cover the rules listed in Prompts 9 through 13. The last recorded totals are 244 backend tests and 61 frontend tests, with passing type checks, builds, and oxlint.

### Deployment

The recorded public site is `https://codeyoung-trail-booking.vercel.app/`, with the API on Render, PostgreSQL on Neon, and email through Resend. Prompt 13 did not deploy a new release.

---

## 20. Known Limitations

- There are no user accounts and no parent or mentor login.
- `/admin` is not authenticated.
- There is no payment flow.
- The classroom is an in-app demo. It is not a video provider.
- There is no HOLD, MentorHold, or temporary reservation.
- Lead time (2 hours), the daily cap (2 confirmed classes), and the 30-day next-date window are constants in code, not runtime configuration.
- Production email requires Resend configuration. If it is missing, the booking still stands.
- Nodemailer remains in the backend dependencies. Production sending uses Resend.
- Idempotency rows are not deleted by a scheduled job.
- If every eligible mentor is busy, the API returns a slot-unavailable response.
- Prompt 9 did not prove concurrency with parallel clients against a live database.
- `prisma generate` can fail on Windows with `EPERM` when the query engine file is locked.

---

## 21. Final Submission Status

Development was completed through Prompt 13 with the major functional, architectural, security, testing, documentation, and verification requirements implemented and reviewed.

| Item | Status |
| --- | --- |
| Prompts 0–13 | Represented in this record |
| Business rules | 1-hour trials, 10 mentors, two IST shifts, 2-hour lead, cap of 2 confirmed classes, no HOLD |
| Architecture | Clean Architecture backend and Feature-Sliced Design frontend |
| Last recorded tests | Backend 244 passed; frontend 61 passed |
| Database | Migrations current; seed idempotent; confirmed-slot partial unique index present |
| Secrets in Git | Not found in the tracked-file scan |
| Final implementation commit | `2055eb0` on `feature/project-setup` |
| Push and deploy during Prompt 13 | Not performed |
| This transcript | Prepared after Prompt 13 and not included in commit `2055eb0` |

The branch was one commit ahead of `origin/feature/project-setup` when Prompt 13 finished, and it was still ahead by that commit when this transcript was written. This file remains untracked until it is committed in a separate step.
