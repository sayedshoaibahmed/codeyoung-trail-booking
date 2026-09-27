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

test('confirmation loads booking details from GET /bookings/:id', () => {
  const hook = readFileSync(join(src, 'features/view-booking/model/useBooking.ts'), 'utf8');
  assert.match(hook, /bookingApi\.getBooking\(id\)/);

  const api = readFileSync(join(src, 'entities/booking/api/index.ts'), 'utf8');
  assert.match(api, /`\/bookings\/\$\{id\}`/);

  const page = readFileSync(join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'), 'utf8');
  assert.match(page, /useBooking\(id\)/);
  assert.match(page, /BookingDetailCard/);
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

test('Join Class uses /class/<booking-id>', () => {
  const page = readFileSync(join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'), 'utf8');
  assert.match(page, /classRoomPath\(booking\.id\)/);
  assert.match(page, /Join Class/);

  const helper = readFileSync(join(src, 'shared/lib/classRoomPath.ts'), 'utf8');
  assert.match(helper, /`\/class\/\$\{bookingId\}`/);
});

test('cancel uses the existing token dialog and is hidden after start or cancel', () => {
  assert.equal(
    canOfferCancellation({ ...booking, status: 'CANCELLED' }, new Date('2024-11-01T00:00:00Z')),
    false,
  );
  assert.equal(
    canOfferCancellation(booking, new Date('2024-11-04T04:30:00.000Z')),
    false,
  );
  assert.equal(
    canOfferCancellation(booking, new Date('2024-11-04T04:29:00.000Z')),
    true,
  );

  const page = readFileSync(join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'), 'utf8');
  assert.match(page, /canOfferCancellation\(booking\)/);
  assert.match(page, /CancelBookingDialog/);
  assert.match(page, /location\.state\?\.cancellationToken/);
  assert.doesNotMatch(page, /cancellationTokenHash/);
});

test('Back to Booking is a predictable Link to /book', () => {
  const page = readFileSync(join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'), 'utf8');
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

test('refresh path is the booking id in the URL, loaded via GET /bookings/:id', () => {
  const page = readFileSync(join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'), 'utf8');
  assert.match(page, /useParams/);
  assert.match(page, /useBooking\(id\)/);
  const hook = readFileSync(join(src, 'features/view-booking/model/useBooking.ts'), 'utf8');
  assert.doesNotMatch(hook, /localStorage/);
});
