import { describe, it, expect, vi } from 'vitest';
import {
  GetNextAvailableDateUseCase,
  NEXT_AVAILABLE_SEARCH_DAYS,
} from '../../application/useCases/GetNextAvailableDate';
import { GetAvailabilityUseCase } from '../../application/useCases/GetAvailability';
import { LuxonTimezoneService } from '../../infrastructure/timezone/LuxonTimezoneService';
import type { MentorRepository, MentorWithDayCount } from '../../application/ports/MentorRepository';
import { MentorShiftType } from '../../domain/entities/Mentor';
import { InvalidDateFormatError, InvalidTimezoneError } from '../../domain/errors';
import type { AvailabilitySlot } from '../../application/useCases/GetAvailability';

function slot(status: AvailabilitySlot['status']): AvailabilitySlot {
  return {
    startUtc: '2024-11-05T04:30:00.000Z',
    endUtc: '2024-11-05T05:30:00.000Z',
    startLocal: '10:00',
    endLocal: '11:00',
    status,
  };
}

function makeAvailability(byDate: Record<string, AvailabilitySlot['status'][]>) {
  return {
    execute: vi.fn(async ({ date, timezone }: { date: string; timezone: string }) => ({
      date,
      timezone,
      slots: (byDate[date] ?? ['full']).map(slot),
    })),
  };
}

describe('GetNextAvailableDateUseCase', () => {
  it('searches the day after the selected date, not the selected date itself', async () => {
    const getAvailability = makeAvailability({
      '2024-11-05': ['available'],
    });
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.nextAvailableDate).toBe('2024-11-05');
    expect(getAvailability.execute).toHaveBeenCalledWith({
      date: '2024-11-05',
      timezone: 'Asia/Kolkata',
    });
    expect(getAvailability.execute).not.toHaveBeenCalledWith({
      date: '2024-11-04',
      timezone: 'Asia/Kolkata',
    });
  });

  it('returns the first future date that has an available slot', async () => {
    const getAvailability = makeAvailability({
      '2024-11-05': ['full', 'blocked'],
      '2024-11-06': ['full'],
      '2024-11-07': ['available', 'full'],
    });
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    const result = await uc.execute({ date: '2024-11-04', timezone: 'America/New_York' });
    expect(result.nextAvailableDate).toBe('2024-11-07');
    expect(result.searchDays).toBe(NEXT_AVAILABLE_SEARCH_DAYS);
    expect(getAvailability.execute).toHaveBeenCalledTimes(3);
  });

  it('treats only status=available as bookable (full and blocked do not count)', async () => {
    const getAvailability = makeAvailability({
      '2024-11-05': ['full', 'blocked'],
      '2024-11-06': ['available'],
    });
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.nextAvailableDate).toBe('2024-11-06');
  });

  it('returns null when no date in the 30-day horizon has a bookable slot', async () => {
    const getAvailability = makeAvailability({});
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.nextAvailableDate).toBeNull();
    expect(getAvailability.execute).toHaveBeenCalledTimes(NEXT_AVAILABLE_SEARCH_DAYS);
  });

  it('does not invent a date and increments calendar days in UTC midnight arithmetic', async () => {
    const getAvailability = makeAvailability({
      '2024-12-01': ['available'],
    });
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    const result = await uc.execute({ date: '2024-11-30', timezone: 'America/New_York' });
    expect(result.nextAvailableDate).toBe('2024-12-01');
  });

  it('rejects a malformed date without calling availability', async () => {
    const getAvailability = makeAvailability({});
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    await expect(uc.execute({ date: '20241104', timezone: 'Asia/Kolkata' }))
      .rejects.toThrow(InvalidDateFormatError);
    expect(getAvailability.execute).not.toHaveBeenCalled();
  });

  it('rejects an unknown timezone without calling availability', async () => {
    const getAvailability = makeAvailability({});
    const uc = new GetNextAvailableDateUseCase(getAvailability as never, new LuxonTimezoneService());
    await expect(uc.execute({ date: '2024-11-04', timezone: 'America/Fake' }))
      .rejects.toThrow(InvalidTimezoneError);
    expect(getAvailability.execute).not.toHaveBeenCalled();
  });
});

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

describe('GetNextAvailableDateUseCase — reuses GetAvailability rules', () => {
  it('respects lead time, daily cap, and cancelled bookings via GetAvailability', async () => {
    const mentors = [makeMockMentor('mentor-1', MentorShiftType.SHIFT_1).mentor];
    const loadAvailabilitySnapshot = vi.fn(async () => ({
      mentors,
      confirmedBookings: [
        {
          mentorId: 'mentor-1',
          startTimeUtc: new Date('2024-11-04T03:30:00.000Z'),
          endTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
          mentorLocalDate: '2024-11-05',
        },
        {
          mentorId: 'mentor-1',
          startTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
          endTimeUtc: new Date('2024-11-04T05:30:00.000Z'),
          mentorLocalDate: '2024-11-05',
        },
      ],
    }));
    const findEligibleMentors = vi.fn();
    const mentorRepo = {
      findEligibleMentors,
      loadAvailabilitySnapshot,
      findById: vi.fn(),
      findAll: vi.fn(),
    } as unknown as MentorRepository;

    const tzService = new LuxonTimezoneService(() => new Date('2024-11-04T04:30:00.000Z'));
    const getAvailability = new GetAvailabilityUseCase(mentorRepo, tzService);
    const uc = new GetNextAvailableDateUseCase(getAvailability, tzService);

    const result = await uc.execute({ date: '2024-11-04', timezone: 'Asia/Kolkata' });
    expect(result.nextAvailableDate).toBe('2024-11-06');
    expect(findEligibleMentors).not.toHaveBeenCalled();
    expect(loadAvailabilitySnapshot).toHaveBeenCalled();
  });
});
