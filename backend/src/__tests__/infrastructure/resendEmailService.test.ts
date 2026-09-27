import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ResendEmailService,
  BOOKING_CONFIRMATION_SUBJECT,
  MENTOR_BOOKING_NOTIFICATION_SUBJECT,
} from '../../infrastructure/email/ResendEmailService';
import { createEmailService } from '../../infrastructure/email/createEmailService';
import { MockEmailService } from '../../infrastructure/email/MockEmailService';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BookingStatus } from '../../domain';
import type { Booking } from '../../domain';

function sampleBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    mentorId: 'mentor-1',
    parentName: 'Priya Shah',
    parentEmail: 'priya@example.com',
    childName: 'Aarav Shah',
    parentTimezone: 'Asia/Kolkata',
    startTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
    endTimeUtc: new Date('2024-11-04T05:30:00.000Z'),
    mentorTimezone: 'Asia/Kolkata',
    mentorLocalDate: '2024-11-04',
    meetingLink: 'https://codeyoung-trail-booking.vercel.app/class/550e8400-e29b-41d4-a716-446655440000',
    status: BookingStatus.CONFIRMED,
    cancellationTokenHash: 'hashed-secret-must-not-appear',
    accessTokenHash: 'hashed-access-must-not-appear',
    cancelledAt: null,
    idempotencyKey: 'key-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const TOKEN = 'raw-token-visible-once';

describe('ResendEmailService', () => {
  const previousFrom = process.env.EMAIL_FROM;
  const previousKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.EMAIL_FROM = 'CodeYoung <bookings@example.test>';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (previousFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = previousFrom;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });

  it('sends confirmation through the Resend adapter with recipient, subject, and content', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 're_test_1' }, error: null });
    const service = new ResendEmailService(send);

    await service.sendBookingConfirmation({
      booking: sampleBooking(),
      mentorName: 'Aisha Sharma',
      rawCancellationToken: TOKEN,
      viewBookingUrl: '/b/raw-access-visible-once',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe('priya@example.com');
    expect(payload.subject).toBe(BOOKING_CONFIRMATION_SUBJECT);
    expect(payload.from).toBe('CodeYoung <bookings@example.test>');
    expect(payload.text).toContain('Aarav Shah');
    expect(payload.text).toContain('Priya Shah');
    expect(payload.text).toContain('Aisha Sharma');
    expect(payload.text).toContain('CONFIRMED');
    expect(payload.text).toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(payload.text).toContain('Timezone: Asia/Kolkata');
    expect(payload.text).toContain(
      'Join class: https://codeyoung-trail-booking.vercel.app/class/550e8400-e29b-41d4-a716-446655440000',
    );
    expect(payload.text).toContain(TOKEN);
    expect(payload.text).toContain('View Booking: /b/raw-access-visible-once');
    expect(payload.text).not.toContain('hashed-secret-must-not-appear');
    expect(payload.text).not.toContain('hashed-access-must-not-appear');
  });

  it('includes the stored Join Class URL (FRONTEND_ORIGIN-prefixed when BookClass stored it)', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 're_test_2' }, error: null });
    const service = new ResendEmailService(send);
    const booking = sampleBooking({
      meetingLink: 'https://codeyoung-trail-booking.vercel.app/class/abc',
    });

    await service.sendBookingConfirmation({
      booking,
      mentorName: 'Aisha Sharma',
      rawCancellationToken: TOKEN,
      viewBookingUrl: '/b/raw-access-visible-once',
    });

    expect(send.mock.calls[0][0].text).toContain(
      'Join class: https://codeyoung-trail-booking.vercel.app/class/abc',
    );
  });

  it('does not throw when RESEND_API_KEY is missing', async () => {
    const service = new ResendEmailService();
    await expect(
      service.sendBookingConfirmation({
        booking: sampleBooking(),
        mentorName: 'Aisha Sharma',
        rawCancellationToken: TOKEN,
      viewBookingUrl: '/b/raw-access-visible-once',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when the Resend API reports failure', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    const service = new ResendEmailService(send);
    await expect(
      service.sendBookingConfirmation({
        booking: sampleBooking(),
        mentorName: 'Aisha Sharma',
        rawCancellationToken: TOKEN,
      viewBookingUrl: '/b/raw-access-visible-once',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when the Resend client rejects', async () => {
    const send = vi.fn().mockRejectedValue(new Error('network down'));
    const service = new ResendEmailService(send);
    await expect(
      service.sendBookingConfirmation({
        booking: sampleBooking(),
        mentorName: 'Aisha Sharma',
        rawCancellationToken: TOKEN,
      viewBookingUrl: '/b/raw-access-visible-once',
      }),
    ).resolves.toBeUndefined();
  });

  it('sends mentor notification to the assigned mentor email', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 're_mentor_1' }, error: null });
    const service = new ResendEmailService(send);
    const booking = sampleBooking({
      parentTimezone: 'America/New_York',
      mentorTimezone: 'Asia/Kolkata',
    });

    await service.sendMentorBookingNotification({
      booking,
      mentorName: 'Aisha Sharma',
      mentorEmail: 'aisha@codeyoung.com',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe('aisha@codeyoung.com');
    expect(payload.to).not.toBe(booking.parentEmail);
    expect(payload.from).toBe('CodeYoung <bookings@example.test>');
    expect(payload.subject).toBe(MENTOR_BOOKING_NOTIFICATION_SUBJECT);
    expect(payload.text).toContain('Priya Shah');
    expect(payload.text).toContain('Aarav Shah');
    expect(payload.text).toContain('Aisha Sharma');
    expect(payload.text).toContain(booking.id);
    expect(payload.text).toContain('Timezone: America/New_York');
    expect(payload.text).toContain('Timezone: Asia/Kolkata');
    expect(payload.text).toContain(`Join class: ${booking.meetingLink}`);
    expect(payload.text).not.toContain(TOKEN);
    expect(payload.text).not.toContain('hashed-secret-must-not-appear');
    expect(payload.text).not.toContain('hashed-access-must-not-appear');
    expect(payload.text).not.toContain('/b/');
  });

  it('does not include API keys or token hashes in the mentor email', async () => {
    process.env.RESEND_API_KEY = 're_secret_test_key_must_not_leak';
    const send = vi.fn().mockResolvedValue({ data: { id: 're_mentor_2' }, error: null });
    const service = new ResendEmailService(send);

    await service.sendMentorBookingNotification({
      booking: sampleBooking(),
      mentorName: 'Aisha Sharma',
      mentorEmail: 'aisha@codeyoung.com',
    });

    const payload = send.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain('re_secret_test_key_must_not_leak');
    expect(payload.text).not.toContain('hashed-secret-must-not-appear');
    expect(payload.text).not.toContain('hashed-access-must-not-appear');
  });

  it('does not throw on mentor send when RESEND_API_KEY is missing', async () => {
    const service = new ResendEmailService();
    await expect(
      service.sendMentorBookingNotification({
        booking: sampleBooking(),
        mentorName: 'Aisha Sharma',
        mentorEmail: 'aisha@codeyoung.com',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when mentor send reports a provider error', async () => {
    const send = vi.fn().mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    const service = new ResendEmailService(send);
    await expect(
      service.sendMentorBookingNotification({
        booking: sampleBooking(),
        mentorName: 'Aisha Sharma',
        mentorEmail: 'aisha@codeyoung.com',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('createEmailService', () => {
  it('returns MockEmailService when NODE_ENV is test', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(createEmailService()).toBeInstanceOf(MockEmailService);
  });

  it('returns ResendEmailService when NODE_ENV is not test', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(createEmailService()).toBeInstanceOf(ResendEmailService);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe('composition root email wiring', () => {
  it('uses MockEmailService in test and createEmailService otherwise', () => {
    const source = readFileSync(
      resolve(__dirname, '../../infrastructure/index.ts'),
      'utf8',
    );
    expect(source).toContain("process.env.NODE_ENV === 'test'");
    expect(source).toContain('new MockEmailService()');
    expect(source).toContain('createEmailService()');
    expect(source).not.toContain('new NodemailerEmailService()');
  });
});
