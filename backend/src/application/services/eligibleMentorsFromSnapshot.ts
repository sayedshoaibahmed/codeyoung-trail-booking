/**
 * In-memory eligibility — same filters as PrismaMentorRepository.findEligibleMentors.
 * Used by GetAvailability after a single batched snapshot load.
 */
import type {
  ConfirmedBookingInterval,
  FindEligibleMentorsOptions,
  MentorAvailabilitySnapshot,
  MentorWithDayCount,
} from '../ports/MentorRepository';
import type { Mentor } from '../../domain';

export interface IndexedAvailabilitySnapshot {
  mentors: Mentor[];
  bookingsByMentor: Map<string, ConfirmedBookingInterval[]>;
}

export function indexAvailabilitySnapshot(
  snapshot: MentorAvailabilitySnapshot,
): IndexedAvailabilitySnapshot {
  const bookingsByMentor = new Map<string, ConfirmedBookingInterval[]>();
  for (const booking of snapshot.confirmedBookings) {
    const existing = bookingsByMentor.get(booking.mentorId);
    if (existing) {
      existing.push(booking);
    } else {
      bookingsByMentor.set(booking.mentorId, [booking]);
    }
  }
  return { mentors: snapshot.mentors, bookingsByMentor };
}

function intervalsOverlap(
  slotStartUtc: Date,
  slotEndUtc: Date,
  bookingStartUtc: Date,
  bookingEndUtc: Date,
): boolean {
  return slotStartUtc < bookingEndUtc && slotEndUtc > bookingStartUtc;
}

export function eligibleMentorsFromSnapshot(
  snapshot: IndexedAvailabilitySnapshot,
  options: FindEligibleMentorsOptions,
): MentorWithDayCount[] {
  const { shift, slotStartUtc, slotEndUtc, mentorLocalDate, dailyCap } = options;

  const eligible: MentorWithDayCount[] = [];

  for (const mentor of snapshot.mentors) {
    if (!mentor.active || mentor.shift !== shift) continue;

    const bookings = snapshot.bookingsByMentor.get(mentor.id) ?? [];

    const overlaps = bookings.some((booking) =>
      intervalsOverlap(slotStartUtc, slotEndUtc, booking.startTimeUtc, booking.endTimeUtc),
    );
    if (overlaps) continue;

    const dayCount = bookings.filter((booking) => booking.mentorLocalDate === mentorLocalDate).length;
    if (dayCount >= dailyCap) continue;

    eligible.push({ mentor, dayCount });
  }

  eligible.sort((a, b) => {
    if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount;
    return a.mentor.id.localeCompare(b.mentor.id);
  });

  return eligible;
}
