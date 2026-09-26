/**
 * Application use case — BookClass
 *
 * Orchestrates the full booking creation flow. Depends only on ports (interfaces)
 * — no Prisma, no Luxon, no Express, no bcrypt imported here.
 *
 * Steps (see inline comments):
 *   1.  Validate parent timezone.
 *   2.  Convert requested local time → UTC (DST-safe via TimezoneService).
 *   3.  Enforce 2-hour lead time (domain rule).
 *   4.  Enforce exactly 1-hour duration (domain rule).
 *   5.  Determine shift (from IST local time of startUtc).
 *   6.  Determine mentor-local date (IST date of startUtc).
 *   7.  Hash payload for idempotency (SHA-256 of sorted canonical body).
 *   8.  Check idempotency OUTSIDE transaction (early return / conflict).
 *   9.  Pre-compute bookingId, meeting link, cancellation token (outside tx).
 *  10.  Run UnitOfWork (SERIALIZABLE transaction):
 *         a. Find eligible mentors via MentorRepository (shift, overlap, cap).
 *         b. If none → return sentinel; collect alternates outside tx; throw.
 *         c. Pick least-loaded mentor (first in sorted list from repo).
 *         d. INSERT booking.
 *         e. INSERT idempotency record.
 *  11.  After commit: fire-and-forget email (failure must NOT roll back).
 *  12.  Return result (includes raw cancellation token — one-time delivery).
 */
import { randomBytes, createHash, randomUUID } from 'crypto';
import { hash as bcryptHash } from 'bcrypt';
import type { UnitOfWork } from '../ports/UnitOfWork';
import type { IdempotencyStore } from '../ports/IdempotencyStore';
import type { TimezoneService } from '../ports/TimezoneService';
import type { EmailService } from '../ports/EmailService';
import type { MentorRepository } from '../ports/MentorRepository';
import { MentorShiftType } from '../../domain/entities/Mentor';
import {
  parseHHmm,
  isExactDuration,
  meetsLeadTime,
} from '../../domain/services/shiftValidation';
import {
  InvalidTimezoneError,
  LeadTimeViolationError,
  IdempotencyConflictError,
  SlotNotAvailableError,
  type AlternateSlot,
} from '../../domain/errors';

// ── Constants ─────────────────────────────────────────────────────────────────

const MENTOR_TIMEZONE    = 'Asia/Kolkata';
const SLOT_DURATION_MS   = 60 * 60_000;          // 1 hour in milliseconds
const LEAD_TIME_MINUTES  = 2 * 60;               // 2 hours in minutes
const MENTOR_DAILY_CAP   = 2;
const BCRYPT_ROUNDS      = 10;
const CANCELLATION_TOKEN_BYTES = 32;

// Shift 1: 09:00–21:00 IST
const SHIFT_1_START_MIN = 9 * 60;   // 540
const SHIFT_1_END_MIN   = 21 * 60;  // 1260

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a SHA-256 hex digest of the canonical (alphabetically sorted keys)
 * JSON serialisation of the booking request body.
 */
function hashPayload(body: Record<string, string>): string {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(body).sort()) {
    sorted[key] = body[key];
  }
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Determines the shift based on the slot's local start time in IST (minutes from midnight).
 * - 09:00 ≤ time < 21:00 → SHIFT_1
 * - Otherwise             → SHIFT_2 (including overnight 21:00–09:00)
 */
function determineShift(istStartMinutes: number): MentorShiftType {
  return istStartMinutes >= SHIFT_1_START_MIN && istStartMinutes < SHIFT_1_END_MIN
    ? MentorShiftType.SHIFT_1
    : MentorShiftType.SHIFT_2;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface BookClassDto {
  parentName: string;
  parentEmail: string;
  childName: string;
  parentTimezone: string;
  /**
   * Local date-time in the parent's timezone, format "YYYY-MM-DDTHH:mm:ss".
   * No timezone suffix — the timezone is supplied separately in parentTimezone.
   */
  requestedStartIso: string;
  /** Client-supplied idempotency key from the Idempotency-Key header. */
  idempotencyKey: string;
}

export interface BookClassResult {
  bookingId: string;
  mentorName: string;
  startUtc: string;
  endUtc: string;
  meetingLink: string;
  /**
   * Raw (unhashed) cancellation token — delivered ONCE in this response.
   * Never stored. The parent must save this to cancel later.
   */
  cancellationToken: string;
  status: 'CONFIRMED';
}

// ── Use Case ──────────────────────────────────────────────────────────────────

export class BookClassUseCase {
  constructor(
    private readonly uow:             UnitOfWork,
    private readonly idempotencyStore: IdempotencyStore,
    private readonly tzService:        TimezoneService,
    private readonly emailService:     EmailService,
    private readonly mentorRepo:       MentorRepository, // for alternate-slot queries outside tx
  ) {}

  async execute(dto: BookClassDto): Promise<BookClassResult> {
    // ── 1. Validate timezone ─────────────────────────────────────────────────
    this.tzService.validateTimezone(dto.parentTimezone);

    // ── 2. Convert local time → UTC (throws on DST ambiguity/gap) ────────────
    const startUtc = this.tzService.toUtc(dto.requestedStartIso, dto.parentTimezone);
    const endUtc   = new Date(startUtc.getTime() + SLOT_DURATION_MS);

    // ── 3. Lead time check (domain rule) ─────────────────────────────────────
    const now = this.tzService.now();
    if (!meetsLeadTime(startUtc, now, LEAD_TIME_MINUTES)) {
      throw new LeadTimeViolationError(2);
    }

    // ── 4. Duration check (domain rule — defensive assertion) ─────────────────
    if (!isExactDuration(startUtc, endUtc, 60)) {
      throw new Error('Internal error: slot duration must be exactly 60 minutes');
    }

    // ── 5 & 6. Determine shift and mentor-local date from IST ─────────────────
    const { time: istTime, date: mentorLocalDate } = this.tzService.toLocal(startUtc, MENTOR_TIMEZONE);
    const istMinutes = parseHHmm(istTime);
    const shift = determineShift(istMinutes);

    // ── 7. Payload hash for idempotency ──────────────────────────────────────
    const payloadHash = hashPayload({
      parentName:        dto.parentName,
      parentEmail:       dto.parentEmail,
      childName:         dto.childName,
      parentTimezone:    dto.parentTimezone,
      requestedStartIso: dto.requestedStartIso,
    });

    // ── 8. Pre-transaction idempotency check (fast path) ──────────────────────
    const existingRecord = await this.idempotencyStore.findByKey(dto.idempotencyKey);
    if (existingRecord) {
      if (existingRecord.payloadHash !== payloadHash) {
        throw new IdempotencyConflictError(dto.idempotencyKey);
      }
      // Same key + same payload → return the original committed result
      return JSON.parse(existingRecord.responseJson) as BookClassResult;
    }

    // ── 9. Pre-compute outside transaction to minimise lock hold time ─────────
    const bookingId  = randomUUID();
    const meetingLink = `https://meet.codeyoung.com/class/${bookingId}`;
    const rawToken   = randomBytes(CANCELLATION_TOKEN_BYTES).toString('hex');
    const tokenHash  = await bcryptHash(rawToken, BCRYPT_ROUNDS);

    // ── 10. Atomic transaction (SERIALIZABLE) ─────────────────────────────────
    type TxResult =
      | { ok: true;  result: BookClassResult; mentorName: string; bookingObj: import('../../domain').Booking }
      | { ok: false };

    let txResult: TxResult;
    try {
      txResult = await this.uow.run(async (ctx) => {
        // a. Find eligible mentors (shift filter + no CONFIRMED overlap + daily cap)
        const eligible = await ctx.mentorRepo.findEligibleMentors({
          shift,
          slotStartUtc:    startUtc,
          slotEndUtc:      endUtc,
          mentorLocalDate,
          dailyCap:        MENTOR_DAILY_CAP,
        });

        if (eligible.length === 0) {
          // Signal "no mentors" without throwing (avoids rolling back unnecessarily)
          return { ok: false } as const;
        }

        // b. Least-loaded mentor — first in list (sorted asc by dayCount, then id)
        const { mentor } = eligible[0];

        // c. Persist booking
        const booking = await ctx.bookingRepo.create({
          id:                   bookingId,
          mentorId:             mentor.id,
          parentName:           dto.parentName,
          parentEmail:          dto.parentEmail,
          childName:            dto.childName,
          parentTimezone:       dto.parentTimezone,
          startTimeUtc:         startUtc,
          endTimeUtc:           endUtc,
          mentorTimezone:       mentor.timezone,
          mentorLocalDate,
          meetingLink,
          cancellationTokenHash: tokenHash,
          idempotencyKey:       dto.idempotencyKey,
        });

        // d. Build result now (needed for idempotency responseJson)
        const result: BookClassResult = {
          bookingId:         booking.id,
          mentorName:        mentor.name,
          startUtc:          booking.startTimeUtc.toISOString(),
          endUtc:            booking.endTimeUtc.toISOString(),
          meetingLink:       booking.meetingLink,
          cancellationToken: rawToken,
          status:            'CONFIRMED',
        };

        // e. Persist idempotency record atomically with the booking
        await ctx.idempotencyStore.create({
          key:          dto.idempotencyKey,
          payloadHash,
          responseJson: JSON.stringify(result),
          bookingId:    booking.id,
        });

        return { ok: true, result, mentorName: mentor.name, bookingObj: booking } as const;
      });
    } catch (err: unknown) {
      // P2002 = unique constraint (partial index backstop or idempotency key collision)
      // P2034 = serialization failure
      const code = (err as { code?: string }).code;
      if (code === 'P2002' || code === 'P2034') {
        // If idempotency key was the conflict, another concurrent identical request
        // may have just succeeded — try to return its result.
        if (code === 'P2002') {
          const raceRecord = await this.idempotencyStore.findByKey(dto.idempotencyKey);
          if (raceRecord?.payloadHash === payloadHash) {
            return JSON.parse(raceRecord.responseJson) as BookClassResult;
          }
        }
        // Otherwise it's a slot conflict — gather alternates and surface
        const alternates = await this.fetchAlternates(shift, startUtc, endUtc, mentorLocalDate);
        throw new SlotNotAvailableError(alternates);
      }
      throw err;
    }

    // ── No eligible mentor found ──────────────────────────────────────────────
    if (!txResult.ok) {
      const alternates = await this.fetchAlternates(shift, startUtc, endUtc, mentorLocalDate);
      throw new SlotNotAvailableError(alternates);
    }

    // ── 11. Fire-and-forget confirmation email (after commit) ─────────────────
    // Failures are logged but must NOT surface to the caller.
    void this.emailService
      .sendBookingConfirmation({
        booking:              txResult.bookingObj,
        mentorName:           txResult.mentorName,
        rawCancellationToken: rawToken,
      })
      .catch((e: unknown) =>
        console.error('[email] Failed to send booking confirmation:', e),
      );

    return txResult.result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Returns up to 3 alternative available 1-hour slots near the requested time.
   * Queries the same shift, checking the next 12 IST hour-aligned slots.
   * Does NOT use a transaction — read-only, best-effort.
   */
  private async fetchAlternates(
    shift: MentorShiftType,
    requestedStart: Date,
    requestedEnd: Date,
    mentorLocalDate: string,
  ): Promise<AlternateSlot[]> {
    const alternates: AlternateSlot[] = [];
    // Try the next 12 hour-aligned slots in the same shift (skip the requested one)
    for (let h = 1; h <= 12 && alternates.length < 3; h++) {
      const candidateStart = new Date(requestedStart.getTime() + h * 60 * 60_000);
      const candidateEnd   = new Date(candidateStart.getTime() + SLOT_DURATION_MS);
      const { date: cDate } = this.tzService.toLocal(candidateStart, MENTOR_TIMEZONE);

      try {
        const eligible = await this.mentorRepo.findEligibleMentors({
          shift,
          slotStartUtc:    candidateStart,
          slotEndUtc:      candidateEnd,
          mentorLocalDate: cDate,
          dailyCap:        MENTOR_DAILY_CAP,
        });
        if (eligible.length > 0) {
          alternates.push({
            startUtc: candidateStart.toISOString(),
            endUtc:   candidateEnd.toISOString(),
          });
        }
      } catch {
        // Best-effort — swallow errors in alternate computation
      }
    }
    return alternates;
  }
}
