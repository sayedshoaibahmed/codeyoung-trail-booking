import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

test('root route is the landing page and /book is the existing booking form', () => {
  const app = readFileSync(join(src, 'app/App.tsx'), 'utf8');
  assert.match(app, /path=["']\/["'][\s\S]*LandingPage/);
  assert.match(app, /path=["']\/book["'][\s\S]*BookingPage/);
  assert.match(app, /path=["']\/b\/:accessToken["']/);
  assert.match(app, /path=["']\/confirmation\/:id["']/);
  assert.match(app, /path=["']\/class\/:id["']/);
  assert.match(app, /path=["']\/admin["']/);
});

test('landing page CTA navigates to /book and has no booking API calls', () => {
  const page = readFileSync(join(here, 'LandingPage.tsx'), 'utf8');
  assert.match(page, /Book a FREE Trial Class/);
  assert.match(page, /to=["']\/book["']/);
  assert.match(page, /Free 1-Hour Trial/);
  assert.doesNotMatch(page, /useBookSlot/);
  assert.doesNotMatch(page, /useAvailability/);
  assert.doesNotMatch(page, /BookingFormWidget/);
  assert.doesNotMatch(page, /\/api\//);
});

test('booking page still uses BookingFormWidget and can return home', () => {
  const page = readFileSync(join(src, 'pages/booking/ui/BookingPage.tsx'), 'utf8');
  assert.match(page, /BookingFormWidget/);
  assert.match(page, /to=["']\/["']/);
  assert.match(page, /← Home/);
});
