import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

function canOfferCancellation(booking, now = new Date()) {
  if (booking.status !== 'CONFIRMED') return false;
  return new Date(booking.startTimeUtc).getTime() > now.getTime();
}

const booking = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  parentName: 'Priya Shah',
  childName: 'Aarav Shah',
  parentTimezone: 'Asia/Kolkata',
  startTimeUtc: '2024-11-04T04:30:00.000Z',
  endTimeUtc: '2024-11-04T05:30:00.000Z',
  mentorName: 'Aisha Sharma',
  status: 'CONFIRMED',
};

test('booking details load through the access token, not GET /bookings/:id', () => {
  const access = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  const hook = readFileSync(join(src, 'features/view-booking/model/useBookingAccess.ts'), 'utf8');
  assert.match(access, /useBookingAccess\(accessToken\)/);
  assert.match(access, /BookingDetailCard/);
  assert.match(hook, /booking-access/);

  const legacy = readFileSync(join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'), 'utf8');
  assert.doesNotMatch(legacy, /useBooking\(/);
  assert.doesNotMatch(legacy, /getBooking/);
});

test('detail card shows mentor, parent, student, times, timezone, and status from the booking', () => {
  const card = readFileSync(join(src, 'entities/booking/ui/BookingDetailCard.tsx'), 'utf8');
  assert.match(card, /booking\.parentName/);
  assert.match(card, /booking\.childName/);
  assert.match(card, /mentorFromBooking\(booking\)/);
  assert.match(card, /booking\.parentTimezone/);
  assert.match(card, /booking\.mentorTimezone/);
  assert.match(card, /Your local time/);
  assert.match(card, /Mentor time/);
  assert.match(card, /formatTimezoneLabel\(booking\.parentTimezone\)/);
  assert.match(card, /formatTimezoneLabel\(booking\.mentorTimezone\)/);
  assert.match(card, /booking\.status/);
  assert.match(card, /booking\.id/);
  assert.match(card, /formatBookingDate\(booking\.startTimeUtc/);
  assert.match(card, /formatBookingTime\(booking\.endTimeUtc/);
  assert.doesNotMatch(card, /meet\.codeyoung\.com/);
  assert.doesNotMatch(card, /Asia\/Kolkata/);
  assert.doesNotMatch(card, /Asia\/Calcutta/);
});

function getClassSessionPhase(times, now = new Date()) {
  const nowMs = now.getTime();
  const start = new Date(times.startTimeUtc).getTime();
  const end = new Date(times.endTimeUtc).getTime();
  if (nowMs < start) return 'upcoming';
  if (nowMs < end) return 'live';
  return 'completed';
}

function canShowJoinClass(record, now = new Date()) {
  if (record.status !== 'CONFIRMED') return false;
  return getClassSessionPhase(record, now) !== 'completed';
}

test('class session phase uses stored UTC start and end, not hardcoded hours', () => {
  const slot = {
    startTimeUtc: '2024-11-04T06:30:00.000Z', // 12:00 PM IST
    endTimeUtc: '2024-11-04T07:30:00.000Z',   // 1:00 PM IST
  };

  assert.equal(getClassSessionPhase(slot, new Date('2024-11-04T06:29:59.999Z')), 'upcoming');
  assert.equal(getClassSessionPhase(slot, new Date('2024-11-04T06:30:00.000Z')), 'live');
  assert.equal(getClassSessionPhase(slot, new Date('2024-11-04T07:00:00.000Z')), 'live');
  assert.equal(getClassSessionPhase(slot, new Date('2024-11-04T07:29:59.999Z')), 'live');
  assert.equal(getClassSessionPhase(slot, new Date('2024-11-04T07:30:00.000Z')), 'completed');
  assert.equal(getClassSessionPhase(slot, new Date('2024-11-04T08:00:00.000Z')), 'completed');
});

test('Join Class is shown for upcoming and live confirmed classes, not after end', () => {
  const confirmed = { ...booking, startTimeUtc: '2024-11-04T06:30:00.000Z', endTimeUtc: '2024-11-04T07:30:00.000Z' };

  assert.equal(canShowJoinClass(confirmed, new Date('2024-11-04T06:00:00.000Z')), true);
  assert.equal(canShowJoinClass(confirmed, new Date('2024-11-04T06:30:00.000Z')), true);
  assert.equal(canShowJoinClass(confirmed, new Date('2024-11-04T07:29:59.999Z')), true);
  assert.equal(canShowJoinClass(confirmed, new Date('2024-11-04T07:30:00.000Z')), false);
  assert.equal(canShowJoinClass({ ...confirmed, status: 'CANCELLED' }, new Date('2024-11-04T06:00:00.000Z')), false);

  const display = readFileSync(join(src, 'entities/booking/lib/display.ts'), 'utf8');
  assert.match(display, /export function getClassSessionPhase/);
  assert.match(display, /export function canShowJoinClass/);
  assert.match(display, /nowMs < start/);
  assert.match(display, /nowMs < end/);
});

test('Join Class uses /class/<booking-id> and is gated by class session phase', () => {
  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /classRoomPath\(booking\.id\)/);
  assert.match(page, /Join Class/);
  assert.match(page, /canShowJoinClass\(booking\)/);
  assert.match(page, /getClassSessionPhase\(booking\)/);
  assert.match(page, /Class Completed/);
  assert.match(page, /This class has already ended\./);

  const card = readFileSync(join(src, 'entities/booking/ui/BookingDetailCard.tsx'), 'utf8');
  assert.match(card, /canShowJoinClass\(booking\)/);

  const classroom = readFileSync(join(src, 'pages/class-room/ui/ClassRoomPage.tsx'), 'utf8');
  assert.match(classroom, /getClassSessionPhase\(summary\)/);
  assert.match(classroom, /Class Completed/);
  assert.match(classroom, /This class has already ended\./);

  const helper = readFileSync(join(src, 'shared/lib/classRoomPath.ts'), 'utf8');
  assert.match(helper, /`\/class\/\$\{bookingId\}`/);
});

test('cancel uses the existing token dialog and is hidden after start or cancel', () => {
  const noonClass = {
    ...booking,
    startTimeUtc: '2024-11-04T06:30:00.000Z', // 12:00 PM IST
    endTimeUtc: '2024-11-04T07:30:00.000Z',   // 1:00 PM IST
  };

  assert.equal(
    canOfferCancellation({ ...booking, status: 'CANCELLED' }, new Date('2024-11-01T00:00:00Z')),
    false,
  );
  assert.equal(canOfferCancellation(noonClass, new Date('2024-11-04T06:29:59.999Z')), true);
  assert.equal(canOfferCancellation(noonClass, new Date('2024-11-04T06:30:00.000Z')), false);
  assert.equal(canOfferCancellation(noonClass, new Date('2024-11-04T07:00:00.000Z')), false);
  assert.equal(canOfferCancellation(noonClass, new Date('2024-11-04T07:30:00.000Z')), false);
  assert.equal(canShowJoinClass(noonClass, new Date('2024-11-04T07:00:00.000Z')), true);
  assert.equal(canShowJoinClass(noonClass, new Date('2024-11-04T07:30:00.000Z')), false);

  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /canOfferCancellation\(booking\) \?/);
  assert.match(page, /Cancel Booking/);
  assert.match(page, /getClassSessionPhase\(booking\) === ['"]completed['"]/);
  assert.match(page, /CancelBookingDialog/);
  assert.match(page, /location\.state\?\.cancellationToken/);
  assert.doesNotMatch(page, /cancellationTokenHash/);
});

test('Back to Booking is a predictable Link to /book', () => {
  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /to=["']\/book["']/);
  assert.match(page, /Back to Booking/);
  assert.doesNotMatch(page, /history\.back/);
});

test('admin dashboard formats mentor clock with stored mentorTimezone, not the browser zone', () => {
  const widget = readFileSync(join(src, 'widgets/dashboard/ui/DashboardWidget.tsx'), 'utf8');
  const api = readFileSync(join(src, 'features/view-dashboard/api/index.ts'), 'utf8');
  const display = readFileSync(join(src, 'entities/booking/lib/display.ts'), 'utf8');

  assert.match(api, /mentorTimezone:\s*string/);
  assert.match(widget, /Time \(UTC\):/);
  assert.match(widget, /timeZone:\s*['"]UTC['"]/);
  assert.match(widget, /formatDateTime\(booking\.startTimeUtc\)/);
  assert.match(widget, /formatBookingTime\(booking\.startTimeUtc,\s*booking\.mentorTimezone\)/);
  assert.match(widget, /formatBookingTime\(booking\.endTimeUtc,\s*booking\.mentorTimezone\)/);
  assert.match(widget, /Mentor time:/);
  assert.match(widget, /formatTimezoneLabel\(booking\.mentorTimezone\)/);
  assert.match(widget, /timezone:\s*booking\.mentorTimezone/);
  assert.doesNotMatch(widget, /resolvedOptions\(\)/);
  assert.doesNotMatch(widget, /formatBookingTime\(booking\.startTimeUtc\)\s*[),]/);
  assert.match(display, /timeZone:\s*timezone/);
});

test('admin UTC and mentor-local clocks stay distinct for the same instant', () => {
  const instant = new Date('2024-11-04T15:00:00.000Z');
  const utc = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(instant);
  const mentor = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(instant);

  assert.equal(utc, '15:00');
  assert.match(mentor, /8:30/);
  assert.notEqual(mentor, utc);
});

test('refresh path is the access token, not GET /bookings/:id', () => {
  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /useParams/);
  assert.match(page, /useBookingAccess\(accessToken\)/);
  assert.doesNotMatch(page, /useBooking\(id\)/);
  const hook = readFileSync(join(src, 'features/view-booking/model/useBookingAccess.ts'), 'utf8');
  assert.doesNotMatch(hook, /localStorage/);
});
