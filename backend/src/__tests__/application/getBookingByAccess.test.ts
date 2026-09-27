import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GetBookingByAccessUseCase } from '../../application/useCases/GetBookingByAccess';
import { hashBookingAccessToken } from '../../application/services/bookingAccessToken';
import { BookingLinkInvalidError } from '../../domain/errors';
import { BookingStatus } from '../../domain';
import type { Booking } from '../../domain/entities/Booking';
import type { BookingRepository } from '../../application/ports/BookingRepository';
import type { MentorRepository } from '../../application/ports/MentorRepository';
import { MentorShiftType } from '../../domain';

const RAW_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const RAW_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function makeBooking(id: string, accessTokenHash: string): Booking {
  return {
    id,
    mentorId: 'mentor-1',
    parentName: 'Priya Shah',
    parentEmail: 'priya@example.com',
    childName: 'Aarav Shah',
    parentTimezone: 'America/New_York',
    startTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
    endTimeUtc: new Date('2024-11-04T05:30:00.000Z'),
    mentorTimezone: 'Asia/Kolkata',
    mentorLocalDate: '2024-11-04',
    meetingLink: `/class/${id}`,
    status: BookingStatus.CONFIRMED,
    cancellationTokenHash: 'cancel-hash',
    accessTokenHash,
    cancelledAt: null,
    idempotencyKey: 'key-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildMentorRepo(): MentorRepository {
  return {
    findById: vi.fn().mockResolvedValue({
      id: 'mentor-1',
      name: 'Aisha Sharma',
      email: 'aisha@codeyoung.com',
      timezone: 'Asia/Kolkata',
      shift: MentorShiftType.SHIFT_1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findAll: vi.fn(),
    findEligibleMentors: vi.fn(),
    loadAvailabilitySnapshot: vi.fn().mockResolvedValue({ mentors: [], confirmedBookings: [] }),
  };
}

describe('GetBookingByAccessUseCase', () => {
  it('returns the booking that matches the access credential', async () => {
    const booking = makeBooking('booking-a', hashBookingAccessToken(RAW_A));
    const bookingRepo: BookingRepository = {
      findByAccessTokenHash: vi.fn().mockResolvedValue(booking),
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      create: vi.fn(),
      cancel: vi.fn(),
      findAll: vi.fn(),
    };
    const uc = new GetBookingByAccessUseCase(bookingRepo, buildMentorRepo());
    const dto = await uc.execute({ accessToken: RAW_A });

    expect(dto.id).toBe('booking-a');
    expect(dto.childName).toBe('Aarav Shah');
    expect(dto.parentName).toBe('Priya Shah');
    expect(dto.mentorName).toBe('Aisha Sharma');
    expect(JSON.stringify(dto)).not.toContain(RAW_A);
    expect(JSON.stringify(dto)).not.toContain(booking.accessTokenHash);
    expect(JSON.stringify(dto)).not.toContain(booking.cancellationTokenHash);
    expect(bookingRepo.findByAccessTokenHash).toHaveBeenCalledWith(hashBookingAccessToken(RAW_A));
  });

  it('rejects an invalid credential with a generic error', async () => {
    const bookingRepo: BookingRepository = {
      findByAccessTokenHash: vi.fn().mockResolvedValue(null),
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      create: vi.fn(),
      cancel: vi.fn(),
      findAll: vi.fn(),
    };
    const uc = new GetBookingByAccessUseCase(bookingRepo, buildMentorRepo());
    await expect(uc.execute({ accessToken: 'not-a-real-token' })).rejects.toThrow(BookingLinkInvalidError);
    await expect(uc.execute({ accessToken: 'not-a-real-token' })).rejects.toThrow(
      'Booking link is invalid or has expired.',
    );
  });

  it('cannot use booking A credential to load booking B', async () => {
    const bookingB = makeBooking('booking-b', hashBookingAccessToken(RAW_B));
    const bookingRepo: BookingRepository = {
      findByAccessTokenHash: vi.fn().mockImplementation(async (hash: string) => {
        if (hash === hashBookingAccessToken(RAW_B)) return bookingB;
        return null;
      }),
      findById: vi.fn(),
      findByIdForUpdate: vi.fn(),
      create: vi.fn(),
      cancel: vi.fn(),
      findAll: vi.fn(),
    };
    const uc = new GetBookingByAccessUseCase(bookingRepo, buildMentorRepo());
    await expect(uc.execute({ accessToken: RAW_A })).rejects.toThrow(BookingLinkInvalidError);
    const dto = await uc.execute({ accessToken: RAW_B });
    expect(dto.id).toBe('booking-b');
  });
});

describe('booking-access credential hygiene', () => {
  it('never stores or logs the raw access credential in application/interface sources', () => {
    const root = join(__dirname, '../..');
    const files = [
      'application/useCases/BookClass.ts',
      'application/useCases/GetBookingByAccess.ts',
      'interfaces/routes/bookingAccessRouter.ts',
      'infrastructure/database/PrismaBookingRepository.ts',
      'infrastructure/email/MockEmailService.ts',
    ];
    for (const rel of files) {
      const src = readFileSync(join(root, rel), 'utf8');
      expect(src).not.toMatch(/console\.(log|info|debug|error|warn)\([^)]*rawAccessToken/);
      expect(src).not.toMatch(/console\.(log|info|debug|error|warn)\([^)]*accessToken[^H]/);
    }

    const bookClass = readFileSync(join(root, 'application/useCases/BookClass.ts'), 'utf8');
    expect(bookClass).toContain('accessTokenHash');
    expect(bookClass).toMatch(/hashBookingAccessToken\(rawAccessToken\)/);
    expect(bookClass).not.toMatch(/accessTokenHash:\s*rawAccessToken/);
  });
});
