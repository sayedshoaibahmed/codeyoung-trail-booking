/**
 * Application use case — GetAvailability
 *
 * Returns all available 1-hour slots for a given calendar date in the
 * parent's timezone. A slot is available when at least one mentor is eligible
 * (correct shift, no overlapping CONFIRMED booking, under the daily cap).
 *
 * This use case orchestrates domain rules and ports — it has no knowledge of
 * Prisma, Luxon, Express, or any infrastructure detail.
 *
 * Algorithm:
 *  1. Validate the parent's timezone.
 *  2. Derive the UTC bounds of the requested date.
 *  3. Generate all IST-aligned 1-hour slots for both shifts across the IST
 *     dates that overlap with the parent's UTC day.
 *  4. Filter by: within the parent's day, meets lead time.
 *  5. For each remaining slot, query MentorRepository for eligible mentors.
 *     If ≥ 1 mentor is eligible, the slot is available.
 */
import type { MentorRepository } from '../ports/MentorRepository';
import type { TimezoneService } from '../ports/TimezoneService';
import { MentorShiftType } from '../../domain/entities/Mentor';
import { InvalidDateFormatError } from '../../domain/errors';
import { meetsLeadTime } from '../../domain/services/shiftValidation';

// ── Constants ────────────────────────────────────────────────────────────────

/** All mentors are in IST (UTC+5:30). */
const MENTOR_TIMEZONE = 'Asia/Kolkata';

/** Slot duration in minutes. */
const SLOT_DURATION_MINUTES = 60;

/** Minimum lead time in hours required before a class can be booked. */
const LEAD_TIME_HOURS = 2;

/** Maximum confirmed bookings a mentor may have on a single mentor-local day. */
const MENTOR_DAILY_CAP = 2;

// Shift grid expressed as IST hours (inclusive start, exclusive end)
const SHIFT_1_START_H = 9;  // 09:00 IST
const SHIFT_1_END_H   = 21; // 21:00 IST — 12 slots (9,10,...,20)

const SHIFT_2_START_H = 21; // 21:00 IST on day D
// Shift 2 ends at 09:00 IST on day D+1 → encoded as 21,22,...,32 (mod 24)
const SHIFT_2_SLOT_COUNT = 12; // 21:00,22:00,...,08:00

// ── Types ────────────────────────────────────────────────────────────────────

export interface GetAvailabilityInput {
  /** Date string YYYY-MM-DD interpreted in the parent's timezone. */
  date: string;
  /** IANA timezone identifier for the parent (e.g. 'America/New_York'). */
  timezone: string;
}

export interface AvailabilitySlot {
  /** ISO 8601 UTC start of the slot */
  startUtc: string;
  /** ISO 8601 UTC end of the slot */
  endUtc: string;
  /** Slot start in the parent's local timezone (HH:mm) */
  startLocal: string;
  /** Slot end in the parent's local timezone (HH:mm) */
  endLocal: string;
}

export interface GetAvailabilityOutput {
  date: string;
  timezone: string;
  slots: AvailabilitySlot[];
}

interface CandidateSlot {
  startUtc: Date;
  endUtc: Date;
  shift: MentorShiftType;
  mentorLocalDate: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDateFormat(date: string): void {
  if (!DATE_RE.test(date)) {
    throw new InvalidDateFormatError(date);
  }
}

/** Zero-pads a single-digit number to two digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Adds one calendar day to a YYYY-MM-DD string without timezone math. */
function addOneCalendarDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Returns all YYYY-MM-DD strings in [start, end] inclusive. */
function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let cur = start;
  while (cur <= end) {
    dates.push(cur);
    cur = addOneCalendarDay(cur);
  }
  return dates;
}

// ── Use case class ────────────────────────────────────────────────────────────

export class GetAvailabilityUseCase {
  constructor(
    private readonly mentorRepo: MentorRepository,
    private readonly tzService: TimezoneService,
  ) {}

  async execute(input: GetAvailabilityInput): Promise<GetAvailabilityOutput> {
    const { date, timezone } = input;

    // 1. Validate inputs
    validateDateFormat(date);
    this.tzService.validateTimezone(timezone);

    // 2. Compute UTC bounds for the requested date in the parent's timezone
    const dayStartUtc = this.tzService.startOfDay(date, timezone);
    const dayEndUtc   = this.tzService.endOfDay(date, timezone);

    const now = this.tzService.now();
    const leadTimeMs = LEAD_TIME_HOURS * 60 * 60_000;

    // 3. Determine which IST calendar dates to generate slots for.
    //    We generate for every IST date that overlaps the parent's UTC day.
    const istStart = this.tzService.toLocal(dayStartUtc, MENTOR_TIMEZONE).date;
    // Use dayEndUtc - 1ms so we get the last IST date within the window.
    const istEnd   = this.tzService.toLocal(
      new Date(dayEndUtc.getTime() - 1),
      MENTOR_TIMEZONE,
    ).date;
    const istDates = dateRange(istStart, istEnd);

    // 4. Generate all candidate 1-hour slots across both shifts for those IST dates.
    const candidates: CandidateSlot[] = [];

    for (const istDate of istDates) {
      // ── Shift 1: 09:00–21:00 IST (12 slots) ─────────────────────────────
      for (let h = SHIFT_1_START_H; h < SHIFT_1_END_H; h++) {
        const localIso = `${istDate}T${pad2(h)}:00:00`;
        const startUtc = this.tzService.toUtc(localIso, MENTOR_TIMEZONE);
        const endUtc   = new Date(startUtc.getTime() + SLOT_DURATION_MINUTES * 60_000);
        const mentorLocalDate = this.tzService.toLocal(startUtc, MENTOR_TIMEZONE).date;
        candidates.push({ startUtc, endUtc, shift: MentorShiftType.SHIFT_1, mentorLocalDate });
      }

      // ── Shift 2: 21:00 IST → 09:00 IST next day (12 slots) ──────────────
      for (let i = 0; i < SHIFT_2_SLOT_COUNT; i++) {
        const absoluteHour = SHIFT_2_START_H + i; // 21…32
        const slotHour = absoluteHour % 24;        // 21,22,23,0,1,…,8
        const slotDate = absoluteHour >= 24 ? addOneCalendarDay(istDate) : istDate;
        const localIso = `${slotDate}T${pad2(slotHour)}:00:00`;
        const startUtc = this.tzService.toUtc(localIso, MENTOR_TIMEZONE);
        const endUtc   = new Date(startUtc.getTime() + SLOT_DURATION_MINUTES * 60_000);
        const mentorLocalDate = this.tzService.toLocal(startUtc, MENTOR_TIMEZONE).date;
        candidates.push({ startUtc, endUtc, shift: MentorShiftType.SHIFT_2, mentorLocalDate });
      }
    }

    // 5. Deduplicate by startUtc (IST date expansion may produce duplicates at boundaries)
    const seen = new Set<number>();
    const unique = candidates.filter((s) => {
      const t = s.startUtc.getTime();
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });

    // 6. Filter: slot start must be within [dayStartUtc, dayEndUtc)
    const inDay = unique.filter(
      (s) => s.startUtc >= dayStartUtc && s.startUtc < dayEndUtc,
    );

    // 7. Filter: slot start must meet the lead time requirement
    const withLeadTime = inDay.filter(
      (s) => meetsLeadTime(s.startUtc, now, LEAD_TIME_HOURS * 60),
    );

    // Sort chronologically
    withLeadTime.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());

    // 8. For each slot, check if at least one mentor is eligible
    const availableSlots: AvailabilitySlot[] = [];

    for (const slot of withLeadTime) {
      const eligible = await this.mentorRepo.findEligibleMentors({
        shift: slot.shift,
        slotStartUtc: slot.startUtc,
        slotEndUtc:   slot.endUtc,
        mentorLocalDate: slot.mentorLocalDate,
        dailyCap: MENTOR_DAILY_CAP,
      });

      if (eligible.length > 0) {
        const startLocal = this.tzService.toLocal(slot.startUtc, timezone).time;
        const endLocal   = this.tzService.toLocal(slot.endUtc,   timezone).time;
        availableSlots.push({
          startUtc:   slot.startUtc.toISOString(),
          endUtc:     slot.endUtc.toISOString(),
          startLocal,
          endLocal,
        });
      }
    }

    return { date, timezone, slots: availableSlots };
  }
}
