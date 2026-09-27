import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..');

function formatTimezoneLabel(ianaTimezone, at = new Date()) {
  const id = ianaTimezone.trim();
  if (id === 'Asia/Kolkata' || id === 'Asia/Calcutta') {
    return 'India Standard Time (IST)';
  }
  if (id === 'Asia/Dubai') return 'Gulf Standard Time (GST)';
  if (id === 'Asia/Singapore') return 'Singapore Time (SGT)';
  if (id === 'America/New_York') return 'Eastern Time (ET)';
  try {
    const longName = new Intl.DateTimeFormat('en-US', {
      timeZone: id,
      timeZoneName: 'long',
    }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
    const shortName = new Intl.DateTimeFormat('en-US', {
      timeZone: id,
      timeZoneName: 'short',
    }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
    if (longName && shortName && !shortName.startsWith('GMT')) {
      return `${longName} (${shortName})`;
    }
    if (longName) return longName;
  } catch {
    // fall through
  }
  return id;
}

function formatMentorCaption(ianaTimezone, at = new Date()) {
  const id = ianaTimezone.trim();
  if (id === 'Asia/Kolkata' || id === 'Asia/Calcutta') {
    return 'Mentor · India (IST)';
  }
  return `Mentor · ${formatTimezoneLabel(id, at)}`;
}

test('Asia/Kolkata and Asia/Calcutta both display as India Standard Time (IST)', () => {
  assert.equal(formatTimezoneLabel('Asia/Kolkata'), 'India Standard Time (IST)');
  assert.equal(formatTimezoneLabel('Asia/Calcutta'), 'India Standard Time (IST)');
});

test('known international zones use friendly labels', () => {
  assert.equal(formatTimezoneLabel('America/New_York'), 'Eastern Time (ET)');
  assert.equal(formatTimezoneLabel('Asia/Dubai'), 'Gulf Standard Time (GST)');
  assert.equal(formatTimezoneLabel('Asia/Singapore'), 'Singapore Time (SGT)');
});

test('Europe/London label follows the actual date (GMT vs BST)', () => {
  const winter = formatTimezoneLabel('Europe/London', new Date('2024-01-15T12:00:00.000Z'));
  const summer = formatTimezoneLabel('Europe/London', new Date('2024-07-15T12:00:00.000Z'));
  assert.match(winter, /Greenwich Mean Time|GMT/);
  assert.match(summer, /British Summer Time|BST/);
});

test('mentor caption uses India (IST) for both India IANA aliases', () => {
  assert.equal(formatMentorCaption('Asia/Kolkata'), 'Mentor · India (IST)');
  assert.equal(formatMentorCaption('Asia/Calcutta'), 'Mentor · India (IST)');
});

test('shared utility source treats Kolkata and Calcutta as equivalent display aliases', () => {
  const lib = readFileSync(join(here, 'timezoneLabel.ts'), 'utf8');
  assert.match(lib, /Asia\/Kolkata/);
  assert.match(lib, /Asia\/Calcutta/);
  assert.match(lib, /India Standard Time \(IST\)/);
  assert.match(lib, /Mentor · India \(IST\)/);
});

test('parent timezone still comes from browser Intl, not country or geolocation', () => {
  const form = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  assert.match(form, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
  assert.doesNotMatch(form, /geolocation/i);
  assert.doesNotMatch(form, /navigator\.geolocation/);
  assert.doesNotMatch(form, /ip-api|ipinfo|maxmind|geoip/i);
  assert.match(form, /parentTimezone:\s*timezone/);
  assert.match(form, /formatTimezoneLabel\(timezone\)/);
});

test('booking UI does not render raw India IANA ids in user-facing markup', () => {
  const card = readFileSync(join(src, 'entities/booking/ui/BookingDetailCard.tsx'), 'utf8');
  const badge = readFileSync(join(src, 'entities/mentor/ui/MentorBadge.tsx'), 'utf8');
  const form = readFileSync(join(src, 'widgets/booking-form/ui/BookingFormWidget.tsx'), 'utf8');
  const classroom = readFileSync(join(src, 'pages/class-room/ui/ClassRoomPage.tsx'), 'utf8');
  const admin = readFileSync(join(src, 'widgets/dashboard/ui/DashboardWidget.tsx'), 'utf8');

  for (const source of [card, badge, form, classroom, admin]) {
    assert.doesNotMatch(source, />\{\s*booking\.parentTimezone\s*\}/);
    assert.doesNotMatch(source, />\{\s*booking\.mentorTimezone\s*\}/);
    assert.doesNotMatch(source, />\{\s*timezone\s*\}</);
    assert.doesNotMatch(source, /Timezone:\s*\{summary\.parentTimezone\}/);
    assert.doesNotMatch(source, /Mentor time \(\{booking\.mentorTimezone\}\)/);
  }

  assert.doesNotMatch(card, /Asia\/Kolkata/);
  assert.doesNotMatch(card, /Asia\/Calcutta/);
  assert.doesNotMatch(badge, /Asia\/Kolkata/);
  assert.doesNotMatch(form, /Asia\/Calcutta/);
  assert.doesNotMatch(classroom, /Asia\/Kolkata/);
  assert.doesNotMatch(admin, /timezone:\s*['"]Asia\/Kolkata['"]/);
});

test('detail card always renders both parent and mentor time sections', () => {
  const card = readFileSync(join(src, 'entities/booking/ui/BookingDetailCard.tsx'), 'utf8');
  assert.match(card, /Your local time/);
  assert.match(card, /Mentor time/);
  assert.match(card, /formatTimezoneLabel\(booking\.parentTimezone\)/);
  assert.match(card, /formatTimezoneLabel\(booking\.mentorTimezone\)/);
  assert.match(card, /formatBookingTime\(booking\.startTimeUtc,\s*booking\.parentTimezone\)/);
  assert.match(card, /formatBookingTime\(booking\.startTimeUtc,\s*booking\.mentorTimezone\)/);
  assert.doesNotMatch(card, /parentTimezone\s*===\s*mentorTimezone/);
  assert.doesNotMatch(card, /if\s*\(.*same.*timezone/i);
});
