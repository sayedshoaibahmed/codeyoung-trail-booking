import { describe, it, expect } from 'vitest';
import { isConfirmedSlotUniqueViolation } from '../../infrastructure/database/PrismaBookingRepository';

describe('isConfirmedSlotUniqueViolation', () => {
  it('recognises the confirmed mentor/slot unique index', () => {
    expect(isConfirmedSlotUniqueViolation({
      code: 'P2002',
      meta: { target: 'bookings_mentor_slot_confirmed_unique' },
    })).toBe(true);
    expect(isConfirmedSlotUniqueViolation({
      code: 'P2002',
      meta: { target: ['mentorId', 'startTimeUtc'] },
    })).toBe(true);
  });

  it('does not treat idempotency or access-token collisions as a slot conflict', () => {
    expect(isConfirmedSlotUniqueViolation({
      code: 'P2002',
      meta: { target: ['idempotencyKey'] },
    })).toBe(false);
    expect(isConfirmedSlotUniqueViolation({
      code: 'P2002',
      meta: { target: ['accessTokenHash'] },
    })).toBe(false);
    expect(isConfirmedSlotUniqueViolation({ code: 'P2034' })).toBe(false);
  });
});
