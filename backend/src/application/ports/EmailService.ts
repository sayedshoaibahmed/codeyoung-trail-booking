/**
 * Port — EmailService
 *
 * Sends transactional emails for booking events.
 * The concrete implementation lives in infrastructure/ and is injected at
 * the composition root. Email failures must NEVER roll back a committed booking.
 */
import type { Booking } from '../../domain';

export interface BookingConfirmationParams {
  booking: Booking;
  mentorName: string;
  /** The raw (unhashed) cancellation token — delivered once, never stored. */
  rawCancellationToken: string;
  /** Absolute or in-app URL for the parent to reopen booking details. */
  viewBookingUrl: string;
}

export interface BookingCancellationParams {
  booking: Booking;
  mentorName: string;
}

export interface EmailService {
  /**
   * Sends a booking confirmation email to the parent.
   * Called AFTER a successful transaction commit.
   * Implementations must not throw — swallow errors and log them internally.
   */
  sendBookingConfirmation(params: BookingConfirmationParams): Promise<void>;

  /**
   * Sends a cancellation confirmation email to the parent.
   * Same fire-and-forget contract as sendBookingConfirmation.
   */
  sendBookingCancellation(params: BookingCancellationParams): Promise<void>;
}
