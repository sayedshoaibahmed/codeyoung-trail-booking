/**
 * Infrastructure — LuxonTimezoneService
 *
 * Concrete implementation of the TimezoneService port using Luxon.
 * This is the ONLY file in the project that imports from 'luxon'.
 *
 * DST safety strategy:
 *
 * Nonexistent times (spring-forward):
 *   Luxon silently shifts the wall-clock time when asked to interpret a local
 *   time that falls in a DST gap. We detect this by comparing the parsed
 *   hour:minute against the nominal (zone-less) parse. A mismatch → rejected.
 *
 * Ambiguous times (fall-back):
 *   When clocks fall back, a local time occurs twice (two different UTC offsets).
 *   Luxon picks the earlier occurrence (smaller UTC value). We detect the second
 *   occurrence by adding 1 hour to the parsed UTC instant and checking whether
 *   that future UTC instant still maps to the SAME local HH:mm. If it does,
 *   the original time is ambiguous → rejected.
 *
 * Non-whole-hour offsets (IST UTC+5:30, NPT UTC+5:45, etc.):
 *   Handled transparently — Luxon reads the real IANA rule set. No manual
 *   offset arithmetic anywhere in this class.
 */
import { DateTime, IANAZone } from 'luxon';
import type { TimezoneService, LocalTimeInfo } from '../../application/ports/TimezoneService';
import {
  InvalidTimezoneError,
  DstAmbiguousTimeError,
  DstNonexistentTimeError,
} from '../../domain/errors';

export class LuxonTimezoneService implements TimezoneService {
  /**
   * Optional clock override — pass `() => new Date(fixedIso)` in tests.
   */
  constructor(private readonly clock: () => Date = () => new Date()) {}

  // ── Validation ────────────────────────────────────────────────────────────

  validateTimezone(tz: string): void {
    if (!IANAZone.isValidZone(tz)) {
      throw new InvalidTimezoneError(tz);
    }
  }

  // ── Conversion ────────────────────────────────────────────────────────────

  /**
   * Converts a naive local ISO string ("YYYY-MM-DDTHH:mm:ss", no suffix) to UTC.
   *
   * @throws {DstNonexistentTimeError} when the local time falls in a spring-forward gap.
   * @throws {DstAmbiguousTimeError}   when the local time is duplicated by fall-back.
   */
  toUtc(localIso: string, timezone: string): Date {
    // Parse with zone (Luxon picks one interpretation if ambiguous/nonexistent)
    const dt = DateTime.fromISO(localIso, { zone: timezone });

    if (!dt.isValid) {
      throw new Error(
        `Cannot parse date-time "${localIso}" in zone "${timezone}": ${dt.invalidExplanation ?? 'unknown error'}`,
      );
    }

    // --- Nonexistent time detection (spring-forward) -----------------------
    // Luxon silently normalises nonexistent times by sliding the wall clock
    // forward into the post-DST period. We detect this by comparing the
    // parsed hour:minute against what the caller supplied.
    const nominal = DateTime.fromISO(localIso); // zone-less parse for reference
    if (!nominal.isValid) {
      throw new Error(`Cannot parse date-time format: "${localIso}"`);
    }

    if (dt.hour !== nominal.hour || dt.minute !== nominal.minute) {
      throw new DstNonexistentTimeError(localIso, timezone);
    }

    // --- Ambiguous time detection (fall-back) ------------------------------
    // During a fall-back, both UTC-N and UTC-(N-1) map to the same local HH:mm.
    // Luxon picks the earlier UTC instant (the pre-fall-back one).
    // We confirm ambiguity by adding 1 hour to the parsed UTC and checking whether
    // the resulting local time equals the original local HH:mm.
    // If it does, the caller's time is duplicated → reject.
    const dtPlusOneHour = dt.plus({ hours: 1 });
    const localOfPlusOne = dtPlusOneHour.setZone(timezone); // view same instant in local tz
    if (
      localOfPlusOne.hour   === nominal.hour &&
      localOfPlusOne.minute === nominal.minute
    ) {
      throw new DstAmbiguousTimeError(localIso, timezone);
    }

    return dt.toJSDate();
  }

  toLocal(utc: Date, timezone: string): LocalTimeInfo {
    const dt = DateTime.fromJSDate(utc, { zone: timezone });
    return {
      date: dt.toISODate()!,       // YYYY-MM-DD
      time: dt.toFormat('HH:mm'), // HH:mm
    };
  }

  startOfDay(date: string, timezone: string): Date {
    return DateTime.fromISO(date, { zone: timezone }).startOf('day').toJSDate();
  }

  /** Exclusive upper bound of the date — start of the next day in local tz. */
  endOfDay(date: string, timezone: string): Date {
    return DateTime.fromISO(date, { zone: timezone }).plus({ days: 1 }).startOf('day').toJSDate();
  }

  now(): Date {
    return this.clock();
  }
}
