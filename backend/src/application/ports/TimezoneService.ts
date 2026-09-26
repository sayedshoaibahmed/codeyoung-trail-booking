/**
 * Port — TimezoneService
 *
 * Isolates all timezone arithmetic behind an interface.
 * The concrete implementation (LuxonTimezoneService) lives in infrastructure/
 * and is injected at the composition root.
 *
 * Rules enforced by the contract:
 * - NEVER manually add/subtract raw UTC offsets.
 * - All DST-ambiguous or DST-nonexistent times are rejected with typed errors.
 * - All timezone identifiers are validated as proper IANA strings.
 * - Non-whole-hour offsets (e.g. India UTC+5:30, Nepal UTC+5:45) are handled
 *   transparently because Luxon knows every IANA zone's actual offset.
 */

import type {
  DstAmbiguousTimeError,
  DstNonexistentTimeError,
  InvalidTimezoneError,
} from '../../domain';

export { DstAmbiguousTimeError, DstNonexistentTimeError, InvalidTimezoneError };

export interface LocalTimeInfo {
  /** ISO date string YYYY-MM-DD in the given timezone */
  date: string;
  /** HH:mm representation of the time in the given timezone */
  time: string;
}

export interface TimezoneService {
  /**
   * Validates an IANA timezone identifier.
   * Throws {@link InvalidTimezoneError} if `tz` is not a recognised IANA zone.
   */
  validateTimezone(tz: string): void;

  /**
   * Converts a naive local date-time string to a UTC Date.
   *
   * @param localIso  "YYYY-MM-DDTHH:mm:ss" — no timezone suffix.
   * @param timezone  IANA timezone identifier.
   *
   * @throws {@link DstAmbiguousTimeError}   when the time occurs twice (fall-back).
   * @throws {@link DstNonexistentTimeError} when the time is skipped (spring-forward).
   */
  toUtc(localIso: string, timezone: string): Date;

  /**
   * Converts a UTC Date to its local date and HH:mm time in the given timezone.
   * Handles non-whole-hour offsets (IST UTC+5:30, NPT UTC+5:45, etc.) correctly.
   */
  toLocal(utc: Date, timezone: string): LocalTimeInfo;

  /**
   * Returns the UTC instant at which the given date starts in the given timezone.
   * Example: "2024-11-03" in "America/New_York" → 2024-11-03T05:00:00Z (EST, UTC-5).
   */
  startOfDay(date: string, timezone: string): Date;

  /**
   * Returns the UTC instant at which the given date ENDS (= start of the next day)
   * in the given timezone. Used to define the exclusive upper bound for a date range.
   */
  endOfDay(date: string, timezone: string): Date;

  /**
   * Returns the current UTC instant. Injected so it can be overridden in tests.
   */
  now(): Date;
}
