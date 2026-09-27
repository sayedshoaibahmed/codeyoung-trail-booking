/**
 * Calendar-date helpers. Operates on YYYY-MM-DD strings only.
 * Do not convert through local Date#toISOString() — that can shift the day.
 */

export function formatCalendarDateLabel(ymd: string): string {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
