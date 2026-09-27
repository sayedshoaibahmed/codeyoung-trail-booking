import { describe, it, expect, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';
import { PrismaMentorRepository } from '../../infrastructure/database/PrismaMentorRepository';

describe('PrismaMentorRepository.loadAvailabilitySnapshot', () => {
  it('issues two batched findMany calls and never groupBy', async () => {
    const mentorFindMany = vi.fn().mockResolvedValue([]);
    const bookingFindMany = vi.fn().mockResolvedValue([]);
    const bookingGroupBy = vi.fn().mockResolvedValue([]);

    const db = {
      mentor: { findMany: mentorFindMany },
      booking: { findMany: bookingFindMany, groupBy: bookingGroupBy },
    };

    const repo = new PrismaMentorRepository(db as never);
    await repo.loadAvailabilitySnapshot({
      mentorLocalDates: ['2024-11-04', '2024-11-05'],
      windowStartUtc: new Date('2024-11-04T00:00:00.000Z'),
      windowEndUtc: new Date('2024-11-05T00:00:00.000Z'),
    });

    expect(mentorFindMany).toHaveBeenCalledTimes(1);
    expect(bookingFindMany).toHaveBeenCalledTimes(1);
    expect(bookingGroupBy).not.toHaveBeenCalled();

    const bookingArg = bookingFindMany.mock.calls[0][0];
    expect(bookingArg.where.status).toBe(BookingStatus.CONFIRMED);
    expect(bookingArg.where.OR).toEqual([
      { mentorLocalDate: { in: ['2024-11-04', '2024-11-05'] } },
      {
        startTimeUtc: { lt: new Date('2024-11-05T00:00:00.000Z') },
        endTimeUtc: { gt: new Date('2024-11-04T00:00:00.000Z') },
      },
    ]);
  });

  it('dedupes bookings that match both date and overlap predicates', async () => {
    const row = {
      id: 'b1',
      mentorId: 'm1',
      startTimeUtc: new Date('2024-11-04T03:30:00.000Z'),
      endTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
      mentorLocalDate: '2024-11-04',
    };
    const db = {
      mentor: { findMany: vi.fn().mockResolvedValue([]) },
      booking: { findMany: vi.fn().mockResolvedValue([row, { ...row }]) },
    };
    const repo = new PrismaMentorRepository(db as never);
    const snapshot = await repo.loadAvailabilitySnapshot({
      mentorLocalDates: ['2024-11-04'],
      windowStartUtc: new Date('2024-11-04T00:00:00.000Z'),
      windowEndUtc: new Date('2024-11-05T00:00:00.000Z'),
    });
    expect(snapshot.confirmedBookings).toHaveLength(1);
  });
});
