/**
 * Express error handler middleware.
 *
 * Maps domain errors to appropriate HTTP status codes.
 * Must be registered AFTER all routes (Express convention).
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

interface ApiError {
  code: string;
  message: string;
}

function toHttpStatus(err: Error): number {
  if (
    err instanceof InvalidTimezoneError     ||
    err instanceof InvalidDateFormatError   ||
    err instanceof DstAmbiguousTimeError    ||
    err instanceof DstNonexistentTimeError  ||
    err instanceof LeadTimeViolationError   ||
    err instanceof IdempotencyConflictError
  ) return 400;

  if (
    err instanceof SlotNotAvailableError    ||
    err instanceof BookingNotFoundError     ||
    err instanceof CancellationTokenInvalidError ||
    err instanceof BookingAlreadyCancelledError  ||
    err instanceof CancellationAfterStartError
  ) return 409;

  if (err instanceof BookingNotFoundError) return 404;

  return 500;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = toHttpStatus(err);
  const body: ApiError = {
    code: (err as { code?: string }).code ?? 'INTERNAL_ERROR',
    message: status < 500 ? err.message : 'An unexpected error occurred.',
  };

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json(body);
}
