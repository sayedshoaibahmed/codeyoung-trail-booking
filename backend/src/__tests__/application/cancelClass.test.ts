/**
 * Unit tests for CancelClassUseCase
 *
 * All ports are mocked. bcrypt.hash is used to create a real token hash for
 * positive test cases; bcrypt.compare inside the use case then validates it.
 *
 * Covered scenarios:
 *   - Successful cancellation (happy path)
 *   - Cancellation already done (idempotent — returns controlled result)
 *   - Booking not found (404 domain error)
 *   - Invalid cancellation token (401 domain error)
 *   - Cancellation after class start (409 domain error)
 *   - Email failure does NOT surface to caller
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hash as bcryptHash } from 'bcrypt';
import { CancelClassUseCase, type CancelClassResult } from '../../application/useCases/CancelClass';
import { LuxonTimezoneService }     from '../../infrastructure/timezone/LuxonTimezoneService';
import type { UnitOfWork, TransactionContext } from '../../application/ports/UnitOfWork';
import type { BookingRepository }   from '../../application/ports/BookingRepository';
import type { MentorRepository }    from '../../application/ports/MentorRepository';
import type { EmailService }        from '../../application/ports/EmailService';
import type { Booking }             from '../../domain/entities/Booking';
import { BookingStatus }            from '../../domain/entities/Booking';
import { MentorShiftType }          from '../../domain/entities/Mentor';
import {
  BookingNotFoundError,
  CancellationTokenInvalidError,
  CancellationAfterStartError,
} from '../../domain/errors';

// ── Constants ──────────────────────────────────────────────────────────────────

// Fixed "now": 2024-11-04T08:00:00Z
// Slot:         2024-11-04T10:00:00Z → well in the future (2h away)
const FIXED_NOW = '2024-11-04T08:00:00Z';
const SLOT_START = new Date('2024-11-04T10:00:00Z');
const SLOT_END   = new Date('2024-11-04T11:00:00Z');
const PAST_SLOT_START = new Date('2024-11-04T06:00:00Z'); // before FIXED_NOW
const PAST_SLOT_END   = new Date('2024-11-04T07:00:00Z');

const RAW_TOKEN = 'correct-raw-token-for-testing-purposes-must-be-long-enough';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTzService(nowIso: string = FIXED_NOW) {
  return new LuxonTimezoneService(() => new Date(nowIso));
}

function buildEmailService(): EmailService {
  return {
    sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    sendBookingCancellation: vi.fn().mockResolvedValue(undefined),
  };
}

async function makeBooking(overrides: Partial<Booking> = {}): Promise<Booking> {
  const tokenHash = await bcryptHash(RAW_TOKEN, 10);
  return {
    id:                    'booking-uuid-1234',
    mentorId:              'mentor-uuid-1234',
    parentName:            'Alice',
    parentEmail:           'alice@example.com',
    childName:             'Bob',
    parentTimezone:        'Asia/Kolkata',
    startTimeUtc:          SLOT_START,
    endTimeUtc:            SLOT_END,
    mentorTimezone:        'Asia/Kolkata',
    mentorLocalDate:       '2024-11-04',
    meetingLink:           'https://meet.codeyoung.com/class/booking-uuid-1234',
    status:                BookingStatus.CONFIRMED,
    cancellationTokenHash: tokenHash,
    cancelledAt:           null,
    idempotencyKey:        'key-1',
    createdAt:             new Date(),
    updatedAt:             new Date(),
    ...overrides,
  };
}

function buildBookingRepo(booking: Booking | null): BookingRepository {
  return {
    findById:          vi.fn().mockResolvedValue(booking),
    findByIdForUpdate: vi.fn().mockResolvedValue(booking),
    create:            vi.fn(),
    cancel:            vi.fn().mockImplementation(async (id: string, cancelledAt: Date): Promise<Booking> => ({
      ...booking!,
      status:      BookingStatus.CANCELLED,
      cancelledAt,
    })),
    findAll: vi.fn().mockResolvedValue([]),
  };
}

function buildMentorRepo(): MentorRepository {
  return {
    findById:            vi.fn().mockResolvedValue({ id: 'mentor-1', name: 'Test Mentor', email: 'm@t.com', timezone: 'Asia/Kolkata', shift: MentorShiftType.SHIFT_1, active: true, createdAt: new Date(), updatedAt: new Date() }),
    findAll:             vi.fn().mockResolvedValue([]),
    findEligibleMentors: vi.fn().mockResolvedValue([]),
  };
}

function buildUoW(bookingRepo: BookingRepository): UnitOfWork {
  return {
    run: async (fn) => fn({
      mentorRepo: buildMentorRepo() as unknown as import('../../application/ports/MentorRepository').MentorRepository,
      bookingRepo,
      idempotencyStore: {
        findByKey: vi.fn(),
        create: vi.fn(),
      },
    } as TransactionContext),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CancelClassUseCase — happy path', () => {
  it('cancels a CONFIRMED booking and returns CANCELLED result', async () => {
    const booking     = await makeBooking();
    const bookingRepo = buildBookingRepo(booking);
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    const result = await uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN });

    expect(result.status).toBe('CANCELLED');
    expect(result.bookingId).toBe(booking.id);
    expect(result.alreadyCancelled).toBe(false);
    expect(result.cancelledAt).toBeDefined();
    expect(() => new Date(result.cancelledAt)).not.toThrow();
  });

  it('calls bookingRepo.cancel with the correct arguments', async () => {
    const booking     = await makeBooking();
    const bookingRepo = buildBookingRepo(booking);
    const cancelSpy   = bookingRepo.cancel as ReturnType<typeof vi.fn>;
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN });

    expect(cancelSpy).toHaveBeenCalledWith(booking.id, expect.any(Date));
  });
});

describe('CancelClassUseCase — idempotency (already cancelled)', () => {
  it('returns alreadyCancelled=true for a CANCELLED booking with valid token', async () => {
    const alreadyCancelledAt = new Date('2024-11-04T09:00:00Z');
    const booking = await makeBooking({
      status:      BookingStatus.CANCELLED,
      cancelledAt: alreadyCancelledAt,
    });
    const bookingRepo = buildBookingRepo(booking);
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    const result = await uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN });

    expect(result.status).toBe('CANCELLED');
    expect(result.alreadyCancelled).toBe(true);
    expect(result.cancelledAt).toBe(alreadyCancelledAt.toISOString());
  });

  it('does NOT call bookingRepo.cancel when already cancelled', async () => {
    const booking = await makeBooking({ status: BookingStatus.CANCELLED, cancelledAt: new Date() });
    const bookingRepo = buildBookingRepo(booking);
    const cancelSpy   = bookingRepo.cancel as ReturnType<typeof vi.fn>;
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN });

    expect(cancelSpy).not.toHaveBeenCalled();
  });
});

describe('CancelClassUseCase — booking not found', () => {
  it('throws BookingNotFoundError when booking does not exist', async () => {
    const bookingRepo = buildBookingRepo(null);
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await expect(
      uc.execute({ bookingId: 'nonexistent-id', cancellationToken: RAW_TOKEN }),
    ).rejects.toThrow(BookingNotFoundError);
  });
});

describe('CancelClassUseCase — invalid token', () => {
  it('throws CancellationTokenInvalidError for a wrong token', async () => {
    const booking     = await makeBooking();
    const bookingRepo = buildBookingRepo(booking);
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await expect(
      uc.execute({ bookingId: booking.id, cancellationToken: 'wrong-token' }),
    ).rejects.toThrow(CancellationTokenInvalidError);
  });

  it('does NOT cancel the booking when token is invalid', async () => {
    const booking     = await makeBooking();
    const bookingRepo = buildBookingRepo(booking);
    const cancelSpy   = bookingRepo.cancel as ReturnType<typeof vi.fn>;
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await uc.execute({ bookingId: booking.id, cancellationToken: 'wrong' }).catch(() => {});
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});

describe('CancelClassUseCase — cancellation after class start', () => {
  it('throws CancellationAfterStartError when class has already started', async () => {
    // Slot is in the PAST relative to FIXED_NOW
    const booking     = await makeBooking({ startTimeUtc: PAST_SLOT_START, endTimeUtc: PAST_SLOT_END });
    const bookingRepo = buildBookingRepo(booking);
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await expect(
      uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN }),
    ).rejects.toThrow(CancellationAfterStartError);
  });

  it('does NOT cancel the booking when class has started', async () => {
    const booking     = await makeBooking({ startTimeUtc: PAST_SLOT_START, endTimeUtc: PAST_SLOT_END });
    const bookingRepo = buildBookingRepo(booking);
    const cancelSpy   = bookingRepo.cancel as ReturnType<typeof vi.fn>;
    const uow         = buildUoW(bookingRepo);

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), buildEmailService());
    await uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN }).catch(() => {});
    expect(cancelSpy).not.toHaveBeenCalled();
  });
});

describe('CancelClassUseCase — email failure', () => {
  it('does NOT surface an email failure to the caller', async () => {
    const booking     = await makeBooking();
    const bookingRepo = buildBookingRepo(booking);
    const uow         = buildUoW(bookingRepo);

    const failingEmail: EmailService = {
      sendBookingConfirmation: vi.fn(),
      sendBookingCancellation: vi.fn().mockRejectedValue(new Error('SMTP down')),
    };

    const uc = new CancelClassUseCase(uow, bookingRepo, buildMentorRepo(), buildTzService(), failingEmail);
    await expect(
      uc.execute({ bookingId: booking.id, cancellationToken: RAW_TOKEN }),
    ).resolves.toBeDefined();
  });
});
