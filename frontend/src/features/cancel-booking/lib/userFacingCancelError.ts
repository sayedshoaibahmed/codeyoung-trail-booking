import { ApiError } from '../../../shared/api/base';

export const CANCELLATION_AFTER_START_USER_MESSAGE =
  'Cancellation is no longer available because the class has started.';

/** Maps API cancel failures to the copy shown in the cancel dialog. */
export function userFacingCancelError(err: unknown): string {
  if (err instanceof ApiError && err.code === 'CANCELLATION_AFTER_START') {
    return CANCELLATION_AFTER_START_USER_MESSAGE;
  }
  if (err instanceof ApiError) {
    return err.message || 'Cancellation failed.';
  }
  return 'An unexpected error occurred.';
}
