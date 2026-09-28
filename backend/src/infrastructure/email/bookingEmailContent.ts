/**
 * Shared parent-facing email copy. Presentation only — does not change
 * booking, timezone, or cancellation rules. Never includes token hashes.
 */
import type { Booking } from '../../domain';

function formatInTz(utc: Date, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone }).format(utc);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface ConfirmationEmailParams {
  booking: Booking;
  mentorName: string;
  rawCancellationToken: string;
  viewBookingUrl: string;
  cancelBookingUrl: string;
  joinClassUrl: string;
}

function confirmationFields(params: ConfirmationEmailParams) {
  const { booking, mentorName } = params;
  const parentTz = booking.parentTimezone;
  const mentorTz = booking.mentorTimezone;
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return {
    parentDate: formatInTz(booking.startTimeUtc, parentTz, dateOptions),
    parentStart: formatInTz(booking.startTimeUtc, parentTz, timeOptions),
    parentEnd: formatInTz(booking.endTimeUtc, parentTz, timeOptions),
    mentorDate: formatInTz(booking.startTimeUtc, mentorTz, dateOptions),
    mentorStart: formatInTz(booking.startTimeUtc, mentorTz, timeOptions),
    mentorEnd: formatInTz(booking.endTimeUtc, mentorTz, timeOptions),
    status: booking.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
    parentTz,
    mentorTz,
    mentorName,
  };
}

export function buildConfirmationEmailText(params: ConfirmationEmailParams): string {
  const { booking, rawCancellationToken, viewBookingUrl, cancelBookingUrl, joinClassUrl } = params;
  const fields = confirmationFields(params);

  return [
    `Dear ${booking.parentName},`,
    '',
    `Your trial class for ${booking.childName} has been confirmed.`,
    '',
    `Status:     ${fields.status}`,
    `Booking ID: ${booking.id}`,
    `Student:    ${booking.childName}`,
    `Parent:     ${booking.parentName}`,
    `Mentor:     ${fields.mentorName}`,
    '',
    'Your local time:',
    `  ${fields.parentDate}`,
    `  ${fields.parentStart} – ${fields.parentEnd}`,
    `Timezone: ${fields.parentTz}`,
    '',
    'Mentor time:',
    `  ${fields.mentorDate}`,
    `  ${fields.mentorStart} – ${fields.mentorEnd}`,
    `Timezone: ${fields.mentorTz}`,
    '',
    `Join class: ${joinClassUrl}`,
    `View Booking: ${viewBookingUrl}`,
    `Cancel Booking: ${cancelBookingUrl}`,
    '',
    'You can also cancel before the class starts by pasting this cancellation token on the cancel page.',
    'Copy the token from the next line only. Do not include spaces or line breaks.',
    rawCancellationToken,
    '',
    'Keep this token safe — it will not be shown again.',
    '',
    'The CodeYoung Team',
  ].join('\n');
}

export function buildConfirmationEmailHtml(params: ConfirmationEmailParams): string {
  const { booking, rawCancellationToken, viewBookingUrl, cancelBookingUrl, joinClassUrl } = params;
  const fields = confirmationFields(params);
  const token = escapeHtml(rawCancellationToken);
  const button =
    'display:inline-block;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none;';

  return [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#0f172a;">',
    `<p>Dear ${escapeHtml(booking.parentName)},</p>`,
    `<p>Your trial class for ${escapeHtml(booking.childName)} has been confirmed.</p>`,
    `<p>Status: ${escapeHtml(fields.status)}<br>`,
    `Booking ID: ${escapeHtml(booking.id)}<br>`,
    `Student: ${escapeHtml(booking.childName)}<br>`,
    `Parent: ${escapeHtml(booking.parentName)}<br>`,
    `Mentor: ${escapeHtml(fields.mentorName)}</p>`,
    '<p>Your local time:<br>',
    `${escapeHtml(fields.parentDate)}<br>`,
    `${escapeHtml(fields.parentStart)} – ${escapeHtml(fields.parentEnd)}<br>`,
    `Timezone: ${escapeHtml(fields.parentTz)}</p>`,
    '<p>Mentor time:<br>',
    `${escapeHtml(fields.mentorDate)}<br>`,
    `${escapeHtml(fields.mentorStart)} – ${escapeHtml(fields.mentorEnd)}<br>`,
    `Timezone: ${escapeHtml(fields.mentorTz)}</p>`,
    `<p><a href="${escapeHtml(joinClassUrl)}" style="${button}background:#f59e0b;color:#0f172a;">Join Class</a></p>`,
    `<p><a href="${escapeHtml(viewBookingUrl)}" style="${button}background:#134e4a;color:#ffffff;">View Booking</a></p>`,
    `<p><a href="${escapeHtml(cancelBookingUrl)}" style="${button}background:#ffffff;color:#b91c1c;border:2px solid #b91c1c;">Cancel Booking</a></p>`,
    '<p>You can also cancel before the class starts by pasting this cancellation token on the cancel page. Copy the boxed token only.</p>',
    `<pre style="margin:0;padding:12px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;font-family:Consolas,Monaco,monospace;font-size:13px;white-space:pre;overflow-x:auto;word-break:normal;overflow-wrap:normal;">${token}</pre>`,
    '<p>Keep this token safe — it will not be shown again.</p>',
    '<p>The CodeYoung Team</p>',
    '</div>',
  ].join('');
}

export function buildMentorBookingNotificationText(params: {
  booking: Booking;
  mentorName: string;
}): string {
  const { booking, mentorName } = params;
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

  return [
    `Dear ${mentorName},`,
    '',
    'A new CodeYoung trial class has been assigned to you.',
    '',
    `Booking ID: ${booking.id}`,
    `Parent:     ${booking.parentName}`,
    `Student:    ${booking.childName}`,
    `Mentor:     ${mentorName}`,
    '',
    'Parent local time:',
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
    '',
    'The CodeYoung Team',
  ].join('\n');
}
