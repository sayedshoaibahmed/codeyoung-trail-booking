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
import { hashBookingAccessToken } from '../services/bookingAccessToken';
import type { UnitOfWork } from '../ports/UnitOfWork';
import type { IdempotencyStore } from '../ports/IdempotencyStore';
import type { TimezoneService } from '../ports/TimezoneService';
import type { EmailService } from '../ports/EmailService';
import type { MentorRepository } from '../ports/MentorRepository';
import { MentorShiftType } from '../../domain/entities/Mentor';
import {
  parseHHmm,
  isExactDuration,
  isSlotWithinShift,
  meetsLeadTime,
} from '../../domain/services/shiftValidation';
import {
  LeadTimeViolationError,
  IdempotencyConflictError,
  SlotNotAvailableError,
  SlotOutsideShiftError,
  ConfirmedSlotConflictError,
  type AlternateSlot,
} from '../../domain/errors';

// ── Constants ─────────────────────────────────────────────────────────────────

const MENTOR_TIMEZONE    = 'Asia/Kolkata';
const SLOT_DURATION_MS   = 60 * 60_000;          // 1 hour in milliseconds
const LEAD_TIME_MINUTES  = 2 * 60;               // 2 hours in minutes
const MENTOR_DAILY_CAP   = 2;
const BCRYPT_ROUNDS      = 10;
const CANCELLATION_TOKEN_BYTES = 32;
const ACCESS_TOKEN_BYTES = 32;

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

/**
 * The whole 1-hour class must sit inside the shift that owns its start time.
 * A 20:30 IST start is inside the Shift 1 clock range but ends at 21:30, so it is rejected.
 */
function slotFitsShift(istStartMinutes: number, shift: MentorShiftType): boolean {
  if (shift === MentorShiftType.SHIFT_1) {
    return isSlotWithinShift(istStartMinutes, 60, SHIFT_1_START_MIN, SHIFT_1_END_MIN, false);
  }
  return isSlotWithinShift(istStartMinutes, 60, SHIFT_1_END_MIN, SHIFT_1_START_MIN, true);
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
  /**
   * Raw booking-access token — delivered once in this response and the email.
   * Never stored. Distinct from cancellationToken.
   */
  accessToken: string;
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
    if (!slotFitsShift(istMinutes, shift)) {
      throw new SlotOutsideShiftError();
    }

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
    // Dummy demo class: the frontend Classroom route is /class/:bookingId.
    // FRONTEND_ORIGIN (e.g. https://codeyoung-trail-booking.vercel.app) makes
    // emailed links absolute; otherwise store the in-app path.
    const frontendOrigin = (process.env.FRONTEND_ORIGIN ?? '')
      .split(',')[0]
      ?.trim()
      .replace(/\/$/, '') ?? '';
    const meetingLink = frontendOrigin
      ? `${frontendOrigin}/class/${bookingId}`
      : `/class/${bookingId}`;
    const rawToken   = randomBytes(CANCELLATION_TOKEN_BYTES).toString('hex');
    const tokenHash  = await bcryptHash(rawToken, BCRYPT_ROUNDS);
    const rawAccessToken = randomBytes(ACCESS_TOKEN_BYTES).toString('hex');
    const accessTokenHash = hashBookingAccessToken(rawAccessToken);
    const viewBookingPath = `/b/${rawAccessToken}`;
    const viewBookingUrl = frontendOrigin
      ? `${frontendOrigin}${viewBookingPath}`
      : viewBookingPath;

    // ── 10. Atomic transaction (SERIALIZABLE) ─────────────────────────────────
    type TxResult =
      | {
          ok: true;
          result: BookClassResult;
          mentorName: string;
          mentorEmail: string;
          bookingObj: import('../../domain').Booking;
        }
      | { ok: false };

    let txResult: TxResult | undefined;
    const maxSerializableAttempts = 3;
    for (let attempt = 0; attempt < maxSerializableAttempts; attempt++) {
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

        // b. Least-loaded first. If that mentor loses the CONFIRMED slot unique
        //    index, try the next eligible mentor in the same transaction.
        let mentor = eligible[0].mentor;
        let booking: import('../../domain').Booking | undefined;
        for (const candidate of eligible) {
          try {
            booking = await ctx.bookingRepo.create({
              id:                   bookingId,
              mentorId:             candidate.mentor.id,
              parentName:           dto.parentName,
              parentEmail:          dto.parentEmail,
              childName:            dto.childName,
              parentTimezone:       dto.parentTimezone,
              startTimeUtc:         startUtc,
              endTimeUtc:           endUtc,
              mentorTimezone:       candidate.mentor.timezone,
              mentorLocalDate,
              meetingLink,
              cancellationTokenHash: tokenHash,
              accessTokenHash,
              idempotencyKey:       dto.idempotencyKey,
            });
            mentor = candidate.mentor;
            break;
          } catch (err) {
            if (err instanceof ConfirmedSlotConflictError) continue;
            throw err;
          }
        }

        if (!booking) {
          return { ok: false } as const;
        }

        // d. Build result now (needed for idempotency responseJson)
        const result: BookClassResult = {
          bookingId:         booking.id,
          mentorName:        mentor.name,
          startUtc:          booking.startTimeUtc.toISOString(),
          endUtc:            booking.endTimeUtc.toISOString(),
          meetingLink:       booking.meetingLink,
          cancellationToken: rawToken,
          accessToken:       rawAccessToken,
          status:            'CONFIRMED',
        };

        // e. Persist idempotency record atomically with the booking
        await ctx.idempotencyStore.create({
          key:          dto.idempotencyKey,
          payloadHash,
          responseJson: JSON.stringify(result),
          bookingId:    booking.id,
        });

        return {
          ok: true,
          result,
          mentorName: mentor.name,
          mentorEmail: mentor.email,
          bookingObj: booking,
        } as const;
      });
      break;
    } catch (err: unknown) {
      // P2002 = unique constraint that escaped the mentor retry (idempotency key).
      // P2034 = serialization failure; retry the whole transaction.
      const code = (err as { code?: string }).code;
      if (code === 'P2034' && attempt < maxSerializableAttempts - 1) {
        continue;
      }
      if (code === 'P2002' || code === 'P2034') {
        if (code === 'P2002') {
          const raceRecord = await this.idempotencyStore.findByKey(dto.idempotencyKey);
          if (raceRecord) {
            if (raceRecord.payloadHash === payloadHash) {
              return JSON.parse(raceRecord.responseJson) as BookClassResult;
            }
            throw new IdempotencyConflictError(dto.idempotencyKey);
          }
        }
        const alternates = await this.fetchAlternates(shift, startUtc, endUtc, mentorLocalDate);
        throw new SlotNotAvailableError(alternates);
      }
      throw err;
    }
    }

    if (!txResult) {
      const alternates = await this.fetchAlternates(shift, startUtc, endUtc, mentorLocalDate);
      throw new SlotNotAvailableError(alternates);
    }

    // ── No eligible mentor found ──────────────────────────────────────────────
    if (!txResult.ok) {
      const alternates = await this.fetchAlternates(shift, startUtc, endUtc, mentorLocalDate);
      throw new SlotNotAvailableError(alternates);
    }

    // ── 11. Fire-and-forget emails (after commit) ─────────────────────────────
    // Parent and mentor sends are independent. Failures are logged and must
    // NOT surface to the caller or roll back the committed booking.
    void this.emailService
      .sendBookingConfirmation({
        booking:              txResult.bookingObj,
        mentorName:           txResult.mentorName,
        rawCancellationToken: rawToken,
        viewBookingUrl,
      })
      .catch((e: unknown) =>
        console.error('[email] Failed to send booking confirmation:', e),
      );

    void this.emailService
      .sendMentorBookingNotification({
        booking:     txResult.bookingObj,
        mentorName:  txResult.mentorName,
        mentorEmail: txResult.mentorEmail,
      })
      .catch((e: unknown) =>
        console.error('[email] Failed to send mentor booking notification:', e),
      );

    return txResult.result;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Returns up to 3 alternative available 1-hour slots in the next 12 hours.
   * Each candidate is classified into its own shift and rejected when the
   * full hour would cross a shift boundary.
   * Does NOT use a transaction — read-only, best-effort.
   */
  private async fetchAlternates(
    _shift: MentorShiftType,
    requestedStart: Date,
    _requestedEnd: Date,
    _mentorLocalDate: string,
  ): Promise<AlternateSlot[]> {
    const alternates: AlternateSlot[] = [];
    // Walk the next 12 hour offsets (skip the requested instant).
    for (let h = 1; h <= 12 && alternates.length < 3; h++) {
      const candidateStart = new Date(requestedStart.getTime() + h * 60 * 60_000);
      const candidateEnd   = new Date(candidateStart.getTime() + SLOT_DURATION_MS);
      const { time: cTime, date: cDate } = this.tzService.toLocal(candidateStart, MENTOR_TIMEZONE);
      const cMinutes = parseHHmm(cTime);
      const candidateShift = determineShift(cMinutes);
      // Skip hours whose full class would leave the shift (for example 20:30 → 21:30).
      if (!slotFitsShift(cMinutes, candidateShift)) continue;

      try {
        const eligible = await this.mentorRepo.findEligibleMentors({
          shift:           candidateShift,
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
