import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const widget = readFileSync(join(here, 'BookingFormWidget.tsx'), 'utf8');

test('date change clears the selected slot immediately', () => {
  assert.match(widget, /useEffect\(\(\) => \{\s*setSelectedSlotIso\(null\);\s*\}, \[requestedDate\]\)/s);
});

test('date-change loading keeps the slot section and does not swap it for a full skeleton', () => {
  assert.match(widget, /Loading slots…/);
  assert.match(widget, /Checking availability for the selected date/);
  assert.match(widget, /aria-busy=\{isSlotsLoading\}/);
  assert.match(widget, /role="status"/);
  assert.doesNotMatch(widget, /animate-pulse grid grid-cols-2/);
});

test('previous slots cannot be selected or booked while the new date is loading', () => {
  assert.match(widget, /isSlotsLoading \? \(/);
  assert.match(widget, /pointer-events-none/);
  assert.match(widget, /disabled=\{!selectedSlotIso \|\| isSubmitting \|\| isSlotsLoading\}/);
  assert.match(widget, /if \(!selectedSlotIso \|\| isSubmitting \|\| isSlotsLoading\) return/);
  const slotArea = widget.slice(widget.indexOf('aria-busy={isSlotsLoading}'));
  const loadingBlock = slotArea.slice(0, slotArea.indexOf('slotsError'));
  assert.doesNotMatch(loadingBlock, /GroupedSlotGrid/);
  assert.match(slotArea, /GroupedSlotGrid/);
});

test('error and next-date empty states still wait until loading finishes', () => {
  assert.match(widget, /slotsError \? \(/);
  assert.match(widget, /shouldFindNextDate = !isSlotsLoading && !slotsError && !hasBookableSlot/);
});
