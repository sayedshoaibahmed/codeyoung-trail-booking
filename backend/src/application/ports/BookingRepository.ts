/**
 * Port — BookingRepository
 *
 * Defines every database operation the application layer needs for Booking data.
 * The application layer depends on this interface; the concrete implementation
 * lives in infrastructure/ and is injected at the composition root.
 */

import type { Booking, BookingStatus } from '../../domain';

export interface CreateBookingData {
  id: string;
  mentorId: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  parentTimezone: string;
  startTimeUtc: Date;
  endTimeUtc: Date;
  mentorTimezone: string;
  mentorLocalDate: string;
  meetingLink: string;
  cancellationTokenHash: string;
  idempotencyKey: string;
}

export interface ListBookingsFilter {
  /** ISO date string YYYY-MM-DD, matched against mentorLocalDate */
  date?: string;
  mentorId?: string;
  status?: BookingStatus;
}

export interface BookingRepository {
  /**
   * Persists a new booking atomically within the provided Prisma transaction.
   * Must be called inside a transaction that already holds appropriate row locks.
   */
  create(data: CreateBookingData, tx: unknown): Promise<Booking>;

  /**
   * Fetches a booking by id.
   * If tx is provided the query runs inside that transaction (enabling FOR UPDATE).
   */
  findById(id: string, tx?: unknown): Promise<Booking | null>;

  /**
   * Fetches a booking by id and acquires a FOR UPDATE row lock within tx.
   * Used by the cancellation use case to prevent concurrent cancellations.
   */
  findByIdForUpdate(id: string, tx: unknown): Promise<Booking | null>;

  /**
   * Marks a CONFIRMED booking as CANCELLED.
   * Must be called inside a transaction that holds a FOR UPDATE lock on the row.
   */
  cancel(id: string, cancelledAt: Date, tx: unknown): Promise<Booking>;

  /**
   * Returns bookings matching the filter — used by the admin dashboard.
   * No locking required (read-only).
   */
  findAll(filter?: ListBookingsFilter): Promise<Booking[]>;

  /**
   * Returns the count of CONFIRMED bookings for a given mentor on a given
   * mentor-local date string (YYYY-MM-DD).
   * Must be called inside a transaction for consistency during booking creation.
   */
  countConfirmedByMentorAndDate(
    mentorId: string,
    mentorLocalDate: string,
    tx: unknown,
  ): Promise<number>;
}
