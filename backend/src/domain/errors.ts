/**
 * Domain error classes — no external dependencies.
 * These are the only error types that cross layer boundaries.
 */

export class InvalidTimezoneError extends Error {
  readonly code = 'INVALID_TIMEZONE';
  constructor(tz: string) {
    super(`Unknown IANA timezone: "${tz}". Must be a valid IANA timezone identifier.`);
    this.name = 'InvalidTimezoneError';
  }
}

export class InvalidDateFormatError extends Error {
  readonly code = 'INVALID_DATE_FORMAT';
  constructor(value: string) {
    super(`Invalid date format: "${value}". Expected YYYY-MM-DD.`);
    this.name = 'InvalidDateFormatError';
  }
}

export class DstAmbiguousTimeError extends Error {
  readonly code = 'DST_AMBIGUOUS_TIME';
  constructor(localIso: string, tz: string) {
    super(
      `Time "${localIso}" is ambiguous in timezone "${tz}": ` +
      `it occurs twice due to a DST fall-back transition. ` +
      `Please specify the time in UTC or choose a different time.`,
    );
    this.name = 'DstAmbiguousTimeError';
  }
}

export class DstNonexistentTimeError extends Error {
  readonly code = 'DST_NONEXISTENT_TIME';
  constructor(localIso: string, tz: string) {
    super(
      `Time "${localIso}" does not exist in timezone "${tz}": ` +
      `the clocks spring forward, skipping this period. ` +
      `Please choose a time before or after the DST transition.`,
    );
    this.name = 'DstNonexistentTimeError';
  }
}

export class LeadTimeViolationError extends Error {
  readonly code = 'LEAD_TIME_VIOLATION';
  constructor(leadTimeHours: number) {
    super(`Booking must be made at least ${leadTimeHours} hour(s) in advance.`);
    this.name = 'LeadTimeViolationError';
  }
}

export class SlotNotAvailableError extends Error {
  readonly code = 'SLOT_NOT_AVAILABLE';
  constructor() {
    super('No mentor is available for the requested time slot.');
    this.name = 'SlotNotAvailableError';
  }
}

export class BookingNotFoundError extends Error {
  readonly code = 'BOOKING_NOT_FOUND';
  constructor(id: string) {
    super(`Booking "${id}" was not found.`);
    this.name = 'BookingNotFoundError';
  }
}

export class CancellationTokenInvalidError extends Error {
  readonly code = 'CANCELLATION_TOKEN_INVALID';
  constructor() {
    super('The cancellation token is invalid or does not match this booking.');
    this.name = 'CancellationTokenInvalidError';
  }
}

export class BookingAlreadyCancelledError extends Error {
  readonly code = 'BOOKING_ALREADY_CANCELLED';
  constructor(id: string) {
    super(`Booking "${id}" has already been cancelled.`);
    this.name = 'BookingAlreadyCancelledError';
  }
}

export class CancellationAfterStartError extends Error {
  readonly code = 'CANCELLATION_AFTER_START';
  constructor() {
    super('A booking cannot be cancelled after its class has already started.');
    this.name = 'CancellationAfterStartError';
  }
}

export class IdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT';
  constructor(key: string) {
    super(
      `Idempotency key "${key}" was already used with a different request payload. ` +
      `Use a unique key for a new booking.`,
    );
    this.name = 'IdempotencyConflictError';
  }
}
