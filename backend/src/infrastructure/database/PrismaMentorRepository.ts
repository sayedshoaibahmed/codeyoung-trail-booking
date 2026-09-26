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

  async findById(id: string): Promise<Mentor | null> {
    const record = await this.db.mentor.findUnique({ where: { id } });
    return record ? toDomainMentor(record) : null;
  }

  async findAll(): Promise<Mentor[]> {
    const records = await this.db.mentor.findMany({ where: { active: true } });
    return records.map(toDomainMentor);
  }
}
