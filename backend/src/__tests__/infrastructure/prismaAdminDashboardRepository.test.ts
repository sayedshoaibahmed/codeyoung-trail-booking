import { describe, it, expect, vi } from 'vitest';
import { PrismaAdminDashboardRepository } from '../../infrastructure/database/PrismaAdminDashboardRepository';
import { BookingStatus } from '@prisma/client';

describe('PrismaAdminDashboardRepository booking times', () => {
  it('maps stored mentorTimezone onto admin booking summaries', async () => {
    const booking = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      parentName: 'Priya Shah',
      parentEmail: 'priya@example.com',
      childName: 'Aarav Shah',
      mentorId: 'mentor-1',
      startTimeUtc: new Date('2024-11-04T15:00:00.000Z'),
      endTimeUtc: new Date('2024-11-04T16:00:00.000Z'),
      mentorTimezone: 'Asia/Kolkata',
      mentorLocalDate: '2024-11-04',
      status: BookingStatus.CONFIRMED,
      cancelledAt: null,
      meetingLink: '/class/550e8400-e29b-41d4-a716-446655440000',
    };

    const db = {
      booking: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([booking]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      mentor: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const repo = new PrismaAdminDashboardRepository(db as never);
    const data = await repo.getDashboardData(new Date('2024-11-04T00:00:00.000Z'));

    expect(data.upcomingConfirmed[0].startTimeUtc).toBe('2024-11-04T15:00:00.000Z');
    expect(data.upcomingConfirmed[0].endTimeUtc).toBe('2024-11-04T16:00:00.000Z');
    expect(data.upcomingConfirmed[0].mentorTimezone).toBe('Asia/Kolkata');
    expect(data.upcomingConfirmed[0].mentorLocalDate).toBe('2024-11-04');
  });
});
