/**
 * Port — UnitOfWork
 *
 * Provides atomicity for the entire booking creation flow.
 * The application use case calls `run()` with a callback; the infrastructure
 * implementation wraps that callback in a SERIALIZABLE Prisma transaction.
 *
 * Clean Architecture rule: the application layer depends ONLY on this interface.
 * It never imports Prisma, transaction clients, or any database primitives.
 *
 * Concurrency guarantees (enforced at the infrastructure level):
 * - SERIALIZABLE isolation prevents phantom reads on daily-cap count queries.
 * - The partial unique index on (mentorId, startTimeUtc) WHERE status='CONFIRMED'
 *   is the final backstop against simultaneous same-slot inserts.
 * - If a serialization failure (P2034) or unique-constraint conflict (P2002) occurs,
 *   the infrastructure maps it to a SlotNotAvailableError before surfacing it.
 */
import type { MentorRepository } from './MentorRepository';
import type { BookingRepository } from './BookingRepository';
import type { IdempotencyStore } from './IdempotencyStore';

/** Repositories bound to the active transaction — passed into the UoW callback. */
export interface TransactionContext {
  mentorRepo: MentorRepository;
  bookingRepo: BookingRepository;
  idempotencyStore: IdempotencyStore;
}

export interface UnitOfWork {
  /**
   * Executes `fn` inside a single atomic SERIALIZABLE database transaction.
   * On success the transaction is committed; on any error it is rolled back.
   */
  run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
