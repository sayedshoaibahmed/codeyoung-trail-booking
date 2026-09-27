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

/** Mirrors the existing backend rule: cancel is only offered before start. */
export function canOfferCancellation(booking: Booking, now: Date = new Date()): boolean {
  if (booking.status !== 'CONFIRMED') return false;
  return new Date(booking.startTimeUtc).getTime() > now.getTime();
}
