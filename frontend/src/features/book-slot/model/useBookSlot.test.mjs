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
    return 'This slot was just booked by another parent. Please choose another available time.';
  }
  return error.message || 'An error occurred.';
}

test('SLOT_NOT_AVAILABLE maps to a race-condition message, not a generic or empty-day error', () => {
  const message = bookingErrorDisplayMessage({
    code: 'SLOT_NOT_AVAILABLE',
    message: 'No mentor is available for the requested time slot.',
  });
  assert.match(message, /just booked by another parent/i);
  assert.doesNotMatch(message, /An error occurred/);
  assert.doesNotMatch(message, /No slots available for this date/);
});

test('other errors keep the backend message', () => {
  assert.equal(
    bookingErrorDisplayMessage({ code: 'LEAD_TIME_VIOLATION', message: 'Need more lead time.' }),
    'Need more lead time.',
  );
});

test('booking form refreshes availability and clears the slot after a conflict', () => {
  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /isSlotConflictError\(conflictError\)/);
  assert.match(widget, /refetchSlots\(\)/);
  assert.match(widget, /setSelectedSlotIso\(null\)/);
  assert.match(widget, /bookingErrorDisplayMessage/);
  assert.match(widget, /disabled=\{!selectedSlotIso \|\| isSubmitting\}/);
  assert.match(widget, /if \(!selectedSlotIso \|\| isSubmitting\) return/);
  assert.doesNotMatch(widget, /reset\(\)/);
});
