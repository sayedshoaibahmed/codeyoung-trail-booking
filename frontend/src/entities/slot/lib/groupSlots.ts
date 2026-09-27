import type { AvailableSlot } from '../model/types';

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export const DAY_PARTS: ReadonlyArray<{ id: DayPart; label: string }> = [
  { id: 'morning', label: '🌅 Morning' },
  { id: 'afternoon', label: '☀️ Afternoon' },
  { id: 'evening', label: '🌆 Evening' },
  { id: 'night', label: '🌙 Night' },
];

/**
 * Groups by the slot's displayed local clock hour (startLocal HH:mm).
 * Morning 05:00–11:59 (09:00 onward is the core morning block),
 * Afternoon 12:00–16:59, Evening 17:00–20:59, Night 21:00–04:59.
 */
export function dayPartFromHour(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function hourFromLocalTime(startLocal: string): number {
  const hour = Number(startLocal.slice(0, 2));
  return Number.isFinite(hour) ? hour : 0;
}

export function minuteFromLocalTime(startLocal: string): number {
  const minute = Number(startLocal.slice(3, 5));
  return Number.isFinite(minute) ? minute : 0;
}

/** Minutes from 05:00 so Night (21:00→04:59) follows Evening, not calendar midnight. */
export function scheduleSortMinutes(startLocal: string): number {
  const hour = hourFromLocalTime(startLocal);
  const minute = minuteFromLocalTime(startLocal);
  const minutesFromMidnight = hour * 60 + minute;
  const dawn = 5 * 60;
  return minutesFromMidnight >= dawn
    ? minutesFromMidnight - dawn
    : minutesFromMidnight + (24 * 60 - dawn);
}

export function compareSlotsByStart(a: AvailableSlot, b: AvailableSlot): number {
  const byLocal = scheduleSortMinutes(a.startLocal) - scheduleSortMinutes(b.startLocal);
  if (byLocal !== 0) return byLocal;
  return new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
}

export function groupSlotsByDayPart(slots: AvailableSlot[]): Record<DayPart, AvailableSlot[]> {
  const groups: Record<DayPart, AvailableSlot[]> = {
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  };
  const seen = new Set<string>();

  for (const slot of slots) {
    if (seen.has(slot.startUtc)) continue;
    seen.add(slot.startUtc);
    groups[dayPartFromHour(hourFromLocalTime(slot.startLocal))].push(slot);
  }

  (Object.keys(groups) as DayPart[]).forEach((part) => {
    groups[part].sort(compareSlotsByStart);
  });

  return groups;
}

export function isSlotSelectable(slot: AvailableSlot): boolean {
  return slot.status === 'available';
}

export function slotStatusLabel(slot: AvailableSlot): string | null {
  if (slot.status === 'full') return 'Fully booked';
  if (slot.status === 'blocked') return 'Unavailable';
  return null;
}
