/**
 * Infrastructure — PrismaUnitOfWork
 *
 * Runs the booking transaction with SERIALIZABLE isolation.
 *
 * Concurrency protection layers:
 *   1. SERIALIZABLE SSI: prevents phantom reads on the daily-cap count query.
 *      If two concurrent transactions both read "1 booking for mentor M on date D"
 *      and both attempt to insert a second one, PostgreSQL aborts one (P2034).
 *   2. Partial unique index WHERE status='CONFIRMED' on (mentorId, startTimeUtc):
 *      Final backstop — if two transactions somehow pick the same mentor for the
 *      same slot, the second INSERT will violate this index (P2002).
 *
 * Both error codes are caught in BookClassUseCase and mapped to SlotNotAvailableError.
 */
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { UnitOfWork, TransactionContext } from '../../application/ports/UnitOfWork';
import { PrismaMentorRepository } from './PrismaMentorRepository';
import { PrismaBookingRepository } from './PrismaBookingRepository';
import { PrismaIdempotencyStore } from './PrismaIdempotencyStore';

export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly db: PrismaClient) {}

  async run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        // Construct transaction-scoped repo instances.
        // The `tx` object from Prisma implements the full PrismaClient API.
        const txClient = tx as unknown as PrismaClient;
        const ctx: TransactionContext = {
          mentorRepo:      new PrismaMentorRepository(txClient),
          bookingRepo:     new PrismaBookingRepository(txClient),
          idempotencyStore: new PrismaIdempotencyStore(txClient),
        };
        return fn(ctx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000, // 10 seconds — fail fast rather than holding locks
        maxWait: 5_000,  // maximum time to acquire the transaction slot
      },
    );
  }
}
