-- Priority 6: persist a hashed booking-access credential, separate from cancellation.
-- Existing rows get an unguessable hash so they cannot be opened without a new booking.

ALTER TABLE "bookings" ADD COLUMN "accessTokenHash" TEXT;

UPDATE "bookings"
SET "accessTokenHash" = encode(sha256((id || gen_random_uuid()::text)::bytea), 'hex')
WHERE "accessTokenHash" IS NULL;

ALTER TABLE "bookings" ALTER COLUMN "accessTokenHash" SET NOT NULL;

CREATE UNIQUE INDEX "bookings_accessTokenHash_key" ON "bookings"("accessTokenHash");
