/**
 * entities/mentor — public barrel
 *
 * FSD rule: entities must only re-export from within their own slice.
 */
export type { Mentor, MentorShift } from './model/types';
export { mentorFromBooking, formatMentorShift } from './model/types';
export { MentorBadge } from './ui/MentorBadge';
