/**
 * Express error handler middleware — single, consistent JSON error format.
 *
 * Shape: { code: string, message: string, [errors]?: [...] }
 *
 * All domain/application errors are mapped here. Routes must not contain
 * ad-hoc try/catch for domain errors — they call next(err) and this
 * middleware handles the response.
 *
 * Must be registered AFTER all routes (Express 5 convention).
 */
import type { Request, Response, NextFunction } from 'express';
import {
  InvalidTimezoneError,
  InvalidDateFormatError,
  DstAmbiguousTimeError,
  DstNonexistentTimeError,
  LeadTimeViolationError,
  SlotNotAvailableError,
  BookingNotFoundError,
  CancellationTokenInvalidError,
  BookingAlreadyCancelledError,
  CancellationAfterStartError,
  IdempotencyConflictError,
} from '../../domain/errors';

// ── Error → HTTP status mapping ───────────────────────────────────────────────

function toHttpStatus(err: Error): number {
  // 400 — caller sent invalid input
  if (
    err instanceof InvalidTimezoneError   ||
    err instanceof InvalidDateFormatError ||
    err instanceof DstAmbiguousTimeError  ||
    err instanceof DstNonexistentTimeError ||
    err instanceof LeadTimeViolationError  ||
    err instanceof IdempotencyConflictError
  ) return 400;

  // 401 — authentication / credential failure
  if (err instanceof CancellationTokenInvalidError) return 401;

  // 404 — resource not found
  if (err instanceof BookingNotFoundError) return 404;

  // 409 — business rule / state conflict
  if (
    err instanceof SlotNotAvailableError       ||
    err instanceof BookingAlreadyCancelledError ||
    err instanceof CancellationAfterStartError
  ) return 409;

  // 500 — unexpected internal error
  return 500;
}

// ── Consistent JSON error body ────────────────────────────────────────────────

interface ApiErrorBody {
  code: string;
  message: string;
  /** Only present for SlotNotAvailableError */
  alternateSlots?: unknown;
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = toHttpStatus(err);

  // Never expose internal error details through the API
  const body: ApiErrorBody = {
    code: (err as { code?: string }).code ?? 'INTERNAL_ERROR',
    message: status < 500 ? err.message : 'An unexpected error occurred.',
  };

  // SlotNotAvailableError carries alternate slots — include them in the body
  if (err instanceof SlotNotAvailableError && err.alternateSlots.length > 0) {
    body.alternateSlots = err.alternateSlots;
  }

  if (status >= 500) {
    // Log full error server-side; never surface internals to clients
    console.error('[error]', err);
  }

  res.status(status).json(body);
}
