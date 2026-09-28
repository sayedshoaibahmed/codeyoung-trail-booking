import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

test('View Booking route opens details from the access token, not localStorage or booking id', () => {
  const app = readFileSync(join(src, 'app/App.tsx'), 'utf8');
  assert.match(app, /path=["']\/b\/:accessToken["']/);
  assert.match(app, /BookingAccessPage/);

  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /useBookingAccess\(accessToken\)/);
  assert.match(page, /BookingDetailCard/);
  assert.match(page, /Join Class/);
  assert.match(page, /CancelBookingDialog/);
  assert.match(page, /canOfferCancellation/);
  assert.match(page, /canShowJoinClass/);
  assert.match(page, /getClassSessionPhase/);
  assert.match(page, /Class Completed/);
  assert.match(page, /classRoomPath\(booking\.id\)/);
  assert.doesNotMatch(page, /window\.localStorage/);
  assert.doesNotMatch(page, /getBooking\(id\)/);

  const hook = readFileSync(join(here, 'useBookingAccess.ts'), 'utf8');
  assert.match(hook, /getBookingByAccessToken/);
  assert.match(hook, /AbortController/);
  assert.match(hook, /Booking link is invalid or has expired/);
  assert.doesNotMatch(hook, /window\.localStorage/);
  assert.doesNotMatch(hook, /\/bookings\/\$\{/);

  const api = readFileSync(join(src, 'entities/booking/api/index.ts'), 'utf8');
  assert.match(api, /\/booking-access/);
  assert.match(api, /method:\s*['"]POST['"]/);
  assert.match(api, /accessToken/);
  assert.doesNotMatch(api, /\?token=/);
});

test('failed access shows a safe message and does not mention booking existence', () => {
  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /Booking link is invalid or has expired/);
  assert.doesNotMatch(page, /was not found/);
});

test('View Booking paints a loading shell immediately', () => {
  const page = readFileSync(join(src, 'pages/booking-access/ui/BookingAccessPage.tsx'), 'utf8');
  assert.match(page, /Loading booking details/);
  assert.match(page, /aria-busy/);
  assert.match(page, /isLoading/);
});
