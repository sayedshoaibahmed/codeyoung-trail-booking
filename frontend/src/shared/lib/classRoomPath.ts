/**
 * In-app dummy classroom path. The :id param is the booking UUID
 * (same identifier BookClass uses). Secrets never belong on this path.
 */
export function classRoomPath(bookingId: string): string {
  return `/class/${bookingId}`;
}

/** Display fields already shown on an authenticated booking-details page. */
export interface ClassRoomSummary {
  childName: string;
  mentorName: string;
  status: string;
  startTimeUtc: string;
  endTimeUtc: string;
  parentTimezone: string;
}

/**
 * Optional router state when entering /class/:id from booking details.
 * Must not include a cancel credential or token hashes.
 */
export interface ClassRoomNavState {
  accessToken?: string;
  classSummary?: ClassRoomSummary;
}

/**
 * Destination after End Call / Leave Class.
 * Returns the booking-access page when that credential was passed in router
 * state; otherwise the booking form. Never a cancel URL.
 */
export function leaveClassPath(accessToken?: string): string {
  if (accessToken) return `/b/${accessToken}`;
  return '/';
}

export function classSummaryFromBooking(booking: ClassRoomSummary): ClassRoomSummary {
  return {
    childName: booking.childName,
    mentorName: booking.mentorName,
    status: booking.status,
    startTimeUtc: booking.startTimeUtc,
    endTimeUtc: booking.endTimeUtc,
    parentTimezone: booking.parentTimezone,
  };
}
