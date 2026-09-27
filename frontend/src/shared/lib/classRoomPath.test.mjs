import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..');

function classRoomPath(bookingId) {
  return `/class/${bookingId}`;
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

  const page = readFileSync(join(src, 'pages/class-room/ui/ClassRoomPage.tsx'), 'utf8');
  assert.ok(page.includes('useBooking(id)'));
  assert.ok(page.includes('Demo Class Room'));
});

test('E — frontend production source has no meet.codeyoung.com', () => {
  const files = [
    join(src, 'app/App.tsx'),
    join(src, 'pages/class-room/ui/ClassRoomPage.tsx'),
    join(src, 'widgets/dashboard/ui/DashboardWidget.tsx'),
    join(src, 'pages/confirmation/ui/ConfirmationPage.tsx'),
    join(src, 'entities/booking/ui/BookingDetailCard.tsx'),
    join(here, 'classRoomPath.ts'),
  ];
  for (const file of files) {
    assert.equal(readFileSync(file, 'utf8').includes('meet.codeyoung.com'), false, file);
  }
});
