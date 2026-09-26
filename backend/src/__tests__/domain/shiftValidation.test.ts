/**
 * Unit tests for domain/services/shiftValidation.ts
 *
 * These are pure function tests — no mocks, no database, no Luxon.
 * Every external input is a plain number, Date, or string.
 */
import { describe, it, expect } from 'vitest';
import {
  parseHHmm,
  isSlotWithinShift,
  doIntervalsOverlap,
  isExactDuration,
  meetsLeadTime,
} from '../../domain/services/shiftValidation';

// ── parseHHmm ────────────────────────────────────────────────────────────────

describe('parseHHmm', () => {
  it('converts "09:00" to 540', () => expect(parseHHmm('09:00')).toBe(540));
  it('converts "21:00" to 1260', () => expect(parseHHmm('21:00')).toBe(1260));
  it('converts "00:00" to 0', () => expect(parseHHmm('00:00')).toBe(0));
  it('converts "23:59" to 1439', () => expect(parseHHmm('23:59')).toBe(1439));
  it('converts "05:30" to 330 (India UTC+5:30 offset check)', () => expect(parseHHmm('05:30')).toBe(330));
  it('throws on invalid format "9:00"', () => expect(() => parseHHmm('9:00')).toThrow());
  it('throws on "25:00"', () => expect(() => parseHHmm('25:00')).toThrow());
  it('throws on "00:60"', () => expect(() => parseHHmm('00:60')).toThrow());
});

// ── isSlotWithinShift — Shift 1 (09:00–21:00, not overnight) ─────────────────

describe('isSlotWithinShift — Shift 1 (09:00–21:00)', () => {
  const S = parseHHmm('09:00'); // 540
  const E = parseHHmm('21:00'); // 1260
  const cross = false;

  it('first slot (09:00–10:00) is valid', () =>
    expect(isSlotWithinShift(540, 60, S, E, cross)).toBe(true));

  it('last slot (20:00–21:00) is valid', () =>
    expect(isSlotWithinShift(1200, 60, S, E, cross)).toBe(true));

  it('middle slot (14:00–15:00) is valid', () =>
    expect(isSlotWithinShift(840, 60, S, E, cross)).toBe(true));

  it('slot starting before shift (08:00–09:00) is invalid', () =>
    expect(isSlotWithinShift(480, 60, S, E, cross)).toBe(false));

  it('slot ending after shift (20:30–21:30) is invalid', () =>
    expect(isSlotWithinShift(1230, 60, S, E, cross)).toBe(false));

  it('slot entirely after shift (21:00–22:00) is invalid', () =>
    expect(isSlotWithinShift(1260, 60, S, E, cross)).toBe(false));

  it('slot straddling shift start (08:30–09:30) is invalid', () =>
    expect(isSlotWithinShift(510, 60, S, E, cross)).toBe(false));
});

// ── isSlotWithinShift — Shift 2 (21:00–09:00 next day, overnight) ────────────

describe('isSlotWithinShift — Shift 2 (21:00–09:00 overnight)', () => {
  const S = parseHHmm('21:00'); // 1260
  const E = parseHHmm('09:00'); // 540
  const cross = true;

  it('first slot on evening side (21:00–22:00) is valid', () =>
    expect(isSlotWithinShift(1260, 60, S, E, cross)).toBe(true));

  it('slot at 22:00–23:00 is valid', () =>
    expect(isSlotWithinShift(1320, 60, S, E, cross)).toBe(true));

  it('slot straddling midnight (23:00–00:00) is valid', () =>
    expect(isSlotWithinShift(1380, 60, S, E, cross)).toBe(true));

  it('slot just after midnight (00:00–01:00) is valid', () =>
    expect(isSlotWithinShift(0, 60, S, E, cross)).toBe(true));

  it('slot at 04:00–05:00 is valid', () =>
    expect(isSlotWithinShift(240, 60, S, E, cross)).toBe(true));

  it('last slot on morning side (08:00–09:00) is valid', () =>
    expect(isSlotWithinShift(480, 60, S, E, cross)).toBe(true));

  it('slot ending exactly at shift end (09:00–10:00) is invalid', () =>
    expect(isSlotWithinShift(540, 60, S, E, cross)).toBe(false));

  it('daytime slot (14:00–15:00) is invalid — Shift 1 territory', () =>
    expect(isSlotWithinShift(840, 60, S, E, cross)).toBe(false));

  it('slot at 20:00–21:00 is invalid — just before Shift 2 starts', () =>
    expect(isSlotWithinShift(1200, 60, S, E, cross)).toBe(false));

  it('slot ending past morning boundary (08:30–09:30) is invalid', () =>
    expect(isSlotWithinShift(510, 60, S, E, cross)).toBe(false));
});

// ── doIntervalsOverlap ───────────────────────────────────────────────────────

describe('doIntervalsOverlap', () => {
  const t = (iso: string) => new Date(iso);

  it('overlapping intervals return true', () =>
    expect(doIntervalsOverlap(t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'),
                              t('2024-01-01T09:30Z'), t('2024-01-01T10:30Z'))).toBe(true));

  it('contained interval returns true', () =>
    expect(doIntervalsOverlap(t('2024-01-01T09:00Z'), t('2024-01-01T11:00Z'),
                              t('2024-01-01T09:30Z'), t('2024-01-01T10:30Z'))).toBe(true));

  it('identical intervals return true', () =>
    expect(doIntervalsOverlap(t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'),
                              t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'))).toBe(true));

  it('adjacent intervals (back-to-back) do NOT overlap', () =>
    expect(doIntervalsOverlap(t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'),
                              t('2024-01-01T10:00Z'), t('2024-01-01T11:00Z'))).toBe(false));

  it('non-overlapping intervals return false', () =>
    expect(doIntervalsOverlap(t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'),
                              t('2024-01-01T11:00Z'), t('2024-01-01T12:00Z'))).toBe(false));

  it('CANCELLED booking (same slot) does not logically prevent rebooking — domain ignores status', () => {
    // doIntervalsOverlap is status-agnostic; the repository filters CONFIRMED only.
    // This test documents that fact: overlap is detected at the pure interval level.
    const result = doIntervalsOverlap(
      t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'),
      t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'),
    );
    expect(result).toBe(true); // overlap exists — but the REPO filters out CANCELLED
  });
});

// ── isExactDuration ──────────────────────────────────────────────────────────

describe('isExactDuration', () => {
  const t = (iso: string) => new Date(iso);

  it('exactly 60 minutes returns true', () =>
    expect(isExactDuration(t('2024-01-01T09:00Z'), t('2024-01-01T10:00Z'), 60)).toBe(true));

  it('59 minutes returns false', () =>
    expect(isExactDuration(t('2024-01-01T09:00Z'), t('2024-01-01T09:59Z'), 60)).toBe(false));

  it('61 minutes returns false', () =>
    expect(isExactDuration(t('2024-01-01T09:00Z'), t('2024-01-01T10:01Z'), 60)).toBe(false));
});

// ── meetsLeadTime ────────────────────────────────────────────────────────────

describe('meetsLeadTime', () => {
  const now = new Date('2024-11-03T12:00:00Z');

  it('slot exactly at lead time boundary is valid', () => {
    const slot = new Date('2024-11-03T14:00:00Z'); // exactly 2h ahead
    expect(meetsLeadTime(slot, now, 120)).toBe(true);
  });

  it('slot 1 minute before lead time cutoff is invalid', () => {
    const slot = new Date('2024-11-03T13:59:00Z'); // 1h59m ahead
    expect(meetsLeadTime(slot, now, 120)).toBe(false);
  });

  it('slot far in the future is valid', () => {
    const slot = new Date('2024-11-04T12:00:00Z');
    expect(meetsLeadTime(slot, now, 120)).toBe(true);
  });

  it('past slot is invalid', () => {
    const slot = new Date('2024-11-03T10:00:00Z');
    expect(meetsLeadTime(slot, now, 120)).toBe(false);
  });
});
