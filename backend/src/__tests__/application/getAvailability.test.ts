/**
 * Unit tests for GetAvailabilityUseCase
 *
 * Uses vi.fn() mocks for MentorRepository and a fake TimezoneService backed
 * by real Luxon (LuxonTimezoneService with a controllable clock).
 * No database connection is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAvailabilityUseCase } from '../../application/useCases/GetAvailability';
import { LuxonTimezoneService } from '../../infrastructure/timezone/LuxonTimezoneService';
import type { MentorRepository, MentorWithDayCount } from '../../application/ports/MentorRepository';
import { MentorShiftType } from '../../domain/entities/Mentor';
import { InvalidDateFormatError, InvalidTimezoneError } from '../../domain/errors';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockMentor(id: string, shift: MentorShiftType): MentorWithDayCount {
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
    dayCount: 0,
  };
}

/**
 * Build a mock MentorRepository.
 * By default, findEligibleMentors returns one eligible mentor for SHIFT_1
 * and one for SHIFT_2.
 */
function buildMentorRepo(
  overrides: Partial<MentorRepository> = {},
): MentorRepository {
  return {
    findEligibleMentors: vi.fn().mockImplementation(
      async ({ shift }: { shift: MentorShiftType }) => [
        makeMockMentor('mentor-1', shift),
      ],
    ),
    findById: vi.fn().mockResolvedValue(null),
    findAll:  vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as MentorRepository;
}

/**
 * Build a GetAvailabilityUseCase with a clock fixed at `nowIso`.
 */
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
    // Now = 2024-11-04T06:00:00Z
    // IST time = 2024-11-04T11:30:00+05:30
    // First valid slot: IST 09:00 = UTC 03:30 → 03:30 < 08:00 (now+2h) → filtered
    // Slot at IST 10:00 = UTC 04:30 → 04:30 < 08:00 → filtered
    // Slot at IST 14:00 = UTC 08:30 → 08:30 >= 08:00 → included
    const now = '2024-11-04T06:00:00Z'; // IST 11:30
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    // Lead-time rule is unchanged: those hours are not bookable.
    // They remain visible as `blocked` instead of being omitted.
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
    // Now = far in the past relative to the requested date
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    // Shift 1 slots: IST 09:00–10:00 through 20:00–21:00 = 12 slots
    const shift1Slots = result.slots.filter((s) => {
      const startUtc = new Date(s.startUtc);
      // IST = UTC + 5h30m; Shift 1 slots in UTC: 03:30–15:30
      return startUtc >= new Date('2024-11-04T03:30:00Z') &&
             startUtc <  new Date('2024-11-04T15:30:00Z');
    });
    expect(shift1Slots.length).toBe(12);
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
});

// ── Overnight Shift 2 slots ────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — Shift 2 overnight slots', () => {
  it('includes overnight slots visible in the parent-local day', async () => {
    // Parent in America/Los_Angeles (UTC-8 in Nov)
    // Nov 4 LA = Nov 4 08:00 UTC → Nov 5 08:00 UTC
    // Shift 2 slots: IST 21:00 Nov 4 = UTC 15:30 Nov 4 → inside LA Nov 4
    // Shift 2 slots: IST 00:00 Nov 5 = UTC 18:30 Nov 4 → inside LA Nov 4
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'America/Los_Angeles' });

    // At least some slots should be present (the overnight Shift 2 ones are in LA Nov 4)
    expect(result.slots.length).toBeGreaterThan(0);
  });

  it('mentor-local date for midnight-crossing slot is the NEXT IST calendar day', async () => {
    // Slot starting at IST 00:00 on Nov 5 has mentorLocalDate = '2024-11-05'
    // UTC equivalent: 2024-11-04T18:30:00Z
    const repo = buildMentorRepo();
    // Capture what mentorLocalDate was passed to findEligibleMentors
    const capturedCalls: string[] = [];
    const mockRepo: MentorRepository = {
      ...repo,
      findEligibleMentors: vi.fn().mockImplementation(async (opts: { mentorLocalDate: string }) => {
        capturedCalls.push(opts.mentorLocalDate);
        return [makeMockMentor('m1', MentorShiftType.SHIFT_2)];
      }),
    } as unknown as MentorRepository;

    const now = '2024-11-01T00:00:00Z';
    const uc = buildUseCase(mockRepo, now);
    await uc.execute({ date: '2024-11-05', timezone: 'Asia/Kolkata' });

    // The after-midnight Shift 2 slot at IST 00:00 Nov 5 should use mentorLocalDate='2024-11-05'
    expect(capturedCalls).toContain('2024-11-05');
  });
});

// ── No eligible mentors ────────────────────────────────────────────────────────

describe('GetAvailabilityUseCase — no eligible mentors', () => {
  it('marks in-day slots full when no mentor is eligible (does not hide them)', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo({
      findEligibleMentors: vi.fn().mockResolvedValue([]),
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
  it('slots where daily cap is reached (dayCount >= 2) are excluded', async () => {
    const now = '2024-11-01T00:00:00Z';
    // Return mentor with dayCount=2 (at cap) → should be filtered by repo query
    // Simulate: findEligibleMentors returns [] because all mentors are at cap
    const atCapRepo = buildMentorRepo({
      findEligibleMentors: vi.fn().mockResolvedValue([]),
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
    // The repository (PrismaMentorRepository) only considers CONFIRMED bookings
    // when checking overlap. We simulate this by returning an eligible mentor
    // (as if no CONFIRMED booking blocks it), while a CANCELLED one would exist in DB.
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo({
      // Eligible mentor returned → slot available (CANCELLED booking was ignored by repo)
      findEligibleMentors: vi.fn().mockResolvedValue([
        makeMockMentor('m1', MentorShiftType.SHIFT_1),
      ]),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.slots.length).toBeGreaterThan(0);
  });
});

// ── US DST day — fall-back (25-hour day) ─────────────────────────────────────

describe('GetAvailabilityUseCase — US DST fall-back day', () => {
  it('returns slots for 2024-11-03 in America/New_York without errors', async () => {
    // Nov 3 in NY is a 25-hour day (clocks fall back at 02:00)
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    // Should not throw even though the parent's day is 25 hours long
    await expect(
      uc.execute({ date: '2024-11-03', timezone: 'America/New_York' }),
    ).resolves.toBeDefined();
  });

  it('localStartTime / localEndTime are in parent timezone (America/New_York)', async () => {
    const now = '2024-11-01T00:00:00Z';
    const repo = buildMentorRepo();
    const uc = buildUseCase(repo, now);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'America/New_York' });
    // All slots should have HH:mm in the local field (not UTC)
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
    const repo = buildMentorRepo({
      findEligibleMentors: vi.fn().mockResolvedValue([
        makeMockMentor('mentor-still-free', MentorShiftType.SHIFT_1),
      ]),
    });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.slots.every((s) => s.status === 'available')).toBe(true);
  });

  it('does not query mentors for lead-time-blocked slots', async () => {
    const now = '2024-11-04T06:00:00Z';
    const findEligible = vi.fn().mockResolvedValue([makeMockMentor('m1', MentorShiftType.SHIFT_1)]);
    const repo = buildMentorRepo({ findEligibleMentors: findEligible });
    const uc = buildUseCase(repo, now);
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });

    const blocked = result.slots.filter((s) => s.status === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(findEligible).toHaveBeenCalledTimes(result.slots.length - blocked.length);
  });
});
