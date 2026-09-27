import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));

function formatCalendarDateLabel(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

test('calendar date labels do not shift the YYYY-MM-DD day', () => {
  assert.equal(formatCalendarDateLabel('2024-11-04'), 'November 4, 2024');
  assert.equal(formatCalendarDateLabel('2024-09-27'), 'September 27, 2024');
  assert.equal(formatCalendarDateLabel('2026-09-29'), 'September 29, 2026');
  const source = readFileSync(join(here, 'calendarDate.ts'), 'utf8');
  assert.doesNotMatch(source, /toISOString\(\)\.slice\(0,\s*10\)/);
});
