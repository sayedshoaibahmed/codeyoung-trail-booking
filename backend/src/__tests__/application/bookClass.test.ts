/**
 * Unit tests for BookClassUseCase
 *
 * All ports are mocked. The LuxonTimezoneService is used with a fixed clock
 * so timezone conversions are deterministic. No database or HTTP involved.
 *
 * Covered scenarios:
 *   - Successful booking (happy path)
 *   - Idempotency: same key + same payload → original result
 *   - Idempotency: same key + different payload → IdempotencyConflictError
 *   - Lead time violation
 *   - No eligible mentor → SlotNotAvailableError
 *   - Double booking (P2002 from UoW) → SlotNotAvailableError with alternates
 *   - Daily cap reached → SlotNotAvailableError
 *   - Concurrent last slot (P2034) → SlotNotAvailableError
 *   - Least-loaded mentor selection
 *   - Email failure does NOT surface to caller
 */
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { BookClassUseCase, type BookClassDto, type BookClassResult } from '../../application/useCases/BookClass';
import { LuxonTimezoneService } from '../../infrastructure/timezone/LuxonTimezoneService';
import type { UnitOfWork, TransactionContext } from '../../application/ports/UnitOfWork';
import type { IdempotencyStore, IdempotencyRecord, CreateIdempotencyData } from '../../application/ports/IdempotencyStore';
import type { MentorRepository, MentorWithDayCount } from '../../application/ports/MentorRepository';
import type { BookingRepository, CreateBookingData } from '../../application/ports/BookingRepository';
import type { EmailService } from '../../application/ports/EmailService';
import type { Booking } from '../../domain/entities/Booking';
import { BookingStatus, MentorShiftType } from '../../domain';
import {
  LeadTimeViolationError,
  IdempotencyConflictError,
  SlotNotAvailableError,
  SlotOutsideShiftError,
} from '../../domain/errors';

// ── Fixed clock ───────────────────────────────────────────────────────────────
// "now" = 2024-11-04T00:00:00Z (midnight UTC = 05:30 IST = Shift 2 just ended)
// All requested slots are well in the future.
const FIXED_NOW = '2024-11-04T00:00:00Z';

// ── Test slot: IST 10:00 on Nov 4 = UTC 04:30 (Shift 1) ─────────────────────
const IST_SLOT_START_ISO = '2024-11-04T10:00:00';          // local in IST
const SLOT_START_UTC     = new Date('2024-11-04T04:30:00Z');
const SLOT_END_UTC       = new Date('2024-11-04T05:30:00Z');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMentor(id: string, dayCount = 0): MentorWithDayCount {
  return {
    mentor: {
      id,
      name: `Mentor ${id}`,
      email: `${id}@codeyoung.com`,
      timezone: 'Asia/Kolkata',
      shift: MentorShiftType.SHIFT_1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    dayCount,
  };
}

function makeBooking(id: string, mentorId: string): Booking {
  return {
    id,
    mentorId,
    parentName: 'Test Parent',
    parentEmail: 'parent@test.com',
    childName: 'Test Child',
    parentTimezone: 'Asia/Kolkata',
    startTimeUtc: SLOT_START_UTC,
    endTimeUtc: SLOT_END_UTC,
    mentorTimezone: 'Asia/Kolkata',
    mentorLocalDate: '2024-11-04',
    meetingLink: `/class/${id}`,
    status: BookingStatus.CONFIRMED,
    cancellationTokenHash: 'hash',
    accessTokenHash: 'access-hash',
    cancelledAt: null,
    idempotencyKey: 'key-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeResult(bookingId: string, mentorName: string): BookClassResult {
  return {
    bookingId,
    mentorName,
    startUtc: SLOT_START_UTC.toISOString(),
    endUtc: SLOT_END_UTC.toISOString(),
    meetingLink: `/class/${bookingId}`,
    cancellationToken: 'raw-token-abc',
    accessToken: 'raw-access-abc',
    status: 'CONFIRMED',
  };
}

function makeIdempotencyRecord(
  key: string,
  payloadHash: string,
  result: BookClassResult,
): IdempotencyRecord {
  return {
    key,
    payloadHash,
    responseJson: JSON.stringify(result),
    bookingId: result.bookingId,
    createdAt: new Date(),
  };
}

// ── Mock builders ─────────────────────────────────────────────────────────────

function buildTzService() {
  return new LuxonTimezoneService(() => new Date(FIXED_NOW));
}

function buildEmailService(): EmailService {
  return {
    sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    sendBookingCancellation: vi.fn().mockResolvedValue(undefined),
    sendMentorBookingNotification: vi.fn().mockResolvedValue(undefined),
  };
}

function buildBookingRepo(booking: Booking): BookingRepository {
  return {
    create:            vi.fn().mockImplementation(async (data: CreateBookingData): Promise<Booking> => ({
      ...booking,
      id:                    data.id,
      mentorId:              data.mentorId,
      parentName:            data.parentName,
      parentEmail:           data.parentEmail,
      childName:             data.childName,
      parentTimezone:        data.parentTimezone,
      startTimeUtc:          data.startTimeUtc,
      endTimeUtc:            data.endTimeUtc,
      mentorTimezone:        data.mentorTimezone,
      mentorLocalDate:       data.mentorLocalDate,
      meetingLink:           data.meetingLink,
      cancellationTokenHash: data.cancellationTokenHash,
      accessTokenHash:       data.accessTokenHash,
      idempotencyKey:        data.idempotencyKey,
    })),
    findById:              vi.fn().mockResolvedValue(null),
    findByAccessTokenHash: vi.fn().mockResolvedValue(null),
    findByIdForUpdate:     vi.fn().mockResolvedValue(null),
    cancel:            vi.fn().mockResolvedValue(booking),
    findAll:           vi.fn().mockResolvedValue([]),
  };
}

function buildIdempotencyStore(existing: IdempotencyRecord | null = null): IdempotencyStore {
  return {
    findByKey: vi.fn().mockResolvedValue(existing),
    create:    vi.fn().mockImplementation(async (data: CreateIdempotencyData): Promise<IdempotencyRecord> => ({
      key:          data.key,
      payloadHash:  data.payloadHash,
      responseJson: data.responseJson,
      bookingId:    data.bookingId,
      createdAt:    new Date(),
    })),
  };
}

/**
 * Builds a UnitOfWork whose callback receives the provided transaction-scoped repos.
 * Simulates a successful transaction.
 */
function buildUoW(
  mentorRepo: MentorRepository,
  bookingRepo: BookingRepository,
  idempotencyStore: IdempotencyStore,
): UnitOfWork {
  return {
    run: async (fn) => fn({ mentorRepo, bookingRepo, idempotencyStore }),
  };
}

/**
 * UoW that throws a Prisma error code (simulates DB-level constraint or serialization failure).
 */
function buildThrowingUoW(code: string): UnitOfWork {
  return {
    run: async () => {
      const err = new Error('DB error');
      (err as unknown as Record<string, unknown>).code = code;
      throw err;
    },
  };
}

// Standard DTO for most tests
const BASE_DTO: BookClassDto = {
  parentName:        'Alice Smith',
  parentEmail:       'alice@example.com',
  childName:         'Bob Smith',
  parentTimezone:    'Asia/Kolkata',
  requestedStartIso: IST_SLOT_START_ISO,
  idempotencyKey:    'idempotency-key-1',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BookClassUseCase — happy path', () => {
  it('creates a booking and returns result with raw cancellation token', async () => {
    const booking     = makeBooking('booking-1', 'mentor-a');
    const mentorRepo  = { findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]), findById: vi.fn(), findAll: vi.fn() } as unknown as MentorRepository;
    const bookingRepo = buildBookingRepo(booking);
    const idemStore   = buildIdempotencyStore();
    const uow         = buildUoW(mentorRepo, bookingRepo, idemStore);

    const previousOrigin = process.env.FRONTEND_ORIGIN;
    delete process.env.FRONTEND_ORIGIN;
    try {
      const email = buildEmailService();
      const uc = new BookClassUseCase(uow, idemStore, buildTzService(), email, mentorRepo);
      const result = await uc.execute(BASE_DTO);

      expect(result.status).toBe('CONFIRMED');
      expect(result.bookingId).toBeDefined();
      expect(result.cancellationToken).toBeDefined();
      expect(result.cancellationToken.length).toBeGreaterThan(0);
      expect(result.accessToken).toBeDefined();
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(result.accessToken).not.toBe(result.cancellationToken);
      const createCall = (bookingRepo.create as MockedFunction<BookingRepository['create']>).mock.calls[0][0];
      expect(createCall.accessTokenHash).not.toBe(result.accessToken);
      expect(createCall.accessTokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(createCall.cancellationTokenHash).not.toBe(result.cancellationToken);
      expect(result.meetingLink).toBe(`/class/${result.bookingId}`);
      expect(result.meetingLink).not.toContain('meet.codeyoung.com');
      expect(result.mentorName).toBe('Mentor mentor-a');
      expect(email.sendBookingConfirmation).toHaveBeenCalled();
      const mail = (email.sendBookingConfirmation as MockedFunction<EmailService['sendBookingConfirmation']>)
        .mock.calls[0][0];
      expect(mail.viewBookingUrl).toBe(`/b/${result.accessToken}`);
      expect(mail.rawCancellationToken).toBe(result.cancellationToken);
      expect(mail.viewBookingUrl).not.toContain(result.cancellationToken);
      expect(email.sendMentorBookingNotification).toHaveBeenCalled();
      const mentorMail = (
        email.sendMentorBookingNotification as MockedFunction<EmailService['sendMentorBookingNotification']>
      ).mock.calls[0][0];
      expect(mentorMail.mentorEmail).toBe('mentor-a@codeyoung.com');
      expect(mentorMail.mentorName).toBe('Mentor mentor-a');
      expect(mentorMail.booking.id).toBe(result.bookingId);
      expect(mentorMail).not.toHaveProperty('rawCancellationToken');
      expect(JSON.stringify(mentorMail)).not.toContain(result.cancellationToken);
    } finally {
      if (previousOrigin === undefined) {
        delete process.env.FRONTEND_ORIGIN;
      } else {
        process.env.FRONTEND_ORIGIN = previousOrigin;
      }
    }
  });

  it('prefixes the dummy classroom path with FRONTEND_ORIGIN when set', async () => {
    const previousOrigin = process.env.FRONTEND_ORIGIN;
    process.env.FRONTEND_ORIGIN = 'https://codeyoung-trail-booking.vercel.app/';
    try {
      const booking     = makeBooking('booking-1', 'mentor-a');
      const mentorRepo  = { findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]), findById: vi.fn(), findAll: vi.fn() } as unknown as MentorRepository;
      const bookingRepo = buildBookingRepo(booking);
      const idemStore   = buildIdempotencyStore();
      const uow         = buildUoW(mentorRepo, bookingRepo, idemStore);

      const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
      const result = await uc.execute({ ...BASE_DTO, idempotencyKey: 'idempotency-key-origin' });

      expect(result.meetingLink).toBe(
        `https://codeyoung-trail-booking.vercel.app/class/${result.bookingId}`,
      );
      expect(result.meetingLink).not.toContain('meet.codeyoung.com');
    } finally {
      if (previousOrigin === undefined) {
        delete process.env.FRONTEND_ORIGIN;
      } else {
        process.env.FRONTEND_ORIGIN = previousOrigin;
      }
    }
  });

  it('passes correct slot UTC times to findEligibleMentors', async () => {
    const booking     = makeBooking('booking-1', 'mentor-a');
    const findEligible = vi.fn().mockResolvedValue([makeMentor('mentor-a')]);
    const mentorRepo  = { findEligibleMentors: findEligible, findById: vi.fn(), findAll: vi.fn() } as unknown as MentorRepository;
    const bookingRepo = buildBookingRepo(booking);
    const idemStore   = buildIdempotencyStore();
    const uow         = buildUoW(mentorRepo, bookingRepo, idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    await uc.execute(BASE_DTO);

    const callArgs = findEligible.mock.calls[0][0];
    // IST 10:00 Nov 4 = UTC 04:30 Nov 4
    expect(callArgs.slotStartUtc.toISOString()).toBe('2024-11-04T04:30:00.000Z');
    expect(callArgs.slotEndUtc.toISOString()).toBe('2024-11-04T05:30:00.000Z');
    expect(callArgs.shift).toBe(MentorShiftType.SHIFT_1);
    expect(callArgs.mentorLocalDate).toBe('2024-11-04');
    expect(callArgs.dailyCap).toBe(2);
  });
});

// ── Lead time ─────────────────────────────────────────────────────────────────

describe('BookClassUseCase — lead time', () => {
  it('rejects a slot within 2 hours of now', async () => {
    // now = 2024-11-04T00:00:00Z, slot = 2024-11-04T01:00:00 IST = 2024-11-03T19:30:00Z (in the past)
    // Use a slot that is only 1 hour in the future:
    // IST 01:30 = UTC 20:00 previous day... let's use a slot 1 hour in the future in IST terms
    // now IST = 2024-11-04T05:30:00+05:30 → slot must be >= 07:30 IST
    const mentorRepo  = { findEligibleMentors: vi.fn(), findById: vi.fn(), findAll: vi.fn() } as unknown as MentorRepository;
    const idemStore   = buildIdempotencyStore();
    const uow         = buildUoW(mentorRepo, buildBookingRepo(makeBooking('b1', 'm1')), idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);

    // IST 06:00 is only 30 min from now (IST 05:30) — fails lead time
    await expect(
      uc.execute({ ...BASE_DTO, requestedStartIso: '2024-11-04T06:00:00' }),
    ).rejects.toThrow(LeadTimeViolationError);
  });
});

// ── Idempotency ───────────────────────────────────────────────────────────────

describe('BookClassUseCase — idempotency', () => {
  it('returns original result on same key + same payload', async () => {
    const originalResult = makeResult('original-booking-id', 'Mentor mentor-a');
    // Build a "real" idempotency record that would have been stored
    // We need the real payload hash — compute it the same way the use case does
    const { createHash } = await import('crypto');
    const body = {
      parentName:        BASE_DTO.parentName,
      parentEmail:       BASE_DTO.parentEmail,
      childName:         BASE_DTO.childName,
      parentTimezone:    BASE_DTO.parentTimezone,
      requestedStartIso: BASE_DTO.requestedStartIso,
    };
    const sorted: Record<string, string> = {};
    for (const k of Object.keys(body).sort()) sorted[k] = (body as Record<string, string>)[k];
    const hash = createHash('sha256').update(JSON.stringify(sorted)).digest('hex');

    const record = makeIdempotencyRecord(BASE_DTO.idempotencyKey, hash, originalResult);
    const idemStore = buildIdempotencyStore(record);
    const mentorRepo = { findEligibleMentors: vi.fn(), findById: vi.fn(), findAll: vi.fn() } as unknown as MentorRepository;
    const uow = buildUoW(mentorRepo, buildBookingRepo(makeBooking('b1', 'm1')), idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    const result = await uc.execute(BASE_DTO);

    expect(result.bookingId).toBe('original-booking-id');
    // findEligibleMentors must NOT have been called (early return)
    expect(mentorRepo.findEligibleMentors).not.toHaveBeenCalled();
  });

  it('throws IdempotencyConflictError on same key + different payload', async () => {
    const existingResult = makeResult('other-booking', 'Mentor other');
    const record = makeIdempotencyRecord(
      BASE_DTO.idempotencyKey,
      'different-hash-0000000000000000000000000000000000000000000000000000000000',
      existingResult,
    );
    const idemStore  = buildIdempotencyStore(record);
    const mentorRepo = { findEligibleMentors: vi.fn(), findById: vi.fn(), findAll: vi.fn() } as unknown as MentorRepository;
    const uow        = buildUoW(mentorRepo, buildBookingRepo(makeBooking('b1', 'm1')), idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(IdempotencyConflictError);
  });
});

// ── No mentor available ────────────────────────────────────────────────────────

describe('BookClassUseCase — no eligible mentor', () => {
  it('throws SlotNotAvailableError when findEligibleMentors returns empty', async () => {
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const idemStore  = buildIdempotencyStore();
    const bookRepo   = buildBookingRepo(makeBooking('b1', 'm1'));
    const uow        = buildUoW(mentorRepo, bookRepo, idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(SlotNotAvailableError);
  });

  it('SlotNotAvailableError carries alternateSlots array (possibly empty)', async () => {
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const idemStore = buildIdempotencyStore();
    const uow       = buildUoW(mentorRepo, buildBookingRepo(makeBooking('b1', 'm1')), idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    try {
      await uc.execute(BASE_DTO);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SlotNotAvailableError);
      expect((err as SlotNotAvailableError).alternateSlots).toBeInstanceOf(Array);
    }
  });
});

// ── Double booking (P2002 from unique index) ─────────────────────────────────

describe('BookClassUseCase — double booking (P2002)', () => {
  it('maps P2002 (unique constraint) to SlotNotAvailableError', async () => {
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const idemStore = buildIdempotencyStore();
    const throwingUoW = buildThrowingUoW('P2002');

    const email = buildEmailService();
    const uc = new BookClassUseCase(throwingUoW, idemStore, buildTzService(), email, mentorRepo);
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(SlotNotAvailableError);
    expect(email.sendBookingConfirmation).not.toHaveBeenCalled();
    expect(email.sendMentorBookingNotification).not.toHaveBeenCalled();
  });
});

// ── Concurrent last slot (P2034 serialization failure) ───────────────────────

describe('BookClassUseCase — concurrent last slot (P2034)', () => {
  it('maps P2034 (serialization failure) to SlotNotAvailableError', async () => {
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const idemStore = buildIdempotencyStore();
    const throwingUoW = buildThrowingUoW('P2034');

    const uc = new BookClassUseCase(throwingUoW, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(SlotNotAvailableError);
  });
});

// ── Daily cap ─────────────────────────────────────────────────────────────────

describe('BookClassUseCase — daily cap', () => {
  it('throws SlotNotAvailableError when all mentors are at daily cap (simulated by empty eligible list)', async () => {
    // The cap check is inside findEligibleMentors (repo layer). When all mentors
    // are at cap=2, the repo returns [] → same as "no mentor" case.
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const idemStore = buildIdempotencyStore();
    const uow       = buildUoW(mentorRepo, buildBookingRepo(makeBooking('b1', 'm1')), idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(SlotNotAvailableError);
  });
});

// ── Least-loaded mentor selection ─────────────────────────────────────────────

describe('BookClassUseCase — least-loaded mentor selection', () => {
  it('picks mentor with the lowest dayCount (first in sorted list)', async () => {
    // mentorRepo returns [mentor-B (dayCount=1), mentor-A (dayCount=0)] — sorted by repo
    // The repo already sorts asc by dayCount, so [mentor-A first] is what we pass.
    const mentorA = makeMentor('mentor-a', 0); // least loaded
    const mentorB = makeMentor('mentor-b', 1);

    const booking    = makeBooking('booking-1', 'mentor-a');
    const createSpy  = vi.fn().mockResolvedValue(booking);
    const mentorRepo = {
      // Repo returns sorted asc: mentor-a (0) first, mentor-b (1) second
      findEligibleMentors: vi.fn().mockResolvedValue([mentorA, mentorB]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const bookingRepo: BookingRepository = {
      create:            createSpy,
      findById:          vi.fn(),
      findByAccessTokenHash: vi.fn(),
      findByIdForUpdate: vi.fn(),
      cancel:            vi.fn(),
      findAll:           vi.fn(),
    };
    const idemStore = buildIdempotencyStore();
    const uow       = buildUoW(mentorRepo, bookingRepo, idemStore);

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), buildEmailService(), mentorRepo);
    const result = await uc.execute(BASE_DTO);

    // The selected mentor must be mentor-a (least loaded, dayCount=0)
    const createCall = (createSpy.mock.calls[0][0] as CreateBookingData);
    expect(createCall.mentorId).toBe('mentor-a');
    expect(result.mentorName).toBe('Mentor mentor-a');
  });
});

// ── Email failure isolation ───────────────────────────────────────────────────

describe('BookClassUseCase — email failure', () => {
  it('does NOT surface an email error to the caller', async () => {
    const booking    = makeBooking('booking-1', 'mentor-a');
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const bookingRepo = buildBookingRepo(booking);
    const idemStore   = buildIdempotencyStore();
    const uow         = buildUoW(mentorRepo, bookingRepo, idemStore);

    const failingEmail: EmailService = {
      sendBookingConfirmation: vi.fn().mockRejectedValue(new Error('SMTP failure')),
      sendBookingCancellation: vi.fn(),
      sendMentorBookingNotification: vi.fn().mockResolvedValue(undefined),
    };

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), failingEmail, mentorRepo);
    await expect(uc.execute(BASE_DTO)).resolves.toBeDefined();
    expect(failingEmail.sendMentorBookingNotification).toHaveBeenCalled();
  });

  it('does NOT fail the booking when mentor notification throws', async () => {
    const booking    = makeBooking('booking-1', 'mentor-a');
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const bookingRepo = buildBookingRepo(booking);
    const idemStore   = buildIdempotencyStore();
    const uow         = buildUoW(mentorRepo, bookingRepo, idemStore);

    const failingEmail: EmailService = {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
      sendBookingCancellation: vi.fn(),
      sendMentorBookingNotification: vi.fn().mockRejectedValue(new Error('mentor SMTP failure')),
    };

    const uc = new BookClassUseCase(uow, idemStore, buildTzService(), failingEmail, mentorRepo);
    await expect(uc.execute(BASE_DTO)).resolves.toBeDefined();
    expect(failingEmail.sendBookingConfirmation).toHaveBeenCalled();
  });

  it('still attempts the other email when one send rejects', async () => {
    const booking    = makeBooking('booking-1', 'mentor-a');
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll:  vi.fn(),
    } as unknown as MentorRepository;
    const bookingRepo = buildBookingRepo(booking);
    const idemStore   = buildIdempotencyStore();
    const uow         = buildUoW(mentorRepo, bookingRepo, idemStore);

    const parentFirst: EmailService = {
      sendBookingConfirmation: vi.fn().mockRejectedValue(new Error('parent fail')),
      sendBookingCancellation: vi.fn(),
      sendMentorBookingNotification: vi.fn().mockResolvedValue(undefined),
    };
    await expect(
      new BookClassUseCase(uow, idemStore, buildTzService(), parentFirst, mentorRepo).execute({
        ...BASE_DTO,
        idempotencyKey: 'email-isolation-parent',
      }),
    ).resolves.toBeDefined();
    expect(parentFirst.sendMentorBookingNotification).toHaveBeenCalled();

    const mentorFirst: EmailService = {
      sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
      sendBookingCancellation: vi.fn(),
      sendMentorBookingNotification: vi.fn().mockRejectedValue(new Error('mentor fail')),
    };
    await expect(
      new BookClassUseCase(uow, idemStore, buildTzService(), mentorFirst, mentorRepo).execute({
        ...BASE_DTO,
        idempotencyKey: 'email-isolation-mentor',
      }),
    ).resolves.toBeDefined();
    expect(mentorFirst.sendBookingConfirmation).toHaveBeenCalled();
  });
});

describe('BookClassUseCase — shift containment', () => {
  it('rejects a class that starts in Shift 1 but ends after 21:00 IST', async () => {
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll: vi.fn(),
    } as unknown as MentorRepository;
    const uc = new BookClassUseCase(
      buildUoW(mentorRepo, buildBookingRepo(makeBooking('b1', 'mentor-a')), buildIdempotencyStore()),
      buildIdempotencyStore(),
      buildTzService(),
      buildEmailService(),
      mentorRepo,
    );

    // 20:30–21:30 IST crosses the Shift 1 boundary.
    await expect(
      uc.execute({ ...BASE_DTO, requestedStartIso: '2024-11-04T20:30:00', idempotencyKey: 'outside-shift' }),
    ).rejects.toThrow(SlotOutsideShiftError);
    expect(mentorRepo.findEligibleMentors).not.toHaveBeenCalled();
  });
});

describe('BookClassUseCase — idempotency race with a different payload', () => {
  it('maps a P2002 on an existing key with a different hash to IdempotencyConflictError', async () => {
    const mentorRepo = {
      findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('mentor-a')]),
      findById: vi.fn(),
      findAll: vi.fn(),
    } as unknown as MentorRepository;
    const stored = makeIdempotencyRecord(
      'idempotency-key-1',
      'different-hash',
      makeResult('booking-existing', 'Mentor mentor-a'),
    );
    const idemStore = buildIdempotencyStore(null);
    // First lookup (pre-check) misses; the insert then collides and the retry finds the other payload.
    vi.mocked(idemStore.findByKey)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored);

    const uc = new BookClassUseCase(
      buildThrowingUoW('P2002'),
      idemStore,
      buildTzService(),
      buildEmailService(),
      mentorRepo,
    );

    await expect(uc.execute(BASE_DTO)).rejects.toThrow(IdempotencyConflictError);
  });
});
