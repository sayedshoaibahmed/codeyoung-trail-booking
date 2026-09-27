import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

test('next-available-date is requested only when the selected day has zero bookable slots', () => {
  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /hasBookableSlot = slots\.some\(isSlotSelectable\)/);
  assert.match(widget, /shouldFindNextDate = !isSlotsLoading && !slotsError && !hasBookableSlot/);
  assert.match(widget, /useNextAvailableDate\(requestedDate, timezone, shouldFindNextDate\)/);
  assert.match(widget, /NextAvailableDateNotice/);
  assert.match(widget, /setValue\('requestedDate', date/);
  assert.doesNotMatch(widget, /new Date\(requestedDate\)\.toISOString\(\)\.slice\(0,\s*10\)/);
});

test('full-day message and next-date CTA stay on the booking page', () => {
  const notice = readFileSync(join(src, 'features/view-availability/ui/NextAvailableDateNotice.tsx'), 'utf8');
  assert.match(notice, /All slots are booked for this date/);
  assert.match(notice, /Next available date:/);
  assert.match(notice, /formatCalendarDateLabel\(selectedDate\)/);
  assert.match(notice, /formatCalendarDateLabel\(nextAvailableDate\)/);
  assert.match(notice, /Select this date/);
  assert.match(notice, /Checking the next available date/);
  assert.match(notice, /No trial slots are currently available in the next 30 days/);
  const hook = readFileSync(join(here, 'useNextAvailableDate.ts'), 'utf8');
  assert.match(hook, /We couldn't check future availability/);
  assert.match(hook, /new AbortController\(\)/);
  assert.match(hook, /controller\.abort\(\)/);
  assert.match(notice, /onViewSlots\(nextAvailableDate\)/);
  assert.doesNotMatch(notice, /navigate\(/);
  assert.doesNotMatch(notice, /window\.location/);
});

test('next-date API reuses /availability/next with the selected calendar date', () => {
  const api = readFileSync(join(src, 'features/view-availability/api/index.ts'), 'utf8');
  assert.match(api, /\/availability\/next\?date=/);
  assert.match(api, /getNextAvailableDate:\s*\(date:\s*string,\s*timezone:\s*string,\s*options\?: RequestInit\)/);
});

test('SLOT_NOT_AVAILABLE race recovery is unchanged', () => {
  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /isSlotConflictError\(conflictError\)/);
  assert.match(widget, /refetchSlots\(\)/);
  assert.match(widget, /setSelectedSlotIso\(null\)/);
  const hook = readFileSync(join(src, 'features/book-slot/model/useBookSlot.ts'), 'utf8');
  assert.match(hook, /SLOT_NO_LONGER_AVAILABLE_MESSAGE/);
});
