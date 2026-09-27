/**
 * Application use case — GetNextAvailableDate
 *
 * Finds the earliest calendar date after `date` that has at least one
 * genuinely bookable slot. Slot eligibility is delegated entirely to
 * GetAvailabilityUseCase (lead time, shifts, daily cap, overlap).
 */
import type { GetAvailabilityUseCase } from './GetAvailability';
import type { TimezoneService } from '../ports/TimezoneService';
import { InvalidDateFormatError } from '../../domain/errors';

export const NEXT_AVAILABLE_SEARCH_DAYS = 30;

export interface GetNextAvailableDateInput {
  /** Selected parent-local calendar date (YYYY-MM-DD). Search starts the next day. */
  date: string;
  timezone: string;
}

export interface GetNextAvailableDateOutput {
  date: string;
  timezone: string;
  searchDays: number;
  nextAvailableDate: string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addOneCalendarDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const yyyy = String(next.getUTCFullYear());
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hasBookableSlot(slots: { status: string }[]): boolean {
  return slots.some((slot) => slot.status === 'available');
}

export class GetNextAvailableDateUseCase {
  constructor(
    private readonly getAvailability: GetAvailabilityUseCase,
    private readonly tzService: TimezoneService,
  ) {}

  async execute(input: GetNextAvailableDateInput): Promise<GetNextAvailableDateOutput> {
    const { date, timezone } = input;
    if (!DATE_RE.test(date)) {
      throw new InvalidDateFormatError(date);
    }
    this.tzService.validateTimezone(timezone);

    let cursor = addOneCalendarDay(date);

    for (let i = 0; i < NEXT_AVAILABLE_SEARCH_DAYS; i++) {
      const day = await this.getAvailability.execute({ date: cursor, timezone });
      if (hasBookableSlot(day.slots)) {
        return {
          date,
          timezone,
          searchDays: NEXT_AVAILABLE_SEARCH_DAYS,
          nextAvailableDate: cursor,
        };
      }
      cursor = addOneCalendarDay(cursor);
    }

    return {
      date,
      timezone,
      searchDays: NEXT_AVAILABLE_SEARCH_DAYS,
      nextAvailableDate: null,
    };
  }
}
