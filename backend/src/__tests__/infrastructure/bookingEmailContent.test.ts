import { describe, it, expect } from 'vitest';
import {
  buildConfirmationEmailText,
  buildMentorBookingNotificationText,
} from '../../infrastructure/email/bookingEmailContent';
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
    startTimeUtc: new Date('2024-11-04T15:00:00.000Z'),
    endTimeUtc: new Date('2024-11-04T16:00:00.000Z'),
    mentorTimezone: 'Asia/Kolkata',
    mentorLocalDate: '2024-11-04',
    meetingLink: '/class/550e8400-e29b-41d4-a716-446655440000',
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

function buildText(booking: Booking) {
  return buildConfirmationEmailText({
    booking,
    mentorName: 'Aisha Sharma',
    rawCancellationToken: 'raw-token-visible-once',
    viewBookingUrl: '/b/raw-access-visible-once',
  });
}

describe('buildConfirmationEmailText', () => {
  it('includes parent-facing booking details and the in-app join path', () => {
    const booking = sampleBooking({
      parentTimezone: 'Asia/Kolkata',
      startTimeUtc: new Date('2024-11-04T04:30:00.000Z'),
      endTimeUtc: new Date('2024-11-04T05:30:00.000Z'),
    });
    const text = buildText(booking);

    expect(text).toContain('Aarav Shah');
    expect(text).toContain('Priya Shah');
    expect(text).toContain('Aisha Sharma');
    expect(text).toContain('CONFIRMED');
    expect(text).toContain(booking.id);
    expect(text).toContain('Join class: /class/550e8400-e29b-41d4-a716-446655440000');
    expect(text).toContain('View Booking: /b/raw-access-visible-once');
    expect(text).toContain('raw-token-visible-once');
    expect(text).not.toContain('hashed-secret-must-not-appear');
    expect(text).not.toContain('hashed-access-must-not-appear');
    expect(text).not.toContain('meet.codeyoung.com');
  });

  it('formats parent local time using parentTimezone', () => {
    const booking = sampleBooking({ parentTimezone: 'America/New_York' });
    const text = buildText(booking);
    expect(text).toContain('Your local time:');
    expect(text).toContain('Timezone: America/New_York');
    expect(text).toMatch(/10:00\sAM/);
  });

  it('formats mentor local time using mentorTimezone', () => {
    const booking = sampleBooking({ mentorTimezone: 'Asia/Kolkata' });
    const text = buildText(booking);
    expect(text).toContain('Mentor time:');
    expect(text).toContain('Timezone: Asia/Kolkata');
    expect(text).toMatch(/8:30\sPM/);
  });

  it('shows different wall-clock values when parent and mentor timezones differ', () => {
    const booking = sampleBooking({
      parentTimezone: 'America/New_York',
      mentorTimezone: 'Asia/Kolkata',
    });
    const text = buildText(booking);
    expect(text).toContain('Timezone: America/New_York');
    expect(text).toContain('Timezone: Asia/Kolkata');
    expect(text).toMatch(/10:00\sAM/);
    expect(text).toMatch(/8:30\sPM/);
    expect(text).not.toMatch(/Timezone:\s+America\/New_York[\s\S]*Timezone:\s+America\/New_York/);
  });

  it('never includes token hashes', () => {
    const text = buildText(sampleBooking());
    expect(text).not.toContain('hashed-secret-must-not-appear');
    expect(text).not.toContain('hashed-access-must-not-appear');
    expect(text).not.toContain('cancellationTokenHash');
    expect(text).not.toContain('accessTokenHash');
  });
});

describe('buildMentorBookingNotificationText', () => {
  it('includes booking details, timezones, and the join link without secrets', () => {
    const booking = sampleBooking({
      parentTimezone: 'America/New_York',
      mentorTimezone: 'Asia/Kolkata',
    });
    const text = buildMentorBookingNotificationText({
      booking,
      mentorName: 'Aisha Sharma',
    });

    expect(text).toContain('Priya Shah');
    expect(text).toContain('Aarav Shah');
    expect(text).toContain('Aisha Sharma');
    expect(text).toContain(booking.id);
    expect(text).toContain('Timezone: America/New_York');
    expect(text).toContain('Timezone: Asia/Kolkata');
    expect(text).toMatch(/10:00\sAM/);
    expect(text).toMatch(/8:30\sPM/);
    expect(text).toContain('Join class: /class/550e8400-e29b-41d4-a716-446655440000');
    expect(text).not.toContain('raw-token-visible-once');
    expect(text).not.toContain('hashed-secret-must-not-appear');
    expect(text).not.toContain('hashed-access-must-not-appear');
    expect(text).not.toContain('/b/');
    expect(text).not.toContain('cancellationToken');
  });
});
