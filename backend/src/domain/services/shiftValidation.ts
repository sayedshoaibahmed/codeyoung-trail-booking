/**
 * Domain service — Shift Validation
 *
 * Pure functions implementing the business rules around shift boundaries,
 * slot containment, and interval overlap.
 *
 * Deliberately free of Luxon, Prisma, or any external dependencies.
 * All timezone-dependent inputs (local times, dates) are pre-computed
 * by the TimezoneService infrastructure adapter and passed in as primitives.
 */

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/**
 * Converts an "HH:mm" local time string to minutes from midnight (0–1439).
 * Throws if the format is not exactly "HH:mm" with valid numeric values.
 */
export function parseHHmm(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) {
    throw new Error(`Invalid HH:mm format: "${time}"`);
  }
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) {
    throw new Error(`Out-of-range time value: "${time}"`);
  }
  return h * 60 + m;
}

/**
 * Returns true when two UTC intervals overlap.
 *
 * Uses half-open intervals: [aStart, aEnd) overlaps [bStart, bEnd) iff
 *   aStart < bEnd AND aEnd > bStart
 *
 * Consequence: adjacent intervals (e.g. [09:00, 10:00) and [10:00, 11:00))
 * do NOT overlap — which is correct for back-to-back class slots.
 */
export function doIntervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ---------------------------------------------------------------------------
// Shift containment
// ---------------------------------------------------------------------------

/**
 * Returns true when a 1-hour slot fits COMPLETELY within a mentor's shift window.
 *
 * @param slotStartMinutes  Minutes from midnight (0–1439) for the slot start,
 *                          already expressed in the mentor's local timezone.
 * @param slotDurationMinutes  Duration of the slot (always 60 for this system).
 * @param shiftStartMinutes  parseHHmm(shift.localStartTime)
 * @param shiftEndMinutes    parseHHmm(shift.localEndTime)
 * @param crossesMidnight    True for overnight shifts (Shift 2: 21:00–09:00).
 *
 * Overnight handling:
 *   When crossesMidnight=true, slotStartMinutes may be in [shiftStart, 1440)
 *   (evening side, e.g. 21:00–23:00) or in [0, shiftEnd) (morning side,
 *   e.g. 00:00–09:00). Both are normalised to a single linear axis by adding
 *   1440 to the after-midnight values, so the shift becomes a contiguous range
 *   [shiftStart, shiftEnd + 1440].
 *
 * Example: shiftStart=1260 (21:00), shiftEnd=540 (09:00), shiftEndNorm=1980
 *   Slot at 22:00 (1320):  1320 → 1320  (>= 1260),  1320+60=1380 <= 1980 ✓
 *   Slot at 00:00 (0):     0    → 1440  (>= 1260),  1440+60=1500 <= 1980 ✓
 *   Slot at 08:00 (480):   480  → 1920  (>= 1260),  1920+60=1980 <= 1980 ✓
 *   Slot at 09:00 (540):   540  → 1980  (>= 1260),  1980+60=2040 <= 1980 ✗
 *   Slot at 20:00 (1200):  1200 → 2640  (>= 1260),  2640+60=2700 <= 1980 ✗
 */
export function isSlotWithinShift(
  slotStartMinutes: number,
  slotDurationMinutes: number,
  shiftStartMinutes: number,
  shiftEndMinutes: number,
  crossesMidnight: boolean,
): boolean {
  if (!crossesMidnight) {
    // Non-overnight (Shift 1: 09:00–21:00): simple containment check.
    return (
      slotStartMinutes >= shiftStartMinutes &&
      slotStartMinutes + slotDurationMinutes <= shiftEndMinutes
    );
  }

  // Overnight (Shift 2: 21:00–09:00): normalise to a linear axis.
  // Values below shiftStart are on the after-midnight side → add 1440.
  const shiftEndNorm = shiftEndMinutes + 1440;
  const slotStartNorm =
    slotStartMinutes < shiftStartMinutes
      ? slotStartMinutes + 1440
      : slotStartMinutes;

  return (
    slotStartNorm >= shiftStartMinutes &&
    slotStartNorm + slotDurationMinutes <= shiftEndNorm
  );
}

// ---------------------------------------------------------------------------
// Slot duration validation
// ---------------------------------------------------------------------------

/**
 * Returns true when the interval [startUtc, endUtc) is exactly
 * `expectedMinutes` long (default: 60).
 */
export function isExactDuration(
  startUtc: Date,
  endUtc: Date,
  expectedMinutes: number = 60,
): boolean {
  return endUtc.getTime() - startUtc.getTime() === expectedMinutes * 60_000;
}

// ---------------------------------------------------------------------------
// Lead time validation
// ---------------------------------------------------------------------------

/**
 * Returns true when the slot starts at least `leadTimeMinutes` in the future
 * relative to `nowUtc`.
 */
export function meetsLeadTime(
  slotStartUtc: Date,
  nowUtc: Date,
  leadTimeMinutes: number,
): boolean {
  return slotStartUtc.getTime() >= nowUtc.getTime() + leadTimeMinutes * 60_000;
}
