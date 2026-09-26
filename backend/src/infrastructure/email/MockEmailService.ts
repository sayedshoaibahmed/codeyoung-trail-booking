/**
 * Infrastructure — MockEmailService
 *
 * Development/test implementation of the EmailService port.
 * Logs emails to the console instead of delivering them.
 * Never throws — swallows all errors to satisfy the fire-and-forget contract.
 */
import type { EmailService, BookingConfirmationParams, BookingCancellationParams } from '../../application/ports/EmailService';

export class MockEmailService implements EmailService {
  async sendBookingConfirmation(params: BookingConfirmationParams): Promise<void> {
    try {
      const { booking, mentorName, rawCancellationToken } = params;
      console.log(
        `[mock-email] BOOKING CONFIRMATION\n` +
        `  To:      ${booking.parentEmail}\n` +
        `  Class:   ${booking.startTimeUtc.toISOString()} – ${booking.endTimeUtc.toISOString()} UTC\n` +
        `  Mentor:  ${mentorName}\n` +
        `  Link:    ${booking.meetingLink}\n` +
        `  Cancel:  Use token ${rawCancellationToken.slice(0, 8)}... (keep safe)\n`,
      );
    } catch (err) {
      console.error('[mock-email] Confirmation email failed:', err);
    }
  }

  async sendBookingCancellation(params: BookingCancellationParams): Promise<void> {
    try {
      const { booking, mentorName } = params;
      console.log(
        `[mock-email] BOOKING CANCELLATION\n` +
        `  To:    ${booking.parentEmail}\n` +
        `  Class: ${booking.startTimeUtc.toISOString()} – ${booking.endTimeUtc.toISOString()} UTC\n` +
        `  Was with mentor: ${mentorName}\n`,
      );
    } catch (err) {
      console.error('[mock-email] Cancellation email failed:', err);
    }
  }
}
