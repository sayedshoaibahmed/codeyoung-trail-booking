/**
 * Shared parent-facing email copy. Presentation only — does not change
 * booking, timezone, or cancellation rules. Never includes token hashes.
 */
import type { Booking } from '../../domain';

function formatInTz(utc: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(utc);
}

export function buildConfirmationEmailText(params: {
  booking: Booking;
  mentorName: string;
  rawCancellationToken: string;
  viewBookingUrl: string;
}): string {
  const { booking, mentorName, rawCancellationToken, viewBookingUrl } = params;
  const parentTz = booking.parentTimezone;
  const mentorTz = booking.mentorTimezone;
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const parentDate = formatInTz(booking.startTimeUtc, parentTz, dateOptions);
  const parentStart = formatInTz(booking.startTimeUtc, parentTz, timeOptions);
  const parentEnd = formatInTz(booking.endTimeUtc, parentTz, timeOptions);
  const mentorDate = formatInTz(booking.startTimeUtc, mentorTz, dateOptions);
  const mentorStart = formatInTz(booking.startTimeUtc, mentorTz, timeOptions);
  const mentorEnd = formatInTz(booking.endTimeUtc, mentorTz, timeOptions);
  const status = booking.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED';

  return [
    `Dear ${booking.parentName},`,
    '',
    `Your trial class for ${booking.childName} has been confirmed.`,
    '',
    `Status:     ${status}`,
    `Booking ID: ${booking.id}`,
    `Student:    ${booking.childName}`,
    `Parent:     ${booking.parentName}`,
    `Mentor:     ${mentorName}`,
    '',
    'Your local time:',
    `  ${parentDate}`,
    `  ${parentStart} – ${parentEnd}`,
    `Timezone: ${parentTz}`,
    '',
    'Mentor time:',
    `  ${mentorDate}`,
    `  ${mentorStart} – ${mentorEnd}`,
    `Timezone: ${mentorTz}`,
    '',
    `Join class: ${booking.meetingLink}`,
    `View Booking: ${viewBookingUrl}`,
    '',
    'To cancel this booking (before the class starts), use your cancellation token:',
    `  ${rawCancellationToken}`,
    '',
    'Keep this token safe — it will not be shown again.',
    '',
    'The CodeYoung Team',
  ].join('\n');
}
