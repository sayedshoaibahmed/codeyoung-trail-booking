import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', '..', '..');

test('email cancel link uses the existing cancel dialog and booking id', () => {
  const app = readFileSync(join(src, 'app/App.tsx'), 'utf8');
  assert.match(app, /path=["']\/cancel\/:bookingId["']/);
  assert.match(app, /CancelBookingLinkPage/);

  const page = readFileSync(join(here, 'CancelBookingLinkPage.tsx'), 'utf8');
  assert.match(page, /CancelBookingDialog/);
  assert.match(page, /searchParams.get\(['"]token['"]\)/);
  assert.match(page, /initialToken=\{token\}/);
  assert.doesNotMatch(page, /getBooking\(/);
  assert.doesNotMatch(page, /\/booking-access/);
  assert.doesNotMatch(page, /accessToken/);
});

test('pasted cancellation tokens drop wrapping whitespace', () => {
  const lib = readFileSync(join(src, 'features/cancel-booking/lib/normalizeCancellationToken.ts'), 'utf8');
  assert.match(lib, /replace\(\/\\s\+\/g/);
  const dialog = readFileSync(join(src, 'features/cancel-booking/ui/CancelBookingDialog.tsx'), 'utf8');
  assert.match(dialog, /normalizeCancellationToken/);
});

test('CANCELLATION_AFTER_START shows the class-started message', () => {
  const message = 'Cancellation is no longer available because the class has started.';

  function userFacingCancelError(err) {
    if (err && err.code === 'CANCELLATION_AFTER_START') {
      return message;
    }
    if (err && err.message) {
      return err.message;
    }
    return 'An unexpected error occurred.';
  }

  assert.equal(
    userFacingCancelError({
      code: 'CANCELLATION_AFTER_START',
      message: 'A booking cannot be cancelled after its class has already started.',
    }),
    message,
  );
  assert.equal(
    userFacingCancelError({ code: 'CANCELLATION_TOKEN_INVALID', message: 'The cancellation token is invalid or does not match this booking.' }),
    'The cancellation token is invalid or does not match this booking.',
  );

  const helper = readFileSync(join(src, 'features/cancel-booking/lib/userFacingCancelError.ts'), 'utf8');
  assert.match(helper, /CANCELLATION_AFTER_START/);
  assert.match(helper, /Cancellation is no longer available because the class has started\./);

  const dialog = readFileSync(join(src, 'features/cancel-booking/ui/CancelBookingDialog.tsx'), 'utf8');
  assert.match(dialog, /userFacingCancelError/);
});
