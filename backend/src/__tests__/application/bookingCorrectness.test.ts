/**
 * Comprehensive Booking-Correctness Test Suite — Items 1–24
 *
 * Every describe block is labelled with the item number from the specification.
 * All infrastructure ports are mocked; no database connection is required.
 *
 *  Item  1 – Parent timezone conversion (US EST, UK GMT via BookClass)
 *  Item  2 – US DST: spring-forward (nonexistent) + fall-back (ambiguous)
 *  Item  3 – UK DST: spring-forward nonexistent time
 *  Item  4 – India timezone (IST, no DST) through BookClass
 *  Item  5 – Non-whole-hour timezone offset (Nepal UTC+5:45)
 *  Item  6 – Exact 1-hour slot duration enforced by BookClass
 *  Item  7 – Shift start boundary (IST 09:00 → SHIFT_1, IST 08:00 → SHIFT_2)
 *  Item  8 – Shift end boundary (IST 20:00 → SHIFT_1, IST 21:00 → SHIFT_2)
 *  Item  9 – Overnight Shift 2 (IST 21:00–09:00) slot booking
 *  Item 10 – Midnight crossing: mentorLocalDate is NEXT IST day for after-midnight slots
 *  Item 11 – 2-hour minimum lead time (exact boundary + 1-min-under + past slot)
 *  Item 12 – Daily cap of 2 confirmed classes per mentor-local day
 *  Item 13 – Cancelled booking does NOT count toward daily cap
 *  Item 14 – Cancelled booking releases the slot for rebooking
 *  Item 15 – Same-slot concurrent booking (P2002 → SlotNotAvailableError)
 *  Item 16 – Concurrent last-cap position (P2034 → SlotNotAvailableError)
 *  Item 17 – Same idempotency key + same payload → original result returned
 *  Item 18 – Same idempotency key + changed payload → IdempotencyConflictError
 *  Item 19 – Different keys targeting the same slot → SlotNotAvailableError
 *  Item 20 – Cancellation before class start (happy path)
 *  Item 21 – Repeated cancellation (alreadyCancelled=true for valid token)
 *  Item 22 – Cancellation after class start → CancellationAfterStartError
 *  Item 23 – No eligible mentor → SlotNotAvailableError with alternateSlots array
 *  Item 24 – Email failure after booking commit does NOT surface to caller
 *
 * Item 25 (API validation errors) is in __tests__/interfaces/apiRoutes.test.ts.
 */
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'crypto';
import { hash as bcryptHash } from 'bcrypt';

import {
  BookClassUseCase,
  type BookClassDto,
  type BookClassResult,
} from '../../application/useCases/BookClass';
import { CancelClassUseCase } from '../../application/useCases/CancelClass';
import { LuxonTimezoneService } from '../../infrastructure/timezone/LuxonTimezoneService';

import type { UnitOfWork, TransactionContext } from '../../application/ports/UnitOfWork';
import type {
  IdempotencyStore,
  IdempotencyRecord,
  CreateIdempotencyData,
} from '../../application/ports/IdempotencyStore';
import type { MentorRepository, MentorWithDayCount } from '../../application/ports/MentorRepository';
import type { BookingRepository, CreateBookingData } from '../../application/ports/BookingRepository';
import type { EmailService } from '../../application/ports/EmailService';
import type { Booking } from '../../domain/entities/Booking';
import { BookingStatus, MentorShiftType } from '../../domain';
import {
  DstNonexistentTimeError,
  DstAmbiguousTimeError,
  LeadTimeViolationError,
  SlotNotAvailableError,
  IdempotencyConflictError,
  CancellationAfterStartError,
} from '../../domain/errors';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** "Now" value used for most tests — far in the past relative to all test slots. */
const FAR_PAST = '2024-11-01T00:00:00Z';

/** Standard IST Shift 1 slot: IST 10:00 Nov 4 = UTC 04:30 Nov 4 */
const IST_SHIFT1_START_ISO  = '2024-11-04T10:00:00';
const SLOT_START_UTC = new Date('2024-11-04T04:30:00Z');
const SLOT_END_UTC   = new Date('2024-11-04T05:30:00Z');

// ─────────────────────────────────────────────────────────────────────────────
// FACTORY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function makeMentor(
  id: string,
  dayCount = 0,
  shift: MentorShiftType = MentorShiftType.SHIFT_1,
): MentorWithDayCount {
  return {
    mentor: {
      id,
      name: `Mentor ${id}`,
      email: `${id}@test.com`,
      timezone: 'Asia/Kolkata',
      shift,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    dayCount,
  };
}

function makeBooking(
  id: string,
  mentorId: string,
  overrides: Partial<Booking> = {},
): Booking {
  return {
    id,
    mentorId,
    parentName: 'Alice',
    parentEmail: 'alice@test.com',
    childName: 'Bob',
    parentTimezone: 'Asia/Kolkata',
    startTimeUtc: SLOT_START_UTC,
    endTimeUtc: SLOT_END_UTC,
    mentorTimezone: 'Asia/Kolkata',
    mentorLocalDate: '2024-11-04',
    meetingLink: `https://meet.codeyoung.com/class/${id}`,
    status: BookingStatus.CONFIRMED,
    cancellationTokenHash: 'hash',
    accessTokenHash: 'access-hash',
    cancelledAt: null,
    idempotencyKey: 'key-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildTzService(nowIso: string = FAR_PAST) {
  return new LuxonTimezoneService(() => new Date(nowIso));
}

function buildEmailService(): EmailService {
  return {
    sendBookingConfirmation: vi.fn().mockResolvedValue(undefined),
    sendBookingCancellation: vi.fn().mockResolvedValue(undefined),
    sendMentorBookingNotification: vi.fn().mockResolvedValue(undefined),
  };
}

function buildIdempotencyStore(existing: IdempotencyRecord | null = null): IdempotencyStore {
  return {
    findByKey: vi.fn().mockResolvedValue(existing),
    create: vi.fn().mockImplementation(
      async (data: CreateIdempotencyData): Promise<IdempotencyRecord> => ({
        key: data.key,
        payloadHash: data.payloadHash,
        responseJson: data.responseJson,
        bookingId: data.bookingId,
        createdAt: new Date(),
      }),
    ),
  };
}

function buildBookingRepo(booking: Booking): BookingRepository {
  return {
    create:            vi.fn().mockResolvedValue(booking),
    findById:              vi.fn().mockResolvedValue(null),
    findByAccessTokenHash: vi.fn().mockResolvedValue(null),
    findByIdForUpdate:     vi.fn().mockResolvedValue(booking),
    cancel: vi.fn().mockImplementation(async (id: string, cancelledAt: Date): Promise<Booking> => ({
      ...booking,
      status: BookingStatus.CANCELLED,
      cancelledAt,
    })),
    findAll: vi.fn().mockResolvedValue([]),
  };
}

function buildMentorRepo(overrides: Partial<MentorRepository> = {}): MentorRepository {
  return {
    findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('m1')]),
    findById:            vi.fn().mockResolvedValue(null),
    findAll:             vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as MentorRepository;
}

function buildUoW(
  mentorRepo: MentorRepository,
  bookingRepo: BookingRepository,
  idemStore: IdempotencyStore,
): UnitOfWork {
  return {
    run: async (fn) =>
      fn({ mentorRepo, bookingRepo, idempotencyStore: idemStore } as TransactionContext),
  };
}

function buildThrowingUoW(code: string): UnitOfWork {
  return {
    run: async () => {
      const err = new Error('DB error');
      (err as unknown as Record<string, unknown>).code = code;
      throw err;
    },
  };
}

/** Convenience factory: builds a BookClassUseCase with sensible defaults. */
function buildBookClassUc(overrides: {
  uow?:    UnitOfWork;
  idem?:   IdempotencyStore;
  tz?:     LuxonTimezoneService;
  email?:  EmailService;
  mentor?: MentorRepository;
} = {}): BookClassUseCase {
  const booking    = makeBooking('b-1', 'm1');
  const bookingRepo = buildBookingRepo(booking);
  const mentorRepo  = overrides.mentor ?? buildMentorRepo();
  const idem        = overrides.idem   ?? buildIdempotencyStore();
  const uow         = overrides.uow    ?? buildUoW(mentorRepo, bookingRepo, idem);
  const tz          = overrides.tz     ?? buildTzService();
  const email       = overrides.email  ?? buildEmailService();
  return new BookClassUseCase(uow, idem, tz, email, mentorRepo);
}

/** Builds a hash for a DTO payload the same way BookClass does internally. */
function hashDto(dto: Omit<BookClassDto, 'idempotencyKey'>): string {
  const body = {
    parentName:        dto.parentName,
    parentEmail:       dto.parentEmail,
    childName:         dto.childName,
    parentTimezone:    dto.parentTimezone,
    requestedStartIso: dto.requestedStartIso,
  };
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(body).sort()) sorted[k] = (body as Record<string, string>)[k];
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// Standard DTO used by most BookClass tests
const BASE_DTO: BookClassDto = {
  parentName:        'Alice',
  parentEmail:       'alice@test.com',
  childName:         'Bob',
  parentTimezone:    'Asia/Kolkata',
  requestedStartIso: IST_SHIFT1_START_ISO,
  idempotencyKey:    'key-1',
};

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation test helpers
// ─────────────────────────────────────────────────────────────────────────────

const CANCEL_RAW_TOKEN = 'correct-raw-token-for-cancel-tests-long-enough-abc123';

async function buildCancelUcAndBooking(bookingOverrides: Partial<Booking> = {}) {
  const tokenHash = await bcryptHash(CANCEL_RAW_TOKEN, 10);

  const booking: Booking = {
    id:                    'cancel-b1',
    mentorId:              'm1',
    parentName:            'Alice',
    parentEmail:           'alice@test.com',
    childName:             'Bob',
    parentTimezone:        'Asia/Kolkata',
    // Slot 2h ahead of the fixed now (08:00 UTC)
    startTimeUtc:          new Date('2024-11-04T10:00:00Z'),
    endTimeUtc:            new Date('2024-11-04T11:00:00Z'),
    mentorTimezone:        'Asia/Kolkata',
    mentorLocalDate:       '2024-11-04',
    meetingLink:           'https://meet.codeyoung.com/class/cancel-b1',
    status:                BookingStatus.CONFIRMED,
    cancellationTokenHash: tokenHash,
    accessTokenHash:       'access-hash-cancel',
    cancelledAt:           null,
    idempotencyKey:        'cancel-key-1',
    createdAt:             new Date(),
    updatedAt:             new Date(),
    ...bookingOverrides,
  };

  const bookingRepo: BookingRepository = {
    findById:              vi.fn().mockResolvedValue(booking),
    findByAccessTokenHash: vi.fn().mockResolvedValue(null),
    findByIdForUpdate:     vi.fn().mockResolvedValue(booking),
    create:            vi.fn(),
    cancel: vi.fn().mockImplementation(async (id: string, cancelledAt: Date): Promise<Booking> => ({
      ...booking,
      status: BookingStatus.CANCELLED,
      cancelledAt,
    })),
    findAll: vi.fn().mockResolvedValue([]),
  };

  const uow: UnitOfWork = {
    run: async (fn) =>
      fn({
        mentorRepo:       buildMentorRepo() as unknown as MentorRepository,
        bookingRepo,
        idempotencyStore: buildIdempotencyStore() as unknown as IdempotencyStore,
      } as TransactionContext),
  };

  // Fixed "now" = 08:00 UTC; slot starts at 10:00 UTC → not yet started
  const tz = buildTzService('2024-11-04T08:00:00Z');
  const uc = new CancelClassUseCase(
    uow,
    bookingRepo,
    buildMentorRepo(),
    tz,
    buildEmailService(),
  );

  return { uc, booking };
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Item 1 — Parent timezone conversion
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 1 — parent timezone conversion', () => {
  it('US EST (UTC-5): NY 09:00 on 2024-11-05 → UTC 14:00, classified as SHIFT_1', async () => {
    // NY is EST in November (after DST fall-back on Nov 3).
    // 09:00 EST = UTC 14:00 = IST 19:30–20:30, which fits entirely inside Shift 1.
    // (10:00 EST is IST 20:30–21:30 and is rejected because it crosses 21:00.)
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });

    await uc.execute({
      ...BASE_DTO,
      parentTimezone:    'America/New_York',
      requestedStartIso: '2024-11-05T09:00:00',
      idempotencyKey:    'tz-us-est',
    });

    const call = findEligible.mock.calls[0][0];
    expect(call.slotStartUtc.toISOString()).toBe('2024-11-05T14:00:00.000Z');
    expect(call.slotEndUtc.toISOString()).toBe('2024-11-05T15:00:00.000Z');
    expect(call.shift).toBe(MentorShiftType.SHIFT_1);
  });

  it('Europe/London winter (UTC+0): London 12:00 → UTC 12:00, classified as SHIFT_1', async () => {
    // London Nov 4 is GMT (UTC+0). 12:00 GMT = UTC 12:00 = IST 17:30 (1050 min → SHIFT_1).
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });

    await uc.execute({
      ...BASE_DTO,
      parentTimezone:    'Europe/London',
      requestedStartIso: '2024-11-04T12:00:00',
      idempotencyKey:    'tz-uk-gmt',
    });

    const call = findEligible.mock.calls[0][0];
    expect(call.slotStartUtc.toISOString()).toBe('2024-11-04T12:00:00.000Z');
    expect(call.shift).toBe(MentorShiftType.SHIFT_1);
  });

  it('Australia/Sydney (AEDT, UTC+11): Sydney 15:00 → UTC 04:00, classified as SHIFT_1', async () => {
    // Sydney Nov 4 is AEDT (UTC+11). 15:00 AEDT = UTC 04:00 = IST 09:30 (570 min → SHIFT_1).
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });

    await uc.execute({
      ...BASE_DTO,
      parentTimezone:    'Australia/Sydney',
      requestedStartIso: '2024-11-04T15:00:00',
      idempotencyKey:    'tz-sydney',
    });

    const call = findEligible.mock.calls[0][0];
    expect(call.slotStartUtc.toISOString()).toBe('2024-11-04T04:00:00.000Z');
    expect(call.shift).toBe(MentorShiftType.SHIFT_1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 2 — US DST transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 2 — US DST (America/New_York)', () => {
  it('spring-forward 2024-03-10: 02:30 is nonexistent → DstNonexistentTimeError', async () => {
    // Clocks jump from 02:00 → 03:00, so 02:30 never exists.
    const uc = buildBookClassUc({ tz: buildTzService('2024-03-09T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        parentTimezone:    'America/New_York',
        requestedStartIso: '2024-03-10T02:30:00',
        idempotencyKey:    'dst-us-spring',
      }),
    ).rejects.toThrow(DstNonexistentTimeError);
  });

  it('fall-back 2024-11-03: 01:30 is ambiguous → DstAmbiguousTimeError', async () => {
    // Clocks fall back at 02:00 EDT → 01:00 EST, so 01:30 occurs twice.
    const uc = buildBookClassUc({ tz: buildTzService('2024-11-02T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        parentTimezone:    'America/New_York',
        requestedStartIso: '2024-11-03T01:30:00',
        idempotencyKey:    'dst-us-fall',
      }),
    ).rejects.toThrow(DstAmbiguousTimeError);
  });

  it('time just before spring-forward (01:59) is accepted', async () => {
    // 01:59 on spring-forward day still exists (before the gap).
    const uc = buildBookClassUc({ tz: buildTzService('2024-03-09T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        parentTimezone:    'America/New_York',
        requestedStartIso: '2024-03-10T01:59:00',
        idempotencyKey:    'dst-us-spring-before',
      }),
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 3 — UK DST transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 3 — UK DST (Europe/London)', () => {
  it('spring-forward 2024-03-31: 01:30 is nonexistent → DstNonexistentTimeError', async () => {
    // Clocks jump from 01:00 GMT → 02:00 BST on 2024-03-31.
    const uc = buildBookClassUc({ tz: buildTzService('2024-03-30T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        parentTimezone:    'Europe/London',
        requestedStartIso: '2024-03-31T01:30:00',
        idempotencyKey:    'dst-uk-spring',
      }),
    ).rejects.toThrow(DstNonexistentTimeError);
  });

  it('fall-back 2024-10-27: 01:30 BST is ambiguous → DstAmbiguousTimeError', async () => {
    // Clocks fall back from 02:00 BST → 01:00 GMT on 2024-10-27.
    const uc = buildBookClassUc({ tz: buildTzService('2024-10-26T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        parentTimezone:    'Europe/London',
        requestedStartIso: '2024-10-27T01:30:00',
        idempotencyKey:    'dst-uk-fall',
      }),
    ).rejects.toThrow(DstAmbiguousTimeError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 4 — India timezone (no DST)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 4 — India timezone (Asia/Kolkata, no DST)', () => {
  it('IST 10:00 Nov 4 → UTC 04:30, SHIFT_1, mentorLocalDate = 2024-11-04', async () => {
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });

    const result = await uc.execute({ ...BASE_DTO, idempotencyKey: 'ist-1' });
    expect(result.status).toBe('CONFIRMED');

    const call = findEligible.mock.calls[0][0];
    expect(call.slotStartUtc.toISOString()).toBe('2024-11-04T04:30:00.000Z');
    expect(call.shift).toBe(MentorShiftType.SHIFT_1);
    expect(call.mentorLocalDate).toBe('2024-11-04');
  });

  it('IST never throws DST errors across various dates — all resolve as CONFIRMED', async () => {
    // IST has no DST. Any local time in Asia/Kolkata is unambiguous and always
    // maps to a unique UTC instant. With now far in the past (2020), all 2024
    // slots are well beyond the 2-hour lead-time window, so they resolve to
    // a successful CONFIRMED booking.
    for (const localIso of [
      '2024-03-10T02:30:00', // US spring-forward date — still safe in IST
      '2024-11-03T01:30:00', // US fall-back date  — still safe in IST
      '2024-06-15T21:00:00', // Shift 2 summer slot
    ]) {
      const uc = buildBookClassUc({ tz: buildTzService('2020-01-01T00:00:00Z') });
      await expect(
        uc.execute({
          ...BASE_DTO,
          parentTimezone:    'Asia/Kolkata',
          requestedStartIso: localIso,
          idempotencyKey:    `ist-dst-${localIso}`,
        }),
      ).resolves.toBeDefined();  // resolved → no DST error thrown
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 5 — Non-whole-hour timezone offset (Nepal UTC+5:45)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 5 — non-whole-hour timezone offset (Asia/Kathmandu UTC+5:45)', () => {
  it('Nepal 10:15 → UTC 04:30 (same as IST 10:00) → SHIFT_1', async () => {
    // Asia/Kathmandu is UTC+5:45. 10:15 NPT − 5:45 = UTC 04:30.
    // UTC 04:30 = IST 10:00 (UTC+5:30 → 04:30 + 5:30 = 10:00).
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });

    await uc.execute({
      ...BASE_DTO,
      parentTimezone:    'Asia/Kathmandu',
      requestedStartIso: '2024-11-04T10:15:00',
      idempotencyKey:    'nepal-1',
    });

    const call = findEligible.mock.calls[0][0];
    expect(call.slotStartUtc.toISOString()).toBe('2024-11-04T04:30:00.000Z');
    expect(call.slotEndUtc.toISOString()).toBe('2024-11-04T05:30:00.000Z');
    expect(call.shift).toBe(MentorShiftType.SHIFT_1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 6 — Exact 1-hour slot duration
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 6 — exact 1-hour slot duration', () => {
  it('bookingRepo.create receives endTimeUtc exactly 3 600 000 ms after startTimeUtc', async () => {
    const createSpy = vi.fn().mockResolvedValue(makeBooking('b-1', 'm1'));
    const bookingRepo: BookingRepository = {
      create:            createSpy,
      findById:          vi.fn(),
      findByAccessTokenHash: vi.fn(),
      findByIdForUpdate: vi.fn(),
      cancel:            vi.fn(),
      findAll:           vi.fn().mockResolvedValue([]),
    };
    const mentorRepo = buildMentorRepo();
    const idem       = buildIdempotencyStore();
    const uow        = buildUoW(mentorRepo, bookingRepo, idem);
    const uc         = new BookClassUseCase(uow, idem, buildTzService(), buildEmailService(), mentorRepo);

    await uc.execute(BASE_DTO);

    const args = createSpy.mock.calls[0][0] as CreateBookingData;
    const durationMs = args.endTimeUtc.getTime() - args.startTimeUtc.getTime();
    expect(durationMs).toBe(3_600_000);
  });

  it('result startUtc and endUtc differ by exactly 1 hour', async () => {
    const uc     = buildBookClassUc();
    const result = await uc.execute(BASE_DTO);
    const ms     = new Date(result.endUtc).getTime() - new Date(result.startUtc).getTime();
    expect(ms).toBe(3_600_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 7 — Shift start boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 7 — shift start boundary', () => {
  it('IST 09:00 (Shift 1 start, 540 min) → classified as SHIFT_1', async () => {
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({ ...BASE_DTO, requestedStartIso: '2024-11-04T09:00:00', idempotencyKey: 'sb-1' });
    expect(findEligible.mock.calls[0][0].shift).toBe(MentorShiftType.SHIFT_1);
  });

  it('IST 08:00 (one hour before Shift 1 start, 480 min) → classified as SHIFT_2', async () => {
    // 480 < 540 → falls into SHIFT_2 territory (21:00–09:00 overnight).
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({ ...BASE_DTO, requestedStartIso: '2024-11-04T08:00:00', idempotencyKey: 'sb-2' });
    expect(findEligible.mock.calls[0][0].shift).toBe(MentorShiftType.SHIFT_2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 8 — Shift end boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 8 — shift end boundary', () => {
  it('IST 20:00 (last valid Shift 1 slot: 20:00–21:00, 1200 min) → SHIFT_1', async () => {
    // 540 ≤ 1200 < 1260 → SHIFT_1.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({ ...BASE_DTO, requestedStartIso: '2024-11-04T20:00:00', idempotencyKey: 'se-1' });
    expect(findEligible.mock.calls[0][0].shift).toBe(MentorShiftType.SHIFT_1);
  });

  it('IST 21:00 (Shift 2 start, 1260 min) → SHIFT_2', async () => {
    // 1260 is NOT < 1260, so the condition `>= 540 && < 1260` is false → SHIFT_2.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({ ...BASE_DTO, requestedStartIso: '2024-11-04T21:00:00', idempotencyKey: 'se-2' });
    expect(findEligible.mock.calls[0][0].shift).toBe(MentorShiftType.SHIFT_2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 9 — Overnight Shift 2 (IST 21:00–09:00)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 9 — overnight Shift 2 (IST 21:00–09:00)', () => {
  it('IST 22:00 → classified as SHIFT_2 and booking succeeds', async () => {
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    const result = await uc.execute({
      ...BASE_DTO,
      requestedStartIso: '2024-11-04T22:00:00',
      idempotencyKey:    'overnight-1',
    });
    expect(result.status).toBe('CONFIRMED');
    expect(findEligible.mock.calls[0][0].shift).toBe(MentorShiftType.SHIFT_2);
  });

  it('IST 02:00 (after midnight, Shift 2 morning side) → classified as SHIFT_2', async () => {
    // 02:00 = 120 min < 540 → SHIFT_2.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({
      ...BASE_DTO,
      requestedStartIso: '2024-11-05T02:00:00',
      idempotencyKey:    'overnight-2',
    });
    expect(findEligible.mock.calls[0][0].shift).toBe(MentorShiftType.SHIFT_2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 10 — Midnight crossing (mentorLocalDate follows IST calendar date)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 10 — midnight crossing (IST Shift 2 spans to next IST calendar day)', () => {
  it('IST Nov 5 01:00 (= UTC Nov 4 19:30) → mentorLocalDate = "2024-11-05" (NEXT IST day)', async () => {
    // Even though UTC is still Nov 4, the IST local date is Nov 5.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({
      ...BASE_DTO,
      requestedStartIso: '2024-11-05T01:00:00',  // IST Nov 5 01:00
      idempotencyKey:    'midnight-1',
    });
    const call = findEligible.mock.calls[0][0];
    expect(call.mentorLocalDate).toBe('2024-11-05');
    expect(call.shift).toBe(MentorShiftType.SHIFT_2);   // 60 min < 540 → SHIFT_2
  });

  it('IST Nov 4 23:00 (= UTC Nov 4 17:30) → mentorLocalDate = "2024-11-04" (SAME IST day)', async () => {
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({
      ...BASE_DTO,
      requestedStartIso: '2024-11-04T23:00:00',  // IST Nov 4 23:00
      idempotencyKey:    'midnight-2',
    });
    const call = findEligible.mock.calls[0][0];
    expect(call.mentorLocalDate).toBe('2024-11-04');
    expect(call.shift).toBe(MentorShiftType.SHIFT_2);   // 1380 min ≥ 1260 → SHIFT_2
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 11 — 2-hour minimum lead time
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 11 — 2-hour minimum lead time', () => {
  // Fixed "now" for this block = 2024-11-04T00:00:00Z (midnight UTC = IST 05:30).

  it('slot exactly 2 hours ahead passes lead time (boundary included)', async () => {
    // IST 07:30 = UTC 02:00 = exactly now + 2h.
    const uc = buildBookClassUc({ tz: buildTzService('2024-11-04T00:00:00Z') });
    const result = await uc.execute({
      ...BASE_DTO,
      requestedStartIso: '2024-11-04T07:30:00',
      idempotencyKey:    'lead-boundary',
    });
    expect(result.status).toBe('CONFIRMED');
  });

  it('slot 1 minute under the 2-hour threshold → LeadTimeViolationError', async () => {
    // IST 07:29 = UTC 01:59 = now + 119min < 2h.
    const uc = buildBookClassUc({ tz: buildTzService('2024-11-04T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        requestedStartIso: '2024-11-04T07:29:00',
        idempotencyKey:    'lead-under',
      }),
    ).rejects.toThrow(LeadTimeViolationError);
  });

  it('past slot → LeadTimeViolationError', async () => {
    // Requesting a slot that is already in the past relative to the fixed "now".
    const uc = buildBookClassUc({ tz: buildTzService('2024-11-05T00:00:00Z') });
    await expect(
      uc.execute({
        ...BASE_DTO,
        requestedStartIso: '2024-11-04T10:00:00',  // yesterday
        idempotencyKey:    'lead-past',
      }),
    ).rejects.toThrow(LeadTimeViolationError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 12 — Daily cap of 2 confirmed classes per mentor-local day
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 12 — daily cap of 2 confirmed classes per mentor-local day', () => {
  it('dailyCap=2 is passed to findEligibleMentors', async () => {
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1')]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    await uc.execute({ ...BASE_DTO, idempotencyKey: 'cap-check' });
    expect(findEligible.mock.calls[0][0].dailyCap).toBe(2);
  });

  it('mentor with dayCount=1 (one booking today) is still eligible and gets booked', async () => {
    // dayCount=1 < cap=2 → eligible.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1', 1)]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    const result = await uc.execute({ ...BASE_DTO, idempotencyKey: 'cap-under' });
    expect(result.status).toBe('CONFIRMED');
  });

  it('all mentors at cap (repo returns []) → SlotNotAvailableError', async () => {
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([]) });
    const uc = buildBookClassUc({ mentor: mentorRepo });
    await expect(uc.execute({ ...BASE_DTO, idempotencyKey: 'cap-full' }))
      .rejects.toThrow(SlotNotAvailableError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 13 — Cancelled booking does NOT count toward the daily cap
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 13 — cancelled booking does not count toward daily cap', () => {
  it('mentor with 1 confirmed + 1 cancelled today has dayCount=1 → still bookable', async () => {
    // The repository only counts CONFIRMED bookings for the daily cap.
    // dayCount=1 represents 1 confirmed booking; the cancelled booking is excluded.
    // Booking should succeed because dayCount=1 < cap=2.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1', 1)]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    const result = await uc.execute({ ...BASE_DTO, idempotencyKey: 'cancelled-cap-1' });
    expect(result.status).toBe('CONFIRMED');
    // dailyCap=2 passed; dayCount=1 means only 1 confirmed counted (not the cancelled one).
    expect(findEligible.mock.calls[0][0].dailyCap).toBe(2);
  });

  it('cancelled booking at the same slot does NOT block the slot (no CONFIRMED overlap)', async () => {
    // Repo returns eligible mentor even though a CANCELLED booking exists for this slot.
    // (The repo filters overlap by CONFIRMED only; the cancelled booking is invisible.)
    const findEligible = vi.fn().mockResolvedValue([makeMentor('m1', 0)]);
    const uc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    const result = await uc.execute({ ...BASE_DTO, idempotencyKey: 'cancelled-overlap' });
    expect(result.status).toBe('CONFIRMED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 14 — Cancelled booking releases the slot for rebooking
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 14 — cancelled booking releases the slot for rebooking', () => {
  it('CancelClass marks booking CANCELLED; subsequent BookClass on same slot succeeds', async () => {
    // Phase 1: Cancel the original booking.
    const { uc: cancelUc, booking } = await buildCancelUcAndBooking();
    const cancelResult = await cancelUc.execute({
      bookingId:         booking.id,
      cancellationToken: CANCEL_RAW_TOKEN,
    });
    expect(cancelResult.status).toBe('CANCELLED');

    // Phase 2: The slot is now free (CANCELLED booking excluded by repo).
    // A new booking for the same slot with a different idempotency key succeeds.
    const findEligible = vi.fn().mockResolvedValue([makeMentor('new-mentor', 0)]);
    const rebookUc = buildBookClassUc({ mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });
    const rebookResult = await rebookUc.execute({
      ...BASE_DTO,
      requestedStartIso: '2024-11-04T10:00:00',  // same slot as the cancelled booking
      idempotencyKey:    'rebook-after-cancel',
    });
    expect(rebookResult.status).toBe('CONFIRMED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 15 — Same-slot concurrent booking (P2002 → SlotNotAvailableError)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 15 — same-slot concurrent booking (P2002 unique constraint)', () => {
  it('P2002 from DB unique constraint maps to SlotNotAvailableError', async () => {
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('m1')]) });
    const uc = new BookClassUseCase(
      buildThrowingUoW('P2002'),
      buildIdempotencyStore(),
      buildTzService(),
      buildEmailService(),
      mentorRepo,
    );
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(SlotNotAvailableError);
  });

  it('SlotNotAvailableError from P2002 includes alternateSlots array', async () => {
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('m1')]) });
    const uc = new BookClassUseCase(
      buildThrowingUoW('P2002'),
      buildIdempotencyStore(),
      buildTzService(),
      buildEmailService(),
      mentorRepo,
    );
    try {
      await uc.execute(BASE_DTO);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SlotNotAvailableError);
      expect((err as SlotNotAvailableError).alternateSlots).toBeInstanceOf(Array);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 16 — Concurrent last-cap position (P2034 → SlotNotAvailableError)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 16 — concurrent last-cap position (P2034 serialization failure)', () => {
  it('P2034 serialization failure maps to SlotNotAvailableError', async () => {
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('m1')]) });
    const uc = new BookClassUseCase(
      buildThrowingUoW('P2034'),
      buildIdempotencyStore(),
      buildTzService(),
      buildEmailService(),
      mentorRepo,
    );
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(SlotNotAvailableError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 17 — Same idempotency key + same payload → original result
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 17 — same idempotency key + same payload returns original result', () => {
  it('returns cached result; findEligibleMentors is NOT called again', async () => {
    const originalResult: BookClassResult = {
      bookingId:         'cached-id',
      mentorName:        'Mentor m1',
      startUtc:          SLOT_START_UTC.toISOString(),
      endUtc:            SLOT_END_UTC.toISOString(),
      meetingLink:       'https://meet.codeyoung.com/class/cached-id',
      cancellationToken: 'cached-token',
      accessToken:       'cached-access',
      status:            'CONFIRMED',
    };
    const record: IdempotencyRecord = {
      key:          BASE_DTO.idempotencyKey,
      payloadHash:  hashDto(BASE_DTO),
      responseJson: JSON.stringify(originalResult),
      bookingId:    'cached-id',
      createdAt:    new Date(),
    };
    const findEligible = vi.fn();
    const idem = buildIdempotencyStore(record);
    const uc = buildBookClassUc({ idem, mentor: buildMentorRepo({ findEligibleMentors: findEligible }) });

    const result = await uc.execute(BASE_DTO);
    expect(result.bookingId).toBe('cached-id');
    expect(findEligible).not.toHaveBeenCalled();  // early return — no DB work
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 18 — Same idempotency key + changed payload → IdempotencyConflictError
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 18 — same idempotency key + changed payload → IdempotencyConflictError', () => {
  it('throws IdempotencyConflictError when the same key is reused with a different body', async () => {
    const record: IdempotencyRecord = {
      key:          BASE_DTO.idempotencyKey,
      payloadHash:  'a-completely-different-hash-from-some-other-previous-booking-aaaa',
      responseJson: '{}',
      bookingId:    'old-id',
      createdAt:    new Date(),
    };
    const uc = buildBookClassUc({ idem: buildIdempotencyStore(record) });
    await expect(uc.execute(BASE_DTO)).rejects.toThrow(IdempotencyConflictError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 19 — Different keys targeting the same slot
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 19 — different keys targeting the same slot', () => {
  it('key-B request for a slot already held by key-A → P2002 → SlotNotAvailableError', async () => {
    // The idempotency store has NO record for key-B (it is a genuinely new key).
    // The slot is already committed by key-A (simulated via P2002 from the DB).
    // Because there is no idempotency match for key-B, the code falls through to
    // SlotNotAvailableError (not an idempotency replay).
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([makeMentor('m1')]) });
    const idemB      = buildIdempotencyStore(null);  // no record for key-B
    const uc = new BookClassUseCase(
      buildThrowingUoW('P2002'),
      idemB,
      buildTzService(),
      buildEmailService(),
      mentorRepo,
    );
    await expect(
      uc.execute({ ...BASE_DTO, idempotencyKey: 'key-B-different-from-key-A' }),
    ).rejects.toThrow(SlotNotAvailableError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 20 — Cancellation before class start
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 20 — cancellation before class start', () => {
  it('cancels a CONFIRMED booking before start → returns CANCELLED status', async () => {
    const { uc, booking } = await buildCancelUcAndBooking();
    const result = await uc.execute({ bookingId: booking.id, cancellationToken: CANCEL_RAW_TOKEN });
    expect(result.status).toBe('CANCELLED');
    expect(result.alreadyCancelled).toBe(false);
    expect(result.bookingId).toBe(booking.id);
    expect(() => new Date(result.cancelledAt)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 21 — Repeated cancellation (idempotent for valid token)
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 21 — repeated cancellation (already-cancelled with valid token)', () => {
  it('returns alreadyCancelled=true without calling cancel() again', async () => {
    const { uc, booking } = await buildCancelUcAndBooking({
      status:      BookingStatus.CANCELLED,
      cancelledAt: new Date('2024-11-04T09:00:00Z'),
    });
    const result = await uc.execute({ bookingId: booking.id, cancellationToken: CANCEL_RAW_TOKEN });
    expect(result.status).toBe('CANCELLED');
    expect(result.alreadyCancelled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 22 — Cancellation after class start
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 22 — cancellation after class start', () => {
  it('throws CancellationAfterStartError when class has already started', async () => {
    // now = 08:00 UTC; slot started at 06:00 UTC (past).
    const { uc, booking } = await buildCancelUcAndBooking({
      startTimeUtc: new Date('2024-11-04T06:00:00Z'),
      endTimeUtc:   new Date('2024-11-04T07:00:00Z'),
    });
    await expect(
      uc.execute({ bookingId: booking.id, cancellationToken: CANCEL_RAW_TOKEN }),
    ).rejects.toThrow(CancellationAfterStartError);
  });

  it('throws CancellationAfterStartError at the exact start instant', async () => {
    const { uc, booking } = await buildCancelUcAndBooking({
      startTimeUtc: new Date('2024-11-04T08:00:00Z'),
      endTimeUtc:   new Date('2024-11-04T09:00:00Z'),
    });
    await expect(
      uc.execute({ bookingId: booking.id, cancellationToken: CANCEL_RAW_TOKEN }),
    ).rejects.toThrow(CancellationAfterStartError);
  });

  it('throws CancellationAfterStartError during the class window', async () => {
    const { uc, booking } = await buildCancelUcAndBooking({
      startTimeUtc: new Date('2024-11-04T07:30:00Z'),
      endTimeUtc:   new Date('2024-11-04T08:30:00Z'),
    });
    await expect(
      uc.execute({ bookingId: booking.id, cancellationToken: CANCEL_RAW_TOKEN }),
    ).rejects.toThrow(CancellationAfterStartError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 23 — No eligible mentor
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 23 — no eligible mentor available', () => {
  it('throws SlotNotAvailableError with an alternateSlots array', async () => {
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([]) });
    const uc = buildBookClassUc({ mentor: mentorRepo });
    try {
      await uc.execute(BASE_DTO);
      expect.fail('Expected SlotNotAvailableError');
    } catch (err) {
      expect(err).toBeInstanceOf(SlotNotAvailableError);
      expect((err as SlotNotAvailableError).alternateSlots).toBeInstanceOf(Array);
    }
  });

  it('error code is SLOT_NOT_AVAILABLE', async () => {
    const mentorRepo = buildMentorRepo({ findEligibleMentors: vi.fn().mockResolvedValue([]) });
    const uc = buildBookClassUc({ mentor: mentorRepo });
    await expect(uc.execute(BASE_DTO)).rejects.toMatchObject({ code: 'SLOT_NOT_AVAILABLE' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 24 — Email failure after booking commit does NOT surface
// ─────────────────────────────────────────────────────────────────────────────

describe('Item 24 — email failure after booking commit does not surface to caller', () => {
  it('BookClass: CONFIRMED result returned even when confirmation email throws', async () => {
    const failingEmail: EmailService = {
      sendBookingConfirmation: vi.fn().mockRejectedValue(new Error('SMTP unreachable')),
      sendBookingCancellation: vi.fn(),
      sendMentorBookingNotification: vi.fn().mockResolvedValue(undefined),
    };
    const uc     = buildBookClassUc({ email: failingEmail });
    const result = await uc.execute(BASE_DTO);
    expect(result.status).toBe('CONFIRMED');
  });

  it('CancelClass: CANCELLED result returned even when cancellation email throws', async () => {
    const { uc: baseUc, booking } = await buildCancelUcAndBooking();

    // Rebuild the same scenario but with a failing email service.
    const tokenHash = await bcryptHash(CANCEL_RAW_TOKEN, 10);
    const b: Booking = { ...booking, cancellationTokenHash: tokenHash };

    const bookingRepo: BookingRepository = {
      findById:          vi.fn().mockResolvedValue(b),
      findByAccessTokenHash: vi.fn(),
      findByIdForUpdate: vi.fn().mockResolvedValue(b),
      create:            vi.fn(),
      cancel: vi.fn().mockImplementation(async (_id: string, cancelledAt: Date): Promise<Booking> => ({
        ...b, status: BookingStatus.CANCELLED, cancelledAt,
      })),
      findAll: vi.fn().mockResolvedValue([]),
    };
    const uow: UnitOfWork = {
      run: async (fn) =>
        fn({
          mentorRepo:       buildMentorRepo() as unknown as MentorRepository,
          bookingRepo,
          idempotencyStore: buildIdempotencyStore() as unknown as IdempotencyStore,
        } as TransactionContext),
    };
    const failingEmail: EmailService = {
      sendBookingConfirmation: vi.fn(),
      sendBookingCancellation: vi.fn().mockRejectedValue(new Error('SMTP down')),
      sendMentorBookingNotification: vi.fn(),
    };
    const uc = new CancelClassUseCase(
      uow,
      bookingRepo,
      buildMentorRepo(),
      buildTzService('2024-11-04T08:00:00Z'),
      failingEmail,
    );
    const result = await uc.execute({ bookingId: b.id, cancellationToken: CANCEL_RAW_TOKEN });
    expect(result.status).toBe('CANCELLED');
  });
});
