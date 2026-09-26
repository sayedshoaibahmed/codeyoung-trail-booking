/**
 * Port — AdminDashboardRepository
 *
 * A read-model port for the admin dashboard. Returns pre-aggregated data
 * that would be expensive to assemble from individual domain repository calls.
 *
 * Bypasses heavy domain logic (validation, lead-time checks) because this is
 * read-only. Still goes through a port — the interface layer NEVER imports Prisma.
 */

export interface BookingSummaryDto {
  id: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  mentorId: string;
  startTimeUtc: string;   // ISO-8601
  endTimeUtc: string;     // ISO-8601
  mentorLocalDate: string;
  status: string;
  cancelledAt: string | null;
  meetingLink: string;
}

export interface MentorUtilizationDto {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  shift: string;
  confirmedCount: number;
  cancelledCount: number;
}

export interface AdminDashboardData {
  generatedAt: string;   // ISO-8601 UTC
  summary: {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
  };
  /** Next 10 upcoming CONFIRMED classes (startTimeUtc ≥ nowUtc), asc by start */
  upcomingConfirmed: BookingSummaryDto[];
  /** 5 most recently cancelled bookings */
  recentlyCancelled: BookingSummaryDto[];
  /** Per-mentor booking totals */
  mentorUtilization: MentorUtilizationDto[];
}

export interface AdminDashboardRepository {
  getDashboardData(nowUtc: Date): Promise<AdminDashboardData>;
}
