/**
 * Infrastructure — PrismaAdminDashboardRepository
 *
 * Implements the AdminDashboardRepository port using optimised Prisma queries.
 * This is the ONLY place in the codebase that runs aggregation queries for
 * the admin read-model. The interface layer never imports this class directly.
 */
import type { PrismaClient } from '@prisma/client';
import { BookingStatus as PrismaStatus } from '@prisma/client';
import type {
  AdminDashboardRepository,
  AdminDashboardData,
  BookingSummaryDto,
  MentorUtilizationDto,
} from '../../application/ports/AdminDashboardRepository';

export class PrismaAdminDashboardRepository implements AdminDashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  async getDashboardData(nowUtc: Date): Promise<AdminDashboardData> {
    // Run all queries concurrently for performance
    const [
      totalCount,
      confirmedCount,
      cancelledCount,
      upcomingRaw,
      cancelledRaw,
      mentorsRaw,
      utilizationRaw,
    ] = await Promise.all([
      this.db.booking.count(),
      this.db.booking.count({ where: { status: PrismaStatus.CONFIRMED } }),
      this.db.booking.count({ where: { status: PrismaStatus.CANCELLED } }),

      // Next 10 upcoming confirmed classes
      this.db.booking.findMany({
        where: { status: PrismaStatus.CONFIRMED, startTimeUtc: { gte: nowUtc } },
        orderBy: { startTimeUtc: 'asc' },
        take: 10,
      }),

      // 5 most recently cancelled bookings
      this.db.booking.findMany({
        where: { status: PrismaStatus.CANCELLED },
        orderBy: { cancelledAt: 'desc' },
        take: 5,
      }),

      // All active mentors
      this.db.mentor.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
      }),

      // Booking counts grouped by mentorId and status
      this.db.booking.groupBy({
        by: ['mentorId', 'status'],
        _count: { _all: true },
      }),
    ]);

    // Build a lookup map: mentorId → { confirmed, cancelled }
    const utilMap = new Map<string, { confirmed: number; cancelled: number }>();
    for (const row of utilizationRaw) {
      const existing = utilMap.get(row.mentorId) ?? { confirmed: 0, cancelled: 0 };
      if (row.status === PrismaStatus.CONFIRMED) {
        existing.confirmed = row._count._all;
      } else {
        existing.cancelled = row._count._all;
      }
      utilMap.set(row.mentorId, existing);
    }

    const mentorUtilization: MentorUtilizationDto[] = mentorsRaw.map((m) => {
      const counts = utilMap.get(m.id) ?? { confirmed: 0, cancelled: 0 };
      return {
        mentorId:       m.id,
        mentorName:     m.name,
        mentorEmail:    m.email,
        shift:          m.shift,
        confirmedCount: counts.confirmed,
        cancelledCount: counts.cancelled,
      };
    });

    const toDto = (b: {
      id: string;
      parentName: string;
      parentEmail: string;
      childName: string;
      mentorId: string;
      startTimeUtc: Date;
      endTimeUtc: Date;
      mentorLocalDate: string;
      status: PrismaStatus;
      cancelledAt: Date | null;
      meetingLink: string;
    }): BookingSummaryDto => ({
      id:              b.id,
      parentName:      b.parentName,
      parentEmail:     b.parentEmail,
      childName:       b.childName,
      mentorId:        b.mentorId,
      startTimeUtc:    b.startTimeUtc.toISOString(),
      endTimeUtc:      b.endTimeUtc.toISOString(),
      mentorLocalDate: b.mentorLocalDate,
      status:          b.status,
      cancelledAt:     b.cancelledAt?.toISOString() ?? null,
      meetingLink:     b.meetingLink,
    });

    return {
      generatedAt:      nowUtc.toISOString(),
      summary: {
        totalBookings:     totalCount,
        confirmedBookings: confirmedCount,
        cancelledBookings: cancelledCount,
      },
      upcomingConfirmed:  upcomingRaw.map(toDto),
      recentlyCancelled:  cancelledRaw.map(toDto),
      mentorUtilization,
    };
  }
}
