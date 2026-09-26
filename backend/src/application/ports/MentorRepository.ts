/**
 * Port — MentorRepository
 *
 * Defines every database operation the application layer needs for Mentor data.
 * The application layer depends on this interface; the concrete implementation
 * lives in infrastructure/ and is injected at the composition root.
 */

import type { Mentor, MentorShift, MentorShiftType } from '../../domain';

export interface FindEligibleMentorsOptions {
  /**
   * The shift the slot falls within (determines which mentors are on duty).
   */
  shift: MentorShiftType;
  /**
   * UTC start of the requested slot.
   */
  slotStartUtc: Date;
  /**
   * UTC end of the requested slot.
   */
  slotEndUtc: Date;
  /**
   * ISO date string (YYYY-MM-DD) in the mentor's local timezone for the slot.
   * Used to enforce the daily cap of 2 confirmed bookings per mentor-local day.
   */
  mentorLocalDate: string;
  /**
   * Maximum number of confirmed bookings a mentor may have on mentorLocalDate.
   * Defaults to 2 as per PRD.
   */
  dailyCap: number;
}

export interface MentorWithDayCount {
  mentor: Mentor;
  /** Number of CONFIRMED bookings on the given mentor-local date */
  dayCount: number;
}

export interface MentorRepository {
  /**
   * Returns all active mentors assigned to the given shift who:
   * 1. Have no overlapping CONFIRMED booking for [slotStart, slotEnd).
   * 2. Have fewer than dailyCap CONFIRMED bookings on mentorLocalDate.
   *
   * Results are sorted ascending by dayCount (least-loaded first),
   * then by mentor id for deterministic tie-breaking.
   *
   * Must be called inside an active Prisma transaction with appropriate
   * SELECT FOR UPDATE locking to prevent daily-cap races.
   */
  findEligibleMentors(
    options: FindEligibleMentorsOptions,
    tx?: unknown,
  ): Promise<MentorWithDayCount[]>;

  /** Fetch a single mentor by primary key. Returns null if not found. */
  findById(id: string): Promise<Mentor | null>;

  /** Fetch all active mentors. Used by the admin dashboard. */
  findAll(): Promise<Mentor[]>;
}
