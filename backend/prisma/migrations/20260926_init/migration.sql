-- Migration: 20260926_init
-- CodeYoung Trial Class Booking System — initial schema

-- ──────────────────────────────────────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "ShiftType" AS ENUM ('SHIFT_1', 'SHIFT_2');

-- ──────────────────────────────────────────────────────────────────────────────
-- mentors
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "mentors" (
    "id"        TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "email"     TEXT        NOT NULL,
    "timezone"  TEXT        NOT NULL DEFAULT 'Asia/Kolkata',
    "shift"     "ShiftType" NOT NULL,
    "active"    BOOLEAN     NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mentors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mentors_email_key" ON "mentors"("email");

-- ──────────────────────────────────────────────────────────────────────────────
-- mentor_shifts — persisted availability schedule per mentor
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "mentor_shifts" (
    "id"              TEXT        NOT NULL,
    "mentorId"        TEXT        NOT NULL,
    -- Day of week: 0=Sunday … 6=Saturday. NULL = applies every day.
    "dayOfWeek"       INTEGER,
    -- Local time HH:mm in the mentor's IANA timezone, e.g. '09:00' or '21:00'
    "localStartTime"  TEXT        NOT NULL,
    -- Local time HH:mm in the mentor's IANA timezone, e.g. '21:00' or '09:00'
    "localEndTime"    TEXT        NOT NULL,
    -- TRUE when localEndTime is on the following calendar day (overnight shifts).
    -- Shift 2 example: localStartTime='21:00', localEndTime='09:00' → crossesMidnight=TRUE
    "crossesMidnight" BOOLEAN     NOT NULL DEFAULT false,
    "active"          BOOLEAN     NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mentor_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mentor_shifts_mentorId_idx" ON "mentor_shifts"("mentorId");

ALTER TABLE "mentor_shifts" ADD CONSTRAINT "mentor_shifts_mentorId_fkey"
    FOREIGN KEY ("mentorId") REFERENCES "mentors"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- bookings
-- ──────────────────────────────────────────────────────────────────────────────


CREATE TABLE "bookings" (
    "id"                    TEXT             NOT NULL,
    "mentorId"              TEXT             NOT NULL,
    "parentName"            TEXT             NOT NULL,
    "parentEmail"           TEXT             NOT NULL,
    "childName"             TEXT             NOT NULL,
    "parentTimezone"        TEXT             NOT NULL,
    "startTimeUtc"          TIMESTAMPTZ      NOT NULL,
    "endTimeUtc"            TIMESTAMPTZ      NOT NULL,
    "mentorTimezone"        TEXT             NOT NULL,
    "mentorLocalDate"       TEXT             NOT NULL,
    "meetingLink"           TEXT             NOT NULL,
    "status"                "BookingStatus"  NOT NULL DEFAULT 'CONFIRMED',
    "cancellationTokenHash" TEXT             NOT NULL,
    "cancelledAt"           TIMESTAMPTZ,
    "idempotencyKey"        TEXT             NOT NULL,
    "createdAt"             TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMPTZ      NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- Standard covering indexes
CREATE INDEX "bookings_mentorId_startTimeUtc_idx" ON "bookings"("mentorId", "startTimeUtc");
CREATE INDEX "bookings_mentorId_mentorLocalDate_status_idx" ON "bookings"("mentorId", "mentorLocalDate", "status");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- Idempotency key must be globally unique
CREATE UNIQUE INDEX "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");

-- CRITICAL: Partial unique index — prevents a mentor from having two CONFIRMED
-- bookings at the same UTC start time, while allowing CANCELLED slot rebooking.
-- A naive UNIQUE(mentorId, startTimeUtc) would permanently block a cancelled
-- slot from being rebooked. The WHERE clause restricts the constraint only to
-- CONFIRMED rows, so cancelled bookings do not count.
CREATE UNIQUE INDEX "bookings_mentor_slot_confirmed_unique"
    ON "bookings"("mentorId", "startTimeUtc")
    WHERE "status" = 'CONFIRMED';

-- Foreign key
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_mentorId_fkey"
    FOREIGN KEY ("mentorId") REFERENCES "mentors"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- idempotency_keys
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE "idempotency_keys" (
    "id"           TEXT        NOT NULL,
    "key"          TEXT        NOT NULL,
    "payloadHash"  TEXT        NOT NULL,
    "responseJson" TEXT        NOT NULL,
    "bookingId"    TEXT        NOT NULL,
    "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_keys_key_key"       ON "idempotency_keys"("key");
CREATE UNIQUE INDEX "idempotency_keys_bookingId_key" ON "idempotency_keys"("bookingId");

ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
