/**
 * User-facing timezone labels. Internal booking values stay IANA.
 * Does not convert instants or change booking rules.
 */

const INDIA_ZONES = new Set(['Asia/Kolkata', 'Asia/Calcutta']);

export function formatTimezoneLabel(ianaTimezone: string, at: Date = new Date()): string {
  const id = ianaTimezone.trim();

  if (INDIA_ZONES.has(id)) {
    return 'India Standard Time (IST)';
  }
  if (id === 'Asia/Dubai') {
    return 'Gulf Standard Time (GST)';
  }
  if (id === 'Asia/Singapore') {
    return 'Singapore Time (SGT)';
  }
  if (id === 'America/New_York') {
    return 'Eastern Time (ET)';
  }

  try {
    const longName = zoneName(id, at, 'long');
    const shortName = zoneName(id, at, 'short');
    if (longName && shortName && !shortName.startsWith('GMT')) {
      return `${longName} (${shortName})`;
    }
    if (longName) {
      return longName;
    }
  } catch {
    // Invalid IANA — fall through to the stored identifier.
  }

  return id;
}

/** Mentor subtitle. India uses the short “India (IST)” form requested in the UI. */
export function formatMentorCaption(ianaTimezone: string, at: Date = new Date()): string {
  const id = ianaTimezone.trim();
  if (INDIA_ZONES.has(id)) {
    return 'Mentor · India (IST)';
  }
  return `Mentor · ${formatTimezoneLabel(id, at)}`;
}

function zoneName(
  ianaTimezone: string,
  at: Date,
  timeZoneName: 'long' | 'short',
): string | undefined {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    timeZoneName,
  })
    .formatToParts(at)
    .find((part) => part.type === 'timeZoneName')?.value;
}
