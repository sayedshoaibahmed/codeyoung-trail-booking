import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

function isSlotConflictError(error) {
  return error?.code === 'SLOT_NOT_AVAILABLE';
}

function bookingErrorDisplayMessage(error) {
  if (isSlotConflictError(error)) {
    return 'This time is no longer available. Please choose another slot.';
  }
  return error.message || 'An error occurred.';
}

function formatAlternateSlot(startUtc, timezone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(startUtc));
}

test('alternate slot formatting uses the supplied parent timezone, not the browser default', () => {
  const startUtc = '2024-11-04T15:00:00.000Z';
  const inNewYork = formatAlternateSlot(startUtc, 'America/New_York');
  const inKolkata = formatAlternateSlot(startUtc, 'Asia/Kolkata');
  const inLondon = formatAlternateSlot(startUtc, 'Europe/London');

  assert.match(inNewYork, /10:00\sAM/);
  assert.match(inKolkata, /8:30\sPM/);
  assert.match(inLondon, /3:00\sPM/);
  assert.notEqual(inNewYork, inKolkata);
  assert.notEqual(inNewYork, inLondon);

  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /timeZone:\s*timezone/);
  assert.match(widget, /bookingError\.alternateSlots/);
});

test('SLOT_NOT_AVAILABLE uses a neutral unavailable message, not a race claim', () => {
  const message = bookingErrorDisplayMessage({
    code: 'SLOT_NOT_AVAILABLE',
    message: 'No mentor is available for the requested time slot.',
  });
  assert.match(message, /no longer available/i);
  assert.doesNotMatch(message, /just booked by another parent/i);
  assert.doesNotMatch(message, /An error occurred/);
  assert.doesNotMatch(message, /No slots available for this date/);
});

test('SLOT_NOT_AVAILABLE with alternate slots still keeps the alternate-slot UI', () => {
  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /bookingError\.alternateSlots && bookingError\.alternateSlots\.length > 0/);
  assert.match(widget, /Alternative available slots/);
  assert.match(widget, /alt\.startUtc/);
  assert.match(widget, /timeZone:\s*timezone/);
});

test('other errors keep the backend message', () => {
  assert.equal(
    bookingErrorDisplayMessage({ code: 'LEAD_TIME_VIOLATION', message: 'Need more lead time.' }),
    'Need more lead time.',
  );
  assert.equal(
    bookingErrorDisplayMessage({ code: 'DST_AMBIGUOUS_TIME', message: 'Time is ambiguous.' }),
    'Time is ambiguous.',
  );
  assert.equal(
    bookingErrorDisplayMessage({ code: 'DST_NONEXISTENT_TIME', message: 'Time does not exist.' }),
    'Time does not exist.',
  );
  assert.equal(
    bookingErrorDisplayMessage({ code: 'INVALID_TIMEZONE', message: 'Unknown IANA timezone.' }),
    'Unknown IANA timezone.',
  );
  assert.equal(
    bookingErrorDisplayMessage({ code: 'SLOT_OUTSIDE_SHIFT', message: 'Outside shift.' }),
    'Outside shift.',
  );
});

test('booking form refreshes availability and clears the slot after a conflict', () => {
  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  const hook = readFileSync(join(here, 'useBookSlot.ts'), 'utf8');
  assert.match(widget, /isSlotConflictError\(conflictError\)/);
  assert.match(widget, /refetchSlots\(\)/);
  assert.match(widget, /setSelectedSlotIso\(null\)/);
  assert.match(widget, /bookingErrorDisplayMessage/);
  assert.match(widget, /disabled=\{!selectedSlotIso \|\| isSubmitting \|\| isSlotsLoading\}/);
  assert.match(widget, /if \(!selectedSlotIso \|\| isSubmitting \|\| isSlotsLoading\) return/);
  assert.doesNotMatch(widget, /reset\(\)/);
  assert.match(hook, /SLOT_NO_LONGER_AVAILABLE_MESSAGE/);
  assert.doesNotMatch(hook, /just booked by another parent/);
});
