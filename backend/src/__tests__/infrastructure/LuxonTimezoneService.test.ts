/**
 * Integration tests for LuxonTimezoneService
 *
 * Tests real Luxon behaviour against known DST transition dates.
 * No database, no mocks — just the timezone service with real IANA data.
 *
 * Reference dates used:
 *   US DST spring-forward: 2024-03-10 02:00 → 03:00 (America/New_York)
 *   US DST fall-back:      2024-11-03 02:00 → 01:00 (America/New_York)
 *   UK DST spring-forward: 2024-03-31 01:00 → 02:00 (Europe/London)
 *   UK DST fall-back:      2024-10-27 02:00 → 01:00 (Europe/London)
 *   India:                 no DST — UTC+5:30 year-round
 */
import { describe, it, expect } from 'vitest';
import { LuxonTimezoneService } from '../../infrastructure/timezone/LuxonTimezoneService';
import {
  InvalidTimezoneError,
  DstAmbiguousTimeError,
  DstNonexistentTimeError,
} from '../../domain/errors';

const svc = new LuxonTimezoneService();

// ── validateTimezone ──────────────────────────────────────────────────────────

describe('validateTimezone', () => {
  it('accepts valid IANA zones', () => {
    expect(() => svc.validateTimezone('America/New_York')).not.toThrow();
    expect(() => svc.validateTimezone('Asia/Kolkata')).not.toThrow();
    expect(() => svc.validateTimezone('Europe/London')).not.toThrow();
    expect(() => svc.validateTimezone('Pacific/Auckland')).not.toThrow();
    expect(() => svc.validateTimezone('UTC')).not.toThrow();
  });

  it('rejects unknown zones', () => {
    expect(() => svc.validateTimezone('America/Fake')).toThrow(InvalidTimezoneError);
    expect(() => svc.validateTimezone('Continent/NoSuchCity')).toThrow(InvalidTimezoneError);
    expect(() => svc.validateTimezone('NotATimezone')).toThrow(InvalidTimezoneError);
    expect(() => svc.validateTimezone('')).toThrow(InvalidTimezoneError);
    // Note: 'EST' IS accepted by Luxon (it is a valid IANA alias for America/Panama).
    // Callers should always use canonical IANA names like 'America/New_York'.
  });
});

// ── toUtc — normal conversions ────────────────────────────────────────────────

describe('toUtc — normal conversions', () => {
  it('converts IST time correctly (UTC+5:30 non-whole-hour offset)', () => {
    // IST 09:00 = UTC 03:30
    const utc = svc.toUtc('2024-01-15T09:00:00', 'Asia/Kolkata');
    expect(utc.toISOString()).toBe('2024-01-15T03:30:00.000Z');
  });

  it('converts EST time (UTC-5) correctly', () => {
    // NY 10:00 EST = UTC 15:00
    const utc = svc.toUtc('2024-01-15T10:00:00', 'America/New_York');
    expect(utc.toISOString()).toBe('2024-01-15T15:00:00.000Z');
  });

  it('converts EDT time (UTC-4) correctly — summer time', () => {
    // NY 10:00 EDT = UTC 14:00 (Jul)
    const utc = svc.toUtc('2024-07-04T10:00:00', 'America/New_York');
    expect(utc.toISOString()).toBe('2024-07-04T14:00:00.000Z');
  });

  it('converts UK GMT time (UTC+0) correctly', () => {
    const utc = svc.toUtc('2024-01-15T12:00:00', 'Europe/London');
    expect(utc.toISOString()).toBe('2024-01-15T12:00:00.000Z');
  });

  it('converts UK BST time (UTC+1) correctly — summer time', () => {
    // London 14:00 BST = UTC 13:00
    const utc = svc.toUtc('2024-07-15T14:00:00', 'Europe/London');
    expect(utc.toISOString()).toBe('2024-07-15T13:00:00.000Z');
  });

  it('supports Nepal timezone (UTC+5:45 — non-whole-hour)', () => {
    // Kathmandu 09:45 = UTC 04:00
    const utc = svc.toUtc('2024-01-15T09:45:00', 'Asia/Kathmandu');
    expect(utc.toISOString()).toBe('2024-01-15T04:00:00.000Z');
  });
});

// ── toUtc — US DST transitions ────────────────────────────────────────────────

describe('toUtc — US DST (America/New_York)', () => {
  it('rejects nonexistent time during spring-forward (2024-03-10 02:30)', () => {
    // On 2024-03-10 at 02:00, clocks jump to 03:00. 02:30 does not exist.
    expect(() =>
      svc.toUtc('2024-03-10T02:30:00', 'America/New_York'),
    ).toThrow(DstNonexistentTimeError);
  });

  it('accepts time before spring-forward (2024-03-10 01:59)', () => {
    expect(() =>
      svc.toUtc('2024-03-10T01:59:00', 'America/New_York'),
    ).not.toThrow();
  });

  it('accepts time after spring-forward (2024-03-10 03:00)', () => {
    expect(() =>
      svc.toUtc('2024-03-10T03:00:00', 'America/New_York'),
    ).not.toThrow();
  });

  it('rejects ambiguous time during fall-back (2024-11-03 01:30)', () => {
    // On 2024-11-03 at 02:00 EDT, clocks fall back to 01:00 EST.
    // 01:30 occurs twice (once as EDT, once as EST).
    expect(() =>
      svc.toUtc('2024-11-03T01:30:00', 'America/New_York'),
    ).toThrow(DstAmbiguousTimeError);
  });

  it('accepts time before fall-back (2024-11-03 00:59)', () => {
    expect(() =>
      svc.toUtc('2024-11-03T00:59:00', 'America/New_York'),
    ).not.toThrow();
  });

  it('accepts time after fall-back (2024-11-03 02:00)', () => {
    expect(() =>
      svc.toUtc('2024-11-03T02:00:00', 'America/New_York'),
    ).not.toThrow();
  });
});

// ── toUtc — UK DST transitions ────────────────────────────────────────────────

describe('toUtc — UK DST (Europe/London)', () => {
  it('rejects nonexistent time during spring-forward (2024-03-31 01:30)', () => {
    // Clocks jump from 01:00 GMT to 02:00 BST on 2024-03-31.
    expect(() =>
      svc.toUtc('2024-03-31T01:30:00', 'Europe/London'),
    ).toThrow(DstNonexistentTimeError);
  });

  it('rejects ambiguous time during fall-back (2024-10-27 01:30)', () => {
    // Clocks fall back from 02:00 BST to 01:00 GMT on 2024-10-27.
    expect(() =>
      svc.toUtc('2024-10-27T01:30:00', 'Europe/London'),
    ).toThrow(DstAmbiguousTimeError);
  });
});

// ── toUtc — India (no DST) ────────────────────────────────────────────────────

describe('toUtc — India (Asia/Kolkata, no DST)', () => {
  it('never throws DST errors', () => {
    // India has no DST; any valid time should parse cleanly.
    for (const localIso of [
      '2024-03-10T01:30:00',
      '2024-11-03T01:30:00',
      '2024-06-15T21:00:00',
      '2024-12-31T23:59:00',
    ]) {
      expect(() => svc.toUtc(localIso, 'Asia/Kolkata')).not.toThrow();
    }
  });

  it('IST 21:00 = UTC 15:30 (Shift 2 start)', () => {
    const utc = svc.toUtc('2024-11-03T21:00:00', 'Asia/Kolkata');
    expect(utc.toISOString()).toBe('2024-11-03T15:30:00.000Z');
  });

  it('IST 09:00 = UTC 03:30 (Shift 1 start)', () => {
    const utc = svc.toUtc('2024-11-04T09:00:00', 'Asia/Kolkata');
    expect(utc.toISOString()).toBe('2024-11-04T03:30:00.000Z');
  });
});

// ── toLocal ───────────────────────────────────────────────────────────────────

describe('toLocal', () => {
  it('converts UTC to IST correctly (UTC+5:30)', () => {
    // UTC 03:30 = IST 09:00
    const result = svc.toLocal(new Date('2024-11-04T03:30:00Z'), 'Asia/Kolkata');
    expect(result.date).toBe('2024-11-04');
    expect(result.time).toBe('09:00');
  });

  it('overnight shift: UTC 15:30 = IST 21:00 on same day', () => {
    const result = svc.toLocal(new Date('2024-11-03T15:30:00Z'), 'Asia/Kolkata');
    expect(result.date).toBe('2024-11-03');
    expect(result.time).toBe('21:00');
  });

  it('midnight-crossing: mentor-local date is NEXT day for after-midnight IST slots', () => {
    // UTC 18:30 = IST midnight (00:00 on Nov 4)
    const result = svc.toLocal(new Date('2024-11-03T18:30:00Z'), 'Asia/Kolkata');
    expect(result.date).toBe('2024-11-04');
    expect(result.time).toBe('00:00');
  });

  it('1-hour slot at IST 02:00 → mentor-local date is the NEXT IST calendar day', () => {
    // Shift 2 slot starting at IST Nov 4 02:00 = UTC Nov 3 20:30
    const slotStartUtc = new Date('2024-11-03T20:30:00Z');
    const result = svc.toLocal(slotStartUtc, 'Asia/Kolkata');
    expect(result.date).toBe('2024-11-04');
    expect(result.time).toBe('02:00');
  });
});

// ── startOfDay / endOfDay ─────────────────────────────────────────────────────

describe('startOfDay / endOfDay', () => {
  it('IST start of day = UTC 03:30 previous day', () => {
    // IST Nov 4 00:00 = UTC Nov 3 18:30
    const start = svc.startOfDay('2024-11-04', 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2024-11-03T18:30:00.000Z');
  });

  it('endOfDay is exactly 24h after startOfDay (no DST in IST)', () => {
    const start = svc.startOfDay('2024-11-04', 'Asia/Kolkata');
    const end   = svc.endOfDay('2024-11-04', 'Asia/Kolkata');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60_000);
  });

  it('US DST day (spring-forward) — endOfDay - startOfDay = 23h', () => {
    // 2024-03-10 in NY: clocks spring forward at 02:00, so day is 23 hours long.
    const start = svc.startOfDay('2024-03-10', 'America/New_York');
    const end   = svc.endOfDay('2024-03-10', 'America/New_York');
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60_000);
  });

  it('US DST day (fall-back) — endOfDay - startOfDay = 25h', () => {
    // 2024-11-03 in NY: clocks fall back at 02:00, so day is 25 hours long.
    const start = svc.startOfDay('2024-11-03', 'America/New_York');
    const end   = svc.endOfDay('2024-11-03', 'America/New_York');
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60_000);
  });
});
