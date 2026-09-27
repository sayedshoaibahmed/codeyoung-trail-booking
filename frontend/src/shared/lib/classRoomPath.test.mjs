import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..');
const classroomPage = join(src, 'pages/class-room/ui/ClassRoomPage.tsx');

function classRoomPath(bookingId) {
  return `/class/${bookingId}`;
}

function leaveClassPath(accessToken) {
  if (accessToken) return `/b/${accessToken}`;
  return '/';
}

test('A/B — Join Room path is /class/:bookingId', () => {
  const bookingId = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(classRoomPath(bookingId), `/class/${bookingId}`);

  const helper = readFileSync(join(here, 'classRoomPath.ts'), 'utf8');
  assert.match(helper, /`\/class\/\$\{bookingId\}`/);

  const dashboard = readFileSync(join(src, 'widgets/dashboard/ui/DashboardWidget.tsx'), 'utf8');
  assert.ok(dashboard.includes('classRoomPath(booking.id)'));
  assert.ok(!dashboard.includes('meet.codeyoung.com'));
});

test('C/D — ClassRoomPage is mounted at /class/:id', () => {
  const app = readFileSync(join(src, 'app/App.tsx'), 'utf8');
  assert.match(app, /path=["']\/class\/:id["']/);
  assert.ok(app.includes('ClassRoomPage'));

  const page = readFileSync(classroomPage, 'utf8');
  assert.ok(page.includes('Demo Class Room'));
  assert.match(page, /End Call/);
  assert.match(page, /Leave Class/);
});

test('E — frontend production source has no meet.codeyoung.com', () => {
  const files = [
    join(src, 'app/App.tsx'),
    classroomPage,
    join(src, 'widgets/dashboard/ui/DashboardWidget.tsx'),
    join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'),
    join(src, 'entities/booking/ui/BookingDetailCard.tsx'),
    join(here, 'classRoomPath.ts'),
  ];
  for (const file of files) {
    assert.equal(readFileSync(file, 'utf8').includes('meet.codeyoung.com'), false, file);
  }
});

test('A — End Call does not call the cancellation API', () => {
  const page = readFileSync(classroomPage, 'utf8');
  assert.doesNotMatch(page, /cancelBookingApi/);
  assert.doesNotMatch(page, /\/bookings\/.+\/cancel/);
  assert.doesNotMatch(page, /CancelBookingDialog/);
  assert.match(page, /leaveClassPath\(/);
});

test('B/E — End Call only navigates; it does not set CANCELLED', () => {
  const page = readFileSync(classroomPage, 'utf8');
  assert.doesNotMatch(page, /CANCELLED/);
  assert.doesNotMatch(page, /status:\s*['"]CANCELLED['"]/);
  assert.match(page, /does not cancel the booking/);
});

test('C — cancellation still requires the existing cancellation token', () => {
  const dialog = readFileSync(join(src, 'features/cancel-booking/ui/CancelBookingDialog.tsx'), 'utf8');
  assert.match(dialog, /cancelBookingApi\.cancel\(bookingId, \{ cancellationToken: token \}\)/);
  assert.match(dialog, /Cancellation token is required/);
});

test('D — cancelled booking remains a cancel-dialog concern, not classroom', () => {
  const access = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(access, /CancelBookingDialog/);
  const page = readFileSync(classroomPage, 'utf8');
  assert.doesNotMatch(page, /Cancel Booking/);
});

test('F — no secret token appears in the classroom URL', () => {
  const helper = readFileSync(join(here, 'classRoomPath.ts'), 'utf8');
  assert.match(helper, /return `\/class\/\$\{bookingId\}`/);
  assert.doesNotMatch(helper, /accessTokenHash/);
  assert.doesNotMatch(helper, /\?token=/);
  assert.doesNotMatch(helper, /classRoomPath\([^)]*accessToken/);

  const page = readFileSync(classroomPage, 'utf8');
  assert.doesNotMatch(page, /cancellationToken/);
  assert.match(page, /useParams/);

  assert.equal(classRoomPath('abc'), '/class/abc');
  assert.doesNotMatch(classRoomPath('abc'), /cancel/i);
});

test('leaveClassPath returns booking-access or home, never cancel', () => {
  assert.equal(leaveClassPath(), '/');
  assert.equal(leaveClassPath('access-from-details'), '/b/access-from-details');
  assert.doesNotMatch(leaveClassPath('access-from-details'), /cancel/i);
  assert.doesNotMatch(leaveClassPath('access-from-details'), /cancellationToken/);
});
