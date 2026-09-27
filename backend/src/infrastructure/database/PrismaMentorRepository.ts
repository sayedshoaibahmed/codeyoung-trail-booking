/**
 * Infrastructure — PrismaMentorRepository
 *
 * Concrete implementation of the MentorRepository port.
 * Injected at the composition root; never imported by application or domain layers.
 */
import type { PrismaClient } from '@prisma/client';
import { BookingStatus as PrismaBookingStatus, ShiftType as PrismaShiftType } from '@prisma/client';
import type {
  MentorRepository,
  FindEligibleMentorsOptions,
  MentorWithDayCount,
  LoadAvailabilitySnapshotOptions,
  MentorAvailabilitySnapshot,
} from '../../application/ports';
import type { Mentor } from '../../domain';
import { MentorShiftType } from '../../domain';
import { toDomainMentor } from './mappers/mentorMapper';

function toPrismaShift(shift: MentorShiftType): PrismaShiftType {
  return shift === MentorShiftType.SHIFT_1 ? PrismaShiftType.SHIFT_1 : PrismaShiftType.SHIFT_2;
}

export class PrismaMentorRepository implements MentorRepository {
  constructor(private readonly db: PrismaClient) {}

  async findEligibleMentors(
    options: FindEligibleMentorsOptions,
    tx?: unknown,
  ): Promise<MentorWithDayCount[]> {
    const client = (tx as PrismaClient | undefined) ?? this.db;
    const { shift, slotStartUtc, slotEndUtc, mentorLocalDate, dailyCap } = options;

    // Eligibility uses Mentor.shift (SHIFT_1 09:00–21:00 IST, SHIFT_2 21:00–09:00 IST).
    // MentorShift rows are the seeded schedule mirror of that same window; they are
    // not a second source of bookable hours.
    // 1. Find all active mentors on the correct shift.
    const shiftMentors = await client.mentor.findMany({
      where: { shift: toPrismaShift(shift), active: true },
    });

    if (shiftMentors.length === 0) return [];

    const mentorIds = shiftMentors.map((m) => m.id);

    // 2. Find mentors who already have a CONFIRMED booking overlapping the slot.
    //    [slotStart, slotEnd) overlaps existing [start, end) when:
    //    slotStart < existingEnd AND slotEnd > existingStart
    const bookedMentorIds = await client.booking.findMany({
      where: {
        mentorId: { in: mentorIds },
        status: PrismaBookingStatus.CONFIRMED,
        startTimeUtc: { lt: slotEndUtc },
        endTimeUtc: { gt: slotStartUtc },
      },
      select: { mentorId: true },
    });

    const bookedSet = new Set(bookedMentorIds.map((b) => b.mentorId));

    // 3. Count confirmed bookings per mentor on the mentorLocalDate.
    const dayCounts = await client.booking.groupBy({
      by: ['mentorId'],
      where: {
        mentorId: { in: mentorIds },
        status: PrismaBookingStatus.CONFIRMED,
        mentorLocalDate,
      },
      _count: { id: true },
    });

    const dayCountMap = new Map<string, number>(
      dayCounts.map((r) => [r.mentorId, r._count.id]),
    );

    // 4. Filter: not double-booked, under the daily cap.
    const eligible: MentorWithDayCount[] = shiftMentors
      .filter((m) => !bookedSet.has(m.id))
      .map((m) => ({ mentor: toDomainMentor(m), dayCount: dayCountMap.get(m.id) ?? 0 }))
      .filter((mwc) => mwc.dayCount < dailyCap);

    // 5. Sort by dayCount ASC, then mentor id ASC for deterministic tie-breaking.
    eligible.sort((a, b) => {
      if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount;
      return a.mentor.id.localeCompare(b.mentor.id);
    });

    return eligible;
  }

  async loadAvailabilitySnapshot(
    options: LoadAvailabilitySnapshotOptions,
  ): Promise<MentorAvailabilitySnapshot> {
    const { mentorLocalDates, windowStartUtc, windowEndUtc } = options;

    const bookingWhere =
      mentorLocalDates.length === 0
        ? {
            status: PrismaBookingStatus.CONFIRMED,
            startTimeUtc: { lt: windowEndUtc },
            endTimeUtc: { gt: windowStartUtc },
          }
        : {
            status: PrismaBookingStatus.CONFIRMED,
            OR: [
              { mentorLocalDate: { in: mentorLocalDates } },
              {
                startTimeUtc: { lt: windowEndUtc },
                endTimeUtc: { gt: windowStartUtc },
              },
            ],
          };

    const [mentors, bookings] = await Promise.all([
      this.db.mentor.findMany({ where: { active: true } }),
      this.db.booking.findMany({
        where: bookingWhere,
        select: {
          id: true,
          mentorId: true,
          startTimeUtc: true,
          endTimeUtc: true,
          mentorLocalDate: true,
        },
      }),
    ]);

    const seen = new Set<string>();
    const confirmedBookings = [];
    for (const booking of bookings) {
      if (seen.has(booking.id)) continue;
      seen.add(booking.id);
      confirmedBookings.push({
        mentorId: booking.mentorId,
        startTimeUtc: booking.startTimeUtc,
        endTimeUtc: booking.endTimeUtc,
        mentorLocalDate: booking.mentorLocalDate,
      });
    }

    return {
      mentors: mentors.map(toDomainMentor),
      confirmedBookings,
    };
  }

  async findById(id: string): Promise<Mentor | null> {
    const record = await this.db.mentor.findUnique({ where: { id } });
    return record ? toDomainMentor(record) : null;
  }

  async findAll(): Promise<Mentor[]> {
    const records = await this.db.mentor.findMany({ where: { active: true } });
    return records.map(toDomainMentor);
  }
}
