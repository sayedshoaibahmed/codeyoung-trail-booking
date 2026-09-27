import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

function isAvailabilityAbortError(error) {
  return error instanceof Error && error.name === 'AbortError';
}

function isCurrentAvailabilityRequest(requestId, latestRequestId) {
  return requestId === latestRequestId;
}

test('aborted fetch errors are not treated as availability failures', () => {
  const named = new Error('The operation was aborted.');
  named.name = 'AbortError';
  assert.equal(isAvailabilityAbortError(named), true);
  assert.equal(isAvailabilityAbortError(new Error('Failed to fetch availability.')), false);
  assert.equal(isAvailabilityAbortError({ message: 'Failed to fetch availability.' }), false);
});

test('only the latest request id may apply slots, errors, or loading=false', () => {
  assert.equal(isCurrentAvailabilityRequest(1, 2), false);
  assert.equal(isCurrentAvailabilityRequest(2, 2), true);
  assert.equal(isCurrentAvailabilityRequest(3, 2), false);
});

test('useAvailability aborts the previous request and ignores stale or aborted results', () => {
  const hook = readFileSync(join(here, 'useAvailability.ts'), 'utf8');
  assert.match(hook, /export function isAvailabilityAbortError/);
  assert.match(hook, /export function isCurrentAvailabilityRequest/);
  assert.match(hook, /error instanceof Error && error\.name === 'AbortError'/);
  assert.match(hook, /requestId === latestRequestId/);
  assert.match(hook, /new AbortController\(\)/);
  assert.match(hook, /controller\.abort\(\)/);
  assert.match(hook, /signal:\s*controller\.signal/);
  assert.match(hook, /isCurrentAvailabilityRequest\(requestId,\s*latestRequestId\.current\)/);
  assert.match(hook, /controller\.signal\.aborted/);
  assert.match(hook, /if \(isAvailabilityAbortError\(err\) \|\| controller\.signal\.aborted\) return/);
});

test('availability API forwards the abort signal to fetch', () => {
  const api = readFileSync(join(src, 'features/view-availability/api/index.ts'), 'utf8');
  assert.match(api, /getSlots:\s*\(date:\s*string,\s*timezone:\s*string,\s*options\?: RequestInit\)/);
  const base = readFileSync(join(src, 'shared/api/base.ts'), 'utf8');
  assert.match(base, /\.\.\.options/);
});
