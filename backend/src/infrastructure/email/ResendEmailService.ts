/**
 * Infrastructure — ResendEmailService
 *
 * Production EmailService adapter. Reads RESEND_API_KEY and EMAIL_FROM from
 * the environment. Never logs secrets or cancellation tokens.
 * Must not throw — email failures are logged only.
 */
import { Resend } from 'resend';
import type {
  EmailService,
  BookingConfirmationParams,
  BookingCancellationParams,
  MentorBookingNotificationParams,
} from '../../application/ports/EmailService';
import {
  buildConfirmationEmailHtml,
  buildConfirmationEmailText,
  buildMentorBookingNotificationText,
} from './bookingEmailContent';

export const BOOKING_CONFIRMATION_SUBJECT = '✅ Your CodeYoung trial class is confirmed!';
export const BOOKING_CANCELLATION_SUBJECT = '❌ Your CodeYoung trial class has been cancelled';
export const MENTOR_BOOKING_NOTIFICATION_SUBJECT = 'New CodeYoung trial class assigned';

export interface ResendSendPayload {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface ResendSendResult {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
}

export type ResendSendFn = (payload: ResendSendPayload) => Promise<ResendSendResult>;

function envApiKey(): string {
  return process.env.RESEND_API_KEY?.trim() ?? '';
}

function envFrom(): string {
  return process.env.EMAIL_FROM?.trim() ?? '';
}

export class ResendEmailService implements EmailService {
  constructor(private readonly sendEmail?: ResendSendFn) {}

  async sendBookingConfirmation(params: BookingConfirmationParams): Promise<void> {
    const { booking, mentorName, rawCancellationToken, viewBookingUrl, cancelBookingUrl, joinClassUrl } = params;
    const content = {
      booking,
      mentorName,
      rawCancellationToken,
      viewBookingUrl,
      cancelBookingUrl,
      joinClassUrl,
    };
    await this.deliver(
      booking.parentEmail,
      BOOKING_CONFIRMATION_SUBJECT,
      buildConfirmationEmailText(content),
      buildConfirmationEmailHtml(content),
    );
  }

  async sendBookingCancellation(params: BookingCancellationParams): Promise<void> {
    const { booking, mentorName } = params;
    await this.deliver(
      booking.parentEmail,
      BOOKING_CANCELLATION_SUBJECT,
      [
        `Dear ${booking.parentName},`,
        '',
        `Your trial class for ${booking.childName} scheduled with ${mentorName} has been cancelled.`,
        `Cancelled at: ${booking.cancelledAt?.toUTCString() ?? new Date().toUTCString()}`,
        '',
        `If you'd like to book another session, please visit our website.`,
        '',
        'The CodeYoung Team',
      ].join('\n'),
    );
  }

  async sendMentorBookingNotification(params: MentorBookingNotificationParams): Promise<void> {
    const { booking, mentorName, mentorEmail } = params;
    await this.deliver(
      mentorEmail,
      MENTOR_BOOKING_NOTIFICATION_SUBJECT,
      buildMentorBookingNotificationText({ booking, mentorName }),
    );
  }

  private async deliver(to: string, subject: string, text: string, html?: string): Promise<void> {
    try {
      const send = this.resolveSender();
      const from = envFrom();
      if (!send || !from) return;

      const result = await send({ from, to, subject, text, html });

      if (result.error) {
        console.error(
          `[email] provider=resend status=failure to=${to} message=${result.error.message ?? 'unknown'}`,
        );
        return;
      }

      console.log(
        `[email] provider=resend status=success to=${to} id=${result.data?.id ?? 'unknown'}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      console.error(`[email] provider=resend status=failure message=${message}`);
    }
  }

  private resolveSender(): ResendSendFn | null {
    if (this.sendEmail) return this.sendEmail;

    const apiKey = envApiKey();
    if (!apiKey) {
      console.error('[email] provider=resend status=failure reason=missing_RESEND_API_KEY');
      return null;
    }

    const from = envFrom();
    if (!from) {
      console.error('[email] provider=resend status=failure reason=missing_EMAIL_FROM');
      return null;
    }

    const resend = new Resend(apiKey);
    return async (payload) => resend.emails.send(payload);
  }
}
