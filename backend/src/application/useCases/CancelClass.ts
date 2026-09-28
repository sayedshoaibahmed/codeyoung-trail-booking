/**
 * Application use case — CancelClass
 *
 * Allows a parent to cancel a CONFIRMED booking before the class starts.
 * Uses a secure token (compared against its bcrypt hash) in lieu of full auth.
 *
 * Idempotency:
 *   If the booking is already CANCELLED and the token is valid, the use case
 *   returns a controlled "already cancelled" result instead of throwing.
 *   This prevents information leakage while remaining caller-friendly on retries.
 *
 * Atomicity:
 *   The SELECT FOR UPDATE → status-check → UPDATE is wrapped in a UnitOfWork
 *   transaction so that concurrent cancellation attempts are serialized.
 *   bcrypt.compare() runs BEFORE the transaction to keep lock hold time minimal.
 *
 * Email:
 *   A cancellation confirmation is sent fire-and-forget AFTER the commit.
 *   Email failure does NOT roll back the cancellation.
 */
import { compare as bcryptCompare } from 'bcrypt';
import type { UnitOfWork }       from '../ports/UnitOfWork';
import type { BookingRepository } from '../ports/BookingRepository';
import type { MentorRepository }  from '../ports/MentorRepository';
import type { TimezoneService }   from '../ports/TimezoneService';
import type { EmailService }      from '../ports/EmailService';
import { BookingStatus }          from '../../domain/entities/Booking';
import {
  BookingNotFoundError,
  CancellationTokenInvalidError,
  CancellationAfterStartError,
} from '../../domain/errors';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CancelClassDto {
  bookingId: string;
  cancellationToken: string;
}

export interface CancelClassResult {
  bookingId: string;
  status: 'CANCELLED';
  cancelledAt: string;      // ISO-8601 UTC
  alreadyCancelled: boolean;
}

// ── Use Case ──────────────────────────────────────────────────────────────────

export class CancelClassUseCase {
  constructor(
    private readonly uow:          UnitOfWork,
    private readonly bookingRepo:  BookingRepository, // non-tx, for pre-checks
    private readonly mentorRepo:   MentorRepository,  // for email enrichment
    private readonly tzService:    TimezoneService,
    private readonly emailService: EmailService,
  ) {}

  async execute(dto: CancelClassDto): Promise<CancelClassResult> {
    const { bookingId, cancellationToken } = dto;

    // ── 1. Fetch booking (no lock — just existence & token check) ─────────────
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) throw new BookingNotFoundError(bookingId);

    // ── 2. Verify cancellation token BEFORE acquiring lock ────────────────────
    //    bcrypt.compare takes ~100 ms; don't hold DB locks during this.
    const tokenValid = await bcryptCompare(cancellationToken, booking.cancellationTokenHash);
    if (!tokenValid) throw new CancellationTokenInvalidError();

    // ── 3. Atomic transaction: lock → check → cancel ──────────────────────────
    const now = this.tzService.now();

    type TxResult =
      | { ok: true; cancelledAt: Date; alreadyCancelled: false }
      | { ok: true; cancelledAt: Date; alreadyCancelled: true };

    const txResult = await this.uow.run(async (ctx): Promise<TxResult> => {
      // Lock the row — prevents concurrent cancellations
      const locked = await ctx.bookingRepo.findByIdForUpdate(bookingId);

      // Defensive: booking was deleted between step 1 and now (extremely rare)
      if (!locked) throw new BookingNotFoundError(bookingId);

      // ── Idempotency: already cancelled ────────────────────────────────────
      if (locked.status === BookingStatus.CANCELLED) {
        return {
          ok:               true,
          cancelledAt:      locked.cancelledAt!,
          alreadyCancelled: true,
        };
      }

      // ── Time check: cannot cancel at or after class start (UTC instants) ──
      if (now >= locked.startTimeUtc) {
        throw new CancellationAfterStartError();
      }

      // ── Cancel ────────────────────────────────────────────────────────────
      const cancelled = await ctx.bookingRepo.cancel(bookingId, now);
      return {
        ok:               true,
        cancelledAt:      cancelled.cancelledAt!,
        alreadyCancelled: false,
      };
    });

    const result: CancelClassResult = {
      bookingId,
      status:           'CANCELLED',
      cancelledAt:      txResult.cancelledAt.toISOString(),
      alreadyCancelled: txResult.alreadyCancelled,
    };

    // ── 4. Fire-and-forget cancellation email (after commit) ──────────────────
    if (!txResult.alreadyCancelled) {
      void this.fetchMentorAndSendEmail(bookingId, booking.mentorId);
    }

    return result;
  }

  private async fetchMentorAndSendEmail(bookingId: string, mentorId: string): Promise<void> {
    try {
      const booking = await this.bookingRepo.findById(bookingId);
      const mentor  = await this.mentorRepo.findById(mentorId);
      if (!booking) return;
      await this.emailService.sendBookingCancellation({
        booking,
        mentorName: mentor?.name ?? 'Your mentor',
      });
    } catch (err: unknown) {
      console.error('[email] Failed to send cancellation confirmation:', err);
    }
  }
}
