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
}): string {
  const { booking, mentorName, rawCancellationToken } = params;
  const tz = booking.parentTimezone;
  const dateLabel = formatInTz(booking.startTimeUtc, tz, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const startLabel = formatInTz(booking.startTimeUtc, tz, { hour: 'numeric', minute: '2-digit' });
  const endLabel = formatInTz(booking.endTimeUtc, tz, { hour: 'numeric', minute: '2-digit' });
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
    `Class date: ${dateLabel}`,
    `Class time: ${startLabel} – ${endLabel}`,
    `Timezone:   ${tz}`,
    `Join class: ${booking.meetingLink}`,
    '',
    'To cancel this booking (before the class starts), use your cancellation token:',
    `  ${rawCancellationToken}`,
    '',
    'Keep this token safe — it will not be shown again.',
    '',
    'The CodeYoung Team',
  ].join('\n');
}
