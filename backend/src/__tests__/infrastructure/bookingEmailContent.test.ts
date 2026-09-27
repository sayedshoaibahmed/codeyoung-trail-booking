import { describe, it, expect } from 'vitest';
import { buildConfirmationEmailText } from '../../infrastructure/email/bookingEmailContent';
import { BookingStatus } from '../../domain';
import type { Booking } from '../../domain';

function sampleBooking(): Booking {
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
    meetingLink: '/class/550e8400-e29b-41d4-a716-446655440000',
    status: BookingStatus.CONFIRMED,
    cancellationTokenHash: 'hashed-secret-must-not-appear',
    cancelledAt: null,
    idempotencyKey: 'key-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('buildConfirmationEmailText', () => {
  it('includes parent-facing booking details and the in-app join path', () => {
    const booking = sampleBooking();
    const text = buildConfirmationEmailText({
      booking,
      mentorName: 'Aisha Sharma',
      rawCancellationToken: 'raw-token-visible-once',
    });

    expect(text).toContain('Aarav Shah');
    expect(text).toContain('Priya Shah');
    expect(text).toContain('Aisha Sharma');
    expect(text).toContain('CONFIRMED');
    expect(text).toContain(booking.id);
    expect(text).toContain('Timezone:   Asia/Kolkata');
    expect(text).toContain('Join class: /class/550e8400-e29b-41d4-a716-446655440000');
    expect(text).toContain('raw-token-visible-once');
    expect(text).not.toContain('hashed-secret-must-not-appear');
    expect(text).not.toContain('meet.codeyoung.com');
  });
});
