/**
 * Port — BookingRepository
 *
 * All methods operate on whatever client the repository was constructed with.
 * Inside a UnitOfWork callback, implementations receive a transactional client;
 * outside, they use the shared Prisma client. No tx parameters needed here.
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
  accessTokenHash: string;
  idempotencyKey: string;
}

export interface ListBookingsFilter {
  /** ISO date string YYYY-MM-DD, matched against mentorLocalDate */
  date?: string;
  mentorId?: string;
  status?: BookingStatus;
}

export interface BookingRepository {
  /** Persists a new booking. When called inside a UoW, runs within the active transaction. */
  create(data: CreateBookingData): Promise<Booking>;

  /** Fetches a booking by primary key. Returns null if not found. */
  findById(id: string): Promise<Booking | null>;

  /** Fetches a booking by SHA-256 access-token digest. Returns null if not found. */
  findByAccessTokenHash(accessTokenHash: string): Promise<Booking | null>;

  /**
   * Fetches a booking by id and acquires a SELECT FOR UPDATE row lock.
   * Must be called on a transaction-bound repo (inside a UoW callback).
   */
  findByIdForUpdate(id: string): Promise<Booking | null>;

  /**
   * Marks a CONFIRMED booking as CANCELLED.
   * Must be called on a transaction-bound repo after findByIdForUpdate.
   */
  cancel(id: string, cancelledAt: Date): Promise<Booking>;

  /** Returns bookings matching the filter — used by the admin dashboard. */
  findAll(filter?: ListBookingsFilter): Promise<Booking[]>;
}
