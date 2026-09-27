/**
 * Application use case — GetBookingByAccess
 *
 * Resolves a parent booking-access token to a safe DTO.
 * Lookup is by SHA-256 digest only. The raw token is never persisted or logged.
 */
import type { BookingRepository } from '../ports/BookingRepository';
import type { MentorRepository } from '../ports/MentorRepository';
import { BookingLinkInvalidError } from '../../domain/errors';
import { hashBookingAccessToken } from '../services/bookingAccessToken';
import { toBookingDto, type BookingDto } from './GetBooking';

export interface GetBookingByAccessDto {
  accessToken: string;
}

export class GetBookingByAccessUseCase {
  constructor(
    private readonly bookingRepo: BookingRepository,
    private readonly mentorRepo: MentorRepository,
  ) {}

  async execute(dto: GetBookingByAccessDto): Promise<BookingDto> {
    const hash = hashBookingAccessToken(dto.accessToken);
    const booking = await this.bookingRepo.findByAccessTokenHash(hash);
    if (!booking) throw new BookingLinkInvalidError();

    const mentor = await this.mentorRepo.findById(booking.mentorId);
    return toBookingDto(booking, mentor?.name ?? 'Unknown');
  }
}
