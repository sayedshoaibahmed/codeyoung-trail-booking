/**
 * Infrastructure — NodemailerEmailService
 *
 * Concrete EmailService backed by Nodemailer + Ethereal SMTP.
 * On startup, an Ethereal test account is created automatically.
 * The Ethereal preview URL is logged so emails can be inspected in the browser.
 *
 * This implementation is used when NODE_ENV !== 'test'.
 * The MockEmailService is used in tests to avoid network calls.
 *
 * Ethereal guarantees:
 *   - Emails are accepted and stored, never delivered to real recipients.
 *   - The preview URL (nodemailer.getTestMessageUrl) lets you inspect the email.
 *
 * Contract: methods must not throw — errors are logged internally.
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { EmailService, BookingConfirmationParams, BookingCancellationParams } from '../../application/ports/EmailService';
import { buildConfirmationEmailText } from './bookingEmailContent';

let transport: Transporter | null = null;
let fromAddress = '"CodeYoung" <no-reply@codeyoung.com>';

/**
 * Lazily initialises an Ethereal SMTP transporter.
 * Called once on first email send; subsequent calls reuse the singleton.
 */
async function getTransport(): Promise<Transporter> {
  if (transport) return transport;

  try {
    const account = await nodemailer.createTestAccount();
    fromAddress   = `"CodeYoung" <${account.user}>`;
    transport = nodemailer.createTransport({
      host:   'smtp.ethereal.email',
      port:   587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
    console.log(`[email] Ethereal account created: ${account.user}`);
  } catch {
    // Ethereal unavailable (offline) — fall back to a no-op transport
    transport = nodemailer.createTransport({ jsonTransport: true });
    console.warn('[email] Ethereal unavailable — using no-op transport (emails will not be sent)');
  }

  return transport;
}

export class NodemailerEmailService implements EmailService {
  async sendBookingConfirmation(params: BookingConfirmationParams): Promise<void> {
    try {
      const { booking, mentorName, rawCancellationToken } = params;
      const t = await getTransport();

      const info = await t.sendMail({
        from:    fromAddress,
        to:      booking.parentEmail,
        subject: '✅ Your CodeYoung trial class is confirmed!',
        text: buildConfirmationEmailText({ booking, mentorName, rawCancellationToken }),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log(`[email] Confirmation preview: ${previewUrl}`);
    } catch (err) {
      console.error('[email] Failed to send booking confirmation:', err);
    }
  }

  async sendBookingCancellation(params: BookingCancellationParams): Promise<void> {
    try {
      const { booking, mentorName } = params;
      const t = await getTransport();

      const info = await t.sendMail({
        from:    fromAddress,
        to:      booking.parentEmail,
        subject: '❌ Your CodeYoung trial class has been cancelled',
        text: [
          `Dear ${booking.parentName},`,
          '',
          `Your trial class for ${booking.childName} scheduled with ${mentorName} has been cancelled.`,
          `Cancelled at: ${booking.cancelledAt?.toUTCString() ?? new Date().toUTCString()}`,
          '',
          `If you'd like to book another session, please visit our website.`,
          '',
          'The CodeYoung Team',
        ].join('\n'),
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log(`[email] Cancellation preview: ${previewUrl}`);
    } catch (err) {
      console.error('[email] Failed to send booking cancellation:', err);
    }
  }
}
