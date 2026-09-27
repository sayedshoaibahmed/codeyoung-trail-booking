/**
 * Application use case — GetBooking
 *
 * Maps a persisted booking to a DTO that never includes token hashes.
 * HTTP must not expose this by booking id alone (see bookingRouter GET).
 */
import type { Booking } from '../../domain/entities/Booking';
import type { BookingRepository } from '../ports/BookingRepository';
import type { MentorRepository }  from '../ports/MentorRepository';
import { BookingStatus }          from '../../domain/entities/Booking';
import { BookingNotFoundError }   from '../../domain/errors';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface BookingDto {
  id: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  parentTimezone: string;
  startTimeUtc: string;    // ISO-8601
  endTimeUtc: string;      // ISO-8601
  mentorId: string;
  mentorName: string;
  mentorTimezone: string;
  mentorLocalDate: string;
  meetingLink: string;
  status: string;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toBookingDto(booking: Booking, mentorName: string): BookingDto {
  return {
    id:              booking.id,
    parentName:      booking.parentName,
    parentEmail:     booking.parentEmail,
    childName:       booking.childName,
    parentTimezone:  booking.parentTimezone,
    startTimeUtc:    booking.startTimeUtc.toISOString(),
    endTimeUtc:      booking.endTimeUtc.toISOString(),
    mentorId:        booking.mentorId,
    mentorName,
    mentorTimezone:  booking.mentorTimezone,
    mentorLocalDate: booking.mentorLocalDate,
    meetingLink:     booking.meetingLink,
    status:          booking.status === BookingStatus.CONFIRMED ? 'CONFIRMED' : 'CANCELLED',
    cancelledAt:     booking.cancelledAt?.toISOString() ?? null,
    createdAt:       booking.createdAt.toISOString(),
    updatedAt:       booking.updatedAt.toISOString(),
  };
}

// ── Use Case ──────────────────────────────────────────────────────────────────

export class GetBookingUseCase {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly mentorRepo:  MentorRepository,
  ) {}

  async execute(bookingId: string): Promise<BookingDto> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) throw new BookingNotFoundError(bookingId);

    const mentor = await this.mentorRepo.findById(booking.mentorId);
    return toBookingDto(booking, mentor?.name ?? 'Unknown');
  }
}
