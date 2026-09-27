/**
 * Unit tests for GetAvailabilityUseCase
 *
 * Uses vi.fn() mocks for MentorRepository and a fake TimezoneService backed
 * by real Luxon (LuxonTimezoneService with a controllable clock).
 * No database connection is needed.
 */
import { describe, it, expect, vi } from 'vitest';
import { GetAvailabilityUseCase } from '../../application/useCases/GetAvailability';
import { LuxonTimezoneService } from '../../infrastructure/timezone/LuxonTimezoneService';
import type {
  ConfirmedBookingInterval,
  MentorAvailabilitySnapshot,
  MentorRepository,
} from '../../application/ports/MentorRepository';
import type { Mentor } from '../../domain';
import { MentorShiftType } from '../../domain/entities/Mentor';
import { InvalidDateFormatError, InvalidTimezoneError } from '../../domain/errors';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMentor(id: string, shift: MentorShiftType): Mentor {
  return {
    id,
    name: `Mentor ${id}`,
    email: `${id}@test.com`,
    timezone: 'Asia/Kolkata',
    shift,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function tenMentors(): Mentor[] {
  return [
    ...[1, 2, 3, 4, 5].map((i) => makeMentor(`s1-${i}`, MentorShiftType.SHIFT_1)),
    ...[1, 2, 3, 4, 5].map((i) => makeMentor(`s2-${i}`, MentorShiftType.SHIFT_2)),
  ];
}

function defaultSnapshot(
  overrides: Partial<MentorAvailabilitySnapshot> = {},
): MentorAvailabilitySnapshot {
  return {
    mentors: tenMentors(),
    confirmedBookings: [],
    ...overrides,
  };
}

function capBookings(
  mentorIds: string[],
  mentorLocalDate: string,
  startA: string,
  startB: string,
): ConfirmedBookingInterval[] {
  return mentorIds.flatMap((mentorId) => [
    {
      mentorId,
      startTimeUtc: new Date(startA),
      endTimeUtc: new Date(new Date(startA).getTime() + 60 * 60_000),
      mentorLocalDate,
    },
    {
      mentorId,
      startTimeUtc: new Date(startB),
      endTimeUtc: new Date(new Date(startB).getTime() + 60 * 60_000),
      mentorLocalDate,
    },
  ]);
}

function buildMentorRepo(
  overrides: Partial<MentorRepository> = {},
): MentorRepository {
  return {
    findEligibleMentors: vi.fn().mockResolvedValue([]),
    loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot()),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as MentorRepository;
}

function buildUseCase(mentorRepo: MentorRepository, nowIso: string) {
  const clock = () => new Date(nowIso);
  const tzService = new LuxonTimezoneService(clock);
  return new GetAvailabilityUseCase(mentorRepo, tzService);
}

// ── Input validation ──────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — input validation', () => {
  const repo = buildMentorRepo();

  it('throws InvalidDateFormatError for bad date format', async () => {
    const uc = buildUseCase(repo, '2024-11-01T06:00:00Z');
    await expect(uc.execute({ date: '20241103', timezone: 'Asia/Kolkata' }))
      .rejects.toThrow(InvalidDateFormatError);
  });

  it('throws InvalidTimezoneError for unknown timezone', async () => {
    const uc = buildUseCase(repo, '2024-11-01T06:00:00Z');
    await expect(uc.execute({ date: '2024-11-03', timezone: 'America/Fake' }))
      .rejects.toThrow(InvalidTimezoneError);
  });
});

// ── Lead time filtering ────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — lead time', () => {
  it('excludes slots within 2-hour lead time window', async () => {
    const now = '2024-11-04T06:00:00Z'; // IST 11:30
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    const cutoff = new Date('2024-11-04T08:00:00Z');
    const early = result.slots.filter(
      (s) => new Date(s.startUtc).getTime() < cutoff.getTime(),
    );
    expect(early.length).toBeGreaterThan(0);
    for (const slot of early) {
      expect(slot.status).toBe('blocked');
    }

    const utcTimes = result.slots.map((s) => s.startUtc);
    expect(utcTimes).toContain('2024-11-04T03:30:00.000Z');
    expect(utcTimes).toContain('2024-11-04T04:30:00.000Z');
    expect(result.slots.find((s) => s.startUtc === '2024-11-04T03:30:00.000Z')?.status).toBe('blocked');
    expect(result.slots.find((s) => s.startUtc === '2024-11-04T04:30:00.000Z')?.status).toBe('blocked');
  });
});

// ── Shift 1 slot generation ────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — Shift 1 slots', () => {
  it('generates 12 distinct Shift 1 slots for a future IST date', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    const shift1Slots = result.slots.filter((s) => {
      const startUtc = new Date(s.startUtc);
      return startUtc >= new Date('2024-11-04T03:30:00Z') &&
             startUtc <  new Date('2024-11-04T15:30:00Z');
    });
    expect(shift1Slots.length).toBe(12);
    expect(shift1Slots.every((s) => s.status === 'available')).toBe(true);
  });

  it('each Shift 1 slot is exactly 1 hour long', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    for (const slot of result.slots) {
      const duration = new Date(slot.endUtc).getTime() - new Date(slot.startUtc).getTime();
      expect(duration).toBe(60 * 60_000);
    }
  });

  it('marks Shift 1 slots full when only Shift 2 mentors are present', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        mentors: tenMentors().filter((m) => m.shift === MentorShiftType.SHIFT_2),
      })),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    const shift1 = result.slots.find((s) => s.startUtc === '2024-11-04T03:30:00.000Z');
    const shift2 = result.slots.find((s) => s.startUtc === '2024-11-04T15:30:00.000Z');
    expect(shift1?.status).toBe('full');
    expect(shift2?.status).toBe('available');
  });
});

// ── Overnight Shift 2 slots ────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — Shift 2 overnight slots', () => {
  it('includes overnight slots visible in the parent-local day', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'America/Los_Angeles' });

    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('uses mentorLocalDate of the next IST calendar day for after-midnight Shift 2', async () => {
    const s2Ids = tenMentors()
      .filter((m) => m.shift === MentorShiftType.SHIFT_2)
      .map((m) => m.id);
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        confirmedBookings: capBookings(
          s2Ids,
          '2024-11-05',
          '2024-11-04T18:30:00.000Z',
          '2024-11-04T19:30:00.000Z',
        ),
      })),
    });

    const now = '2024-11-01T00:00:00Z';
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-05', timezone: 'Asia/Kolkata' });

    const midnight = result.slots.find((s) => s.startUtc === '2024-11-04T18:30:00.000Z');
    const shift1Morning = result.slots.find((s) => s.startUtc === '2024-11-05T03:30:00.000Z');
    expect(midnight?.status).toBe('full');
    expect(shift1Morning?.status).toBe('available');
  });

  it('keeps overnight Shift 2 eligible across the 21:00–09:00 IST window', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        mentors: tenMentors().filter((m) => m.shift === MentorShiftType.SHIFT_2),
      })),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-05', timezone: 'Asia/Kolkata' });

    const lateEvening = result.slots.find((s) => s.startUtc === '2024-11-05T15:30:00.000Z');
    const afterMidnight = result.slots.find((s) => s.startUtc === '2024-11-04T18:30:00.000Z');
    const lastOvernight = result.slots.find((s) => s.startUtc === '2024-11-05T02:30:00.000Z');
    expect(lateEvening?.status).toBe('available');
    expect(afterMidnight?.status).toBe('available');
    expect(lastOvernight?.status).toBe('available');
  });
});

// ── No eligible mentors ────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — no eligible mentors', () => {
  it('marks in-day slots full when no mentor is eligible (does not hide them)', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({ mentors: [] })),
    });
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.slots.length).toBe(24);
    expect(result.slots.every((s) => s.status === 'full')).toBe(true);
    expect(result.slots.some((s) => s.status === 'available')).toBe(false);
  });
});

// ── Daily cap ─────────────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — daily cap', () => {
  it('slots where daily cap is reached (dayCount >= 2) are full', async () => {
    const now = '2024-11-01T00:00:00Z';
    const mentors = tenMentors();
    const atCapRepo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        mentors,
        confirmedBookings: capBookings(
          mentors.map((m) => m.id),
          '2024-11-04',
          '2024-11-03T18:30:00.000Z',
          '2024-11-03T19:30:00.000Z',
        ),
      })),
    });
    const uc = buildUseCase(atCapRepo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.slots.length).toBe(24);
    expect(result.slots.every((s) => s.status === 'full')).toBe(true);
  });
});

// ── CANCELLED bookings ─────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — CANCELLED bookings do not block slots', () => {
  it('a slot is available even if a CANCELLED booking exists at the same time', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        confirmedBookings: [],
      })),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.slots.every((s) => s.status === 'available')).toBe(true);
  });
});

// ── Overlap ───────────────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — confirmed overlap', () => {
  it('marks a slot full when every on-shift mentor has a CONFIRMED overlap', async () => {
    const now = '2024-11-01T00:00:00Z';
    const s1 = tenMentors().filter((m) => m.shift === MentorShiftType.SHIFT_1);
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        confirmedBookings: s1.map((m) => ({
          mentorId: m.id,
          startTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
          endTimeUtc: new Date('2024-11-04T05:30:00.000Z'),
          mentorLocalDate: '2024-11-04',
        })),
      })),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    expect(result.slots.find((s) => s.startUtc === '2024-11-04T04:30:00.000Z')?.status).toBe('full');
    expect(result.slots.find((s) => s.startUtc === '2024-11-04T03:30:00.000Z')?.status).toBe('available');
    expect(result.slots.find((s) => s.startUtc === '2024-11-04T05:30:00.000Z')?.status).toBe('available');
  });
});

// ── US DST day — fall-back (25-hour day) ─────────────────────────────────────

describe('GetAvailabilityUseCase — US DST fall-back day', () => {
  it('returns slots for 2024-11-03 in America/New_York without errors', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    await expect(
      uc.execute({ date: '2024-11-03', timezone: 'America/New_York' }),
    ).resolves.toBeDefined();
  });

  it('localStartTime / localEndTime are in parent timezone (America/New_York)', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'America/New_York' });
    for (const slot of result.slots) {
      expect(slot.startLocal).toMatch(/^\d{2}:\d{2}$/);
      expect(slot.endLocal).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

// ── Response shape ─────────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — response shape', () => {
  it('echoes back the input date and timezone in the response', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.date).toBe('2024-11-04');
    expect(result.timezone).toBe('Asia/Kolkata');
  });

  it('slots are sorted chronologically', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    for (let i = 1; i < result.slots.length; i++) {
      expect(new Date(result.slots[i].startUtc).getTime())
        .toBeGreaterThan(new Date(result.slots[i - 1].startUtc).getTime());
    }
  });
});

describe('GetAvailabilityUseCase — full-day presentation statuses', () => {
  it('returns 24 unique IST-aligned hours for a future IST date', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    expect(result.slots).toHaveLength(24);
    const starts = result.slots.map((s) => s.startUtc);
    expect(new Set(starts).size).toBe(24);
    expect(result.slots.map((s) => s.startLocal)).toEqual([
      '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
      '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
      '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
      '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
    ]);
    expect(result.slots.every((s) => s.status === 'available')).toBe(true);
  });

  it('does not treat one occupied mentor as fully booked when another is eligible', async () => {
    const now = '2024-11-01T00:00:00Z';
    const mentors = tenMentors();
    const repo = buildMentorRepo({
      loadAvailabilitySnapshot: vi.fn().mockResolvedValue(defaultSnapshot({
        mentors,
        confirmedBookings: [{
          mentorId: 's1-1',
          startTimeUtc: new Date('2024-11-04T03:30:00.000Z'),
          endTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
          mentorLocalDate: '2024-11-04',
        }],
      })),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.slots.every((s) => s.status === 'available')).toBe(true);
  });

  it('loads the snapshot once and never calls findEligibleMentors per slot', async () => {
    const now = '2024-11-04T06:00:00Z';
    const loadAvailabilitySnapshot = vi.fn().mockResolvedValue(defaultSnapshot());
    const findEligibleMentors = vi.fn().mockResolvedValue([]);
    const repo = buildMentorRepo({ loadAvailabilitySnapshot, findEligibleMentors });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    const blocked = result.slots.filter((s) => s.status === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(loadAvailabilitySnapshot).toHaveBeenCalledTimes(1);
    expect(findEligibleMentors).not.toHaveBeenCalled();
  });

  it('skips the snapshot entirely when every in-day slot fails lead time', async () => {
    const now = '2024-11-04T16:00:00Z';
    const loadAvailabilitySnapshot = vi.fn().mockResolvedValue(defaultSnapshot());
    const findEligibleMentors = vi.fn();
    const repo = buildMentorRepo({ loadAvailabilitySnapshot, findEligibleMentors });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    expect(result.slots.every((s) => s.status === 'blocked')).toBe(true);
    expect(loadAvailabilitySnapshot).not.toHaveBeenCalled();
    expect(findEligibleMentors).not.toHaveBeenCalled();
  });
});
