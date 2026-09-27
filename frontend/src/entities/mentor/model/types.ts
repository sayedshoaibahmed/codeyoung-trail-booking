/**
 * entities/mentor — model/types.ts
 *
 * Mentor business object as returned by the GET /bookings/:id API
 * (embedded in the BookingDto). Mentor has its own entity because
 * confirmation UI displays mentor-specific information.
 *
 * FSD rule: this file must NOT import from features, widgets, or pages.
 */
export interface Mentor {
  /** Unique mentor identifier */
  id: string;
  /** Display name */
  name: string;
  /** IANA timezone the mentor teaches in */
  timezone: string;
}

export function mentorFromBooking(booking: {
  mentorId: string;
  mentorName: string;
  mentorTimezone: string;
}): Mentor {
  return {
    id: booking.mentorId,
    name: booking.mentorName,
    timezone: booking.mentorTimezone,
  };
}

export type MentorShift = 'SHIFT_1' | 'SHIFT_2';

/**
 * Formats a MentorShift accurately per requirements.
 */
export function formatMentorShift(shift: string): string {
  if (shift === 'SHIFT_1') return 'Shift 1: 09:00–21:00 IST';
  if (shift === 'SHIFT_2') return 'Shift 2: 21:00–09:00 IST';
  return shift;
}
