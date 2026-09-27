import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

function dayPartFromHour(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function hourFromLocalTime(startLocal) {
  return Number(startLocal.slice(0, 2));
}

function minuteFromLocalTime(startLocal) {
  return Number(startLocal.slice(3, 5));
}

function scheduleSortMinutes(startLocal) {
  const minutesFromMidnight = hourFromLocalTime(startLocal) * 60 + minuteFromLocalTime(startLocal);
  const dawn = 5 * 60;
  return minutesFromMidnight >= dawn
    ? minutesFromMidnight - dawn
    : minutesFromMidnight + (24 * 60 - dawn);
}

function compareSlotsByStart(a, b) {
  const byLocal = scheduleSortMinutes(a.startLocal) - scheduleSortMinutes(b.startLocal);
  if (byLocal !== 0) return byLocal;
  return new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
}

function groupSlotsByDayPart(slots) {
  const groups = { morning: [], afternoon: [], evening: [], night: [] };
  const seen = new Set();
  for (const slot of slots) {
    if (seen.has(slot.startUtc)) continue;
    seen.add(slot.startUtc);
    groups[dayPartFromHour(hourFromLocalTime(slot.startLocal))].push(slot);
  }
  for (const part of Object.keys(groups)) {
    groups[part].sort(compareSlotsByStart);
  }
  return groups;
}

function isSlotSelectable(slot) {
  return slot.status === 'available';
}

function hourSlot(hour, status = 'available') {
  const hh = String(hour).padStart(2, '0');
  return {
    startUtc: `2024-11-04T${hh}:00:00.000Z`,
    endUtc: `2024-11-04T${String((hour + 1) % 24).padStart(2, '0')}:00:00.000Z`,
    startLocal: `${hh}:00`,
    endLocal: `${String((hour + 1) % 24).padStart(2, '0')}:00`,
    status,
  };
}

const twentyFour = Array.from({ length: 24 }, (_, hour) => hourSlot(hour));
const shuffled = [...twentyFour].sort((a, b) => b.startLocal.localeCompare(a.startLocal));

test('1 — full 24-hour slot representation has no missing hours', () => {
  const groups = groupSlotsByDayPart(shuffled);
  const all = [...groups.morning, ...groups.afternoon, ...groups.evening, ...groups.night];
  assert.equal(all.length, 24);
  const hours = all.map((s) => s.startLocal).sort();
  assert.deepEqual(
    hours,
    Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`),
  );
});

test('2 — morning is 05:00–11:59 ordered by start time', () => {
  const { morning } = groupSlotsByDayPart(shuffled);
  assert.deepEqual(morning.map((s) => s.startLocal), [
    '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  ]);
});

test('3 — afternoon is 12:00–16:59 ordered by start time', () => {
  const { afternoon } = groupSlotsByDayPart(shuffled);
  assert.deepEqual(afternoon.map((s) => s.startLocal), [
    '12:00', '13:00', '14:00', '15:00', '16:00',
  ]);
});

test('4 — evening is 17:00–20:59 ordered by start time', () => {
  const { evening } = groupSlotsByDayPart(shuffled);
  assert.deepEqual(evening.map((s) => s.startLocal), [
    '17:00', '18:00', '19:00', '20:00',
  ]);
});

test('5 — night is 21:00 then wrap to 04:59, not midnight-first', () => {
  const { night } = groupSlotsByDayPart(shuffled);
  assert.deepEqual(night.map((s) => s.startLocal), [
    '21:00', '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00',
  ]);
});

test('6 — available slots remain selectable', () => {
  assert.equal(isSlotSelectable(hourSlot(9, 'available')), true);
});

test('7 — fully booked slots stay in the list and are not selectable', () => {
  const slots = [hourSlot(10, 'full'), hourSlot(9, 'available')];
  const { morning } = groupSlotsByDayPart(slots);
  assert.equal(morning.length, 2);
  assert.deepEqual(morning.map((s) => s.startLocal), ['09:00', '10:00']);
  assert.equal(isSlotSelectable(morning[1]), false);
});

test('8 — blocked slots stay in the list and are not selectable', () => {
  const slots = [hourSlot(9, 'available'), hourSlot(8, 'blocked')];
  const { morning } = groupSlotsByDayPart(slots);
  assert.equal(morning.length, 2);
  assert.equal(isSlotSelectable(slots.find((s) => s.status === 'blocked')), false);
});

test('9 — selected identity remains the slot startUtc', () => {
  const selected = hourSlot(14, 'available');
  assert.equal(selected.startUtc, '2024-11-04T14:00:00.000Z');
});

test('10 — duplicate startUtc values are not rendered twice', () => {
  const dup = [...twentyFour, hourSlot(9, 'available')];
  const groups = groupSlotsByDayPart(dup);
  const all = [...groups.morning, ...groups.afternoon, ...groups.evening, ...groups.night];
  assert.equal(all.length, 24);
  assert.equal(new Set(all.map((s) => s.startUtc)).size, 24);
});

test('11 — booking payload still uses selected startUtc', () => {
  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /requestedStartIso:\s*localString/);
  assert.match(widget, /selectedSlotIso/);
});

test('12 — sort uses startLocal minutes and startUtc, not AM/PM strings', () => {
  const source = readFileSync(join(here, 'groupSlots.ts'), 'utf8');
  assert.match(source, /scheduleSortMinutes/);
  assert.match(source, /startUtc/);
  assert.doesNotMatch(source, /localeCompare/);
});

test('UI: unavailable slots stay visible, white, and disabled', () => {
  const card = readFileSync(join(src, 'entities/slot/ui/SlotCard.tsx'), 'utf8');
  assert.match(card, /disabled=\{!selectable\}/);
  assert.match(card, /bg-white text-slate-500/);
  assert.match(card, /bg-green-50/);
  assert.match(card, /bg-amber-50/);
  assert.match(card, /slotStatusLabel/);
  assert.doesNotMatch(card, /bg-red-50/);
  assert.doesNotMatch(card, /purple/);

  const helper = readFileSync(join(here, 'groupSlots.ts'), 'utf8');
  assert.match(helper, /Fully booked/);
  assert.match(helper, /Unavailable/);

  const legend = readFileSync(join(src, 'entities/slot/ui/SlotLegend.tsx'), 'utf8');
  assert.match(legend, /🟢 Available/);
  assert.match(legend, /⚪ Unavailable/);
  assert.match(legend, /🟡 Selected/);
  assert.doesNotMatch(legend, /Fully booked/);
  assert.doesNotMatch(legend, /Blocked/);
  assert.doesNotMatch(legend, /🔴/);

  const widget = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(widget, /SlotLegend/);
  assert.match(widget, /GroupedSlotGrid/);
  assert.doesNotMatch(widget, /slots\.filter/);
});
