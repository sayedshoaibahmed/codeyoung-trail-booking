import type { Booking } from '../model/types';

export function formatBookingDate(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

export function formatBookingTime(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

export type ClassSessionPhase = 'upcoming' | 'live' | 'completed';

type ClassTimeRange = {
  startTimeUtc: string;
  endTimeUtc: string;
};

/**
 * Instant comparison on stored UTC ISO timestamps.
 * upcoming: now < start; live: start <= now < end; completed: now >= end.
 */
export function getClassSessionPhase(
  times: ClassTimeRange,
  now: Date = new Date(),
): ClassSessionPhase {
  const nowMs = now.getTime();
  const start = new Date(times.startTimeUtc).getTime();
  const end = new Date(times.endTimeUtc).getTime();
  if (nowMs < start) return 'upcoming';
  if (nowMs < end) return 'live';
  return 'completed';
}

/** Join is offered for confirmed upcoming and live classes, not after end. */
export function canShowJoinClass(
  booking: Pick<Booking, 'status' | 'startTimeUtc' | 'endTimeUtc'>,
  now: Date = new Date(),
): boolean {
  if (booking.status !== 'CONFIRMED') return false;
  return getClassSessionPhase(booking, now) !== 'completed';
}

/** Mirrors the existing backend rule: cancel is only offered before start. */
export function canOfferCancellation(booking: Booking, now: Date = new Date()): boolean {
  if (booking.status !== 'CONFIRMED') return false;
  return new Date(booking.startTimeUtc).getTime() > now.getTime();
}
