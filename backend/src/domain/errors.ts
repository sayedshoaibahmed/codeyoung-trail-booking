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

/**
 * The chosen mentor already has a CONFIRMED class at this start time.
 * Another eligible mentor may still be free. Not an HTTP error by itself.
 */
export class ConfirmedSlotConflictError extends Error {
  readonly code = 'CONFIRMED_SLOT_CONFLICT';
  constructor() {
    super('That mentor is already confirmed for this class time.');
    this.name = 'ConfirmedSlotConflictError';
  }
}

export class SlotNotAvailableError extends Error {
  readonly code = 'SLOT_NOT_AVAILABLE';
  constructor(public readonly alternateSlots: AlternateSlot[] = []) {
    super('No mentor is available for the requested time slot.');
    this.name = 'SlotNotAvailableError';
  }
}

/** The 1-hour class does not lie entirely inside Shift 1 or Shift 2. */
export class SlotOutsideShiftError extends Error {
  readonly code = 'SLOT_OUTSIDE_SHIFT';
  constructor() {
    super(
      'The full 1-hour class must fall inside a mentor shift ' +
      '(Shift 1: 09:00–21:00 IST, or Shift 2: 21:00–09:00 IST).',
    );
    this.name = 'SlotOutsideShiftError';
  }
}

/** A lightweight slot descriptor used in error responses when the primary slot is full. */
export interface AlternateSlot {
  startUtc: string;
  endUtc: string;
}


export class BookingNotFoundError extends Error {
  readonly code = 'BOOKING_NOT_FOUND';
  constructor(id: string) {
    super(`Booking "${id}" was not found.`);
    this.name = 'BookingNotFoundError';
  }
}

/**
 * Parent booking-access failed. Same message for missing, wrong, or
 * format-invalid credentials so existence of a booking is not revealed.
 */
export class BookingLinkInvalidError extends Error {
  readonly code = 'BOOKING_LINK_INVALID';
  constructor() {
    super('Booking link is invalid or has expired.');
    this.name = 'BookingLinkInvalidError';
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

export class AdminInvalidCredentialsError extends Error {
  readonly code = 'ADMIN_INVALID_CREDENTIALS';
  constructor() {
    super('Invalid username or password.');
    this.name = 'AdminInvalidCredentialsError';
  }
}

export class AdminUnauthorizedError extends Error {
  readonly code = 'ADMIN_UNAUTHORIZED';
  constructor() {
    super('Admin authentication is required.');
    this.name = 'AdminUnauthorizedError';
  }
}

export class AdminLoginRateLimitedError extends Error {
  readonly code = 'ADMIN_LOGIN_RATE_LIMITED';
  constructor() {
    super('Too many login attempts. Please try again later.');
    this.name = 'AdminLoginRateLimitedError';
  }
}
