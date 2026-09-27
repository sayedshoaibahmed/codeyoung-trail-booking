/**
 * In-app dummy classroom path. The :id param is the booking UUID
 * (same identifier BookClass uses and /confirmation/:id uses).
 */
export function classRoomPath(bookingId: string): string {
  return `/class/${bookingId}`;
}
