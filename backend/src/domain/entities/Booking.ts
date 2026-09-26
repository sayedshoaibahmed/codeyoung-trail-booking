/**
 * Domain entity — Booking
 * Pure TypeScript. No Prisma types, no external library dependencies.
 */

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export interface Booking {
  id: string;
  mentorId: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  /** IANA timezone string supplied by the parent at booking time */
  parentTimezone: string;
  /** UTC start of the 1-hour session */
  startTimeUtc: Date;
  /** UTC end — always startTimeUtc + 1 hour */
  endTimeUtc: Date;
  /** Mentor's IANA timezone, captured at booking creation for stable daily-cap math */
  mentorTimezone: string;
  /**
   * ISO date string (YYYY-MM-DD) of the slot in the mentor's local timezone.
   * Pre-computed at booking time so daily-cap queries never depend on runtime
   * timezone conversion of stored UTC timestamps.
   */
  mentorLocalDate: string;
  meetingLink: string;
  status: BookingStatus;
  /**
   * bcrypt hash of the raw cancellation token issued to the parent.
   * The raw token is never stored.
   */
  cancellationTokenHash: string;
  cancelledAt: Date | null;
  /** Client-supplied idempotency key, unique per booking creation request */
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Value object representing a candidate time slot.
 * Used internally by the availability logic — not persisted directly.
 */
export interface TimeSlot {
  startUtc: Date;
  endUtc: Date;
}
