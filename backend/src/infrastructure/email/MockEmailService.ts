/**
 * Infrastructure — MockEmailService
 *
 * Development/test implementation of the EmailService port.
 * Logs emails to the console instead of delivering them.
 * Never throws — swallows all errors to satisfy the fire-and-forget contract.
 */
import type {
  EmailService,
  BookingConfirmationParams,
  BookingCancellationParams,
  MentorBookingNotificationParams,
} from '../../application/ports/EmailService';
import { buildConfirmationEmailText, buildMentorBookingNotificationText } from './bookingEmailContent';

export class MockEmailService implements EmailService {
  async sendBookingConfirmation(params: BookingConfirmationParams): Promise<void> {
    try {
      const { booking, mentorName, rawCancellationToken, viewBookingUrl, cancelBookingUrl, joinClassUrl } = params;
      const text = buildConfirmationEmailText({
        booking,
        mentorName,
        rawCancellationToken,
        viewBookingUrl,
        cancelBookingUrl,
        joinClassUrl,
      });
      const redacted = text
        .split(rawCancellationToken).join('[redacted]')
        .split(viewBookingUrl).join('[view-booking-url-redacted]')
        .split(cancelBookingUrl).join('[cancel-booking-url-redacted]');
      console.log(
        `[mock-email] BOOKING CONFIRMATION\n` +
        `  To: ${booking.parentEmail}\n` +
        redacted +
        '\n',
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

  async sendMentorBookingNotification(params: MentorBookingNotificationParams): Promise<void> {
    try {
      const { booking, mentorName, mentorEmail } = params;
      const text = buildMentorBookingNotificationText({ booking, mentorName });
      console.log(
        `[mock-email] MENTOR BOOKING NOTIFICATION\n` +
        `  To: ${mentorEmail}\n` +
        text +
        '\n',
      );
    } catch (err) {
      console.error('[mock-email] Mentor notification email failed:', err);
    }
  }
}
