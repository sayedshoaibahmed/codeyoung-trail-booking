/**
 * entities/booking — ui/BookingDetailCard.tsx
 *
 * Minimal display component for a confirmed or cancelled booking.
 * Shows the parent name, mentor (via MentorBadge), time in parent timezone,
 * mentor-local date, meeting link, and status badge.
 *
 * FSD rule: no imports from features, widgets, or pages.
 * Imports MentorBadge from entities/mentor — cross-entity import is allowed
 * because both live at the same layer and mentor is not a consumer of booking.
 */
import type { Booking } from '../model/types';
import { MentorBadge, mentorFromBooking } from '../../mentor';
import { classRoomPath } from '../../../shared/lib/classRoomPath';

interface BookingDetailCardProps {
  booking: Booking;
}

function formatInTz(isoUtc: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(isoUtc));
}

export function BookingDetailCard({ booking }: BookingDetailCardProps) {
  const mentor = mentorFromBooking(booking);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-4 sm:px-6 py-4 border-b border-slate-200 font-bold text-teal-950 text-base sm:text-lg flex items-center justify-between gap-3">
        <span className="min-w-0">Class Details</span>
        <span
            className={`inline-flex shrink-0 items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              booking.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {booking.status}
          </span>
      </div>
      <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm min-w-0">
        {/* Parent */}
        <div>
          <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Parent</p>
          <p className="font-semibold text-slate-900 text-base break-words">{booking.parentName}</p>
        </div>

        {/* Child */}
        <div>
          <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Student</p>
          <p className="font-semibold text-slate-900 text-base break-words">{booking.childName}</p>
        </div>

        {/* Class time in parent timezone */}
        <div className="sm:col-span-2 bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p className="text-amber-800 font-medium mb-1 uppercase tracking-wide text-xs break-words">Class Time ({booking.parentTimezone})</p>
          <p className="font-bold text-amber-900 text-base sm:text-lg break-words">
            {formatInTz(booking.startTimeUtc, booking.parentTimezone)}
          </p>
          <p className="text-amber-700 text-xs mt-1 font-medium">Duration: 1 Hour</p>
        </div>

        {/* Mentor */}
        <div className="sm:col-span-2">
          <p className="text-slate-500 font-medium mb-2 uppercase tracking-wide text-xs">Mentor</p>
          <div className="inline-block">
            <MentorBadge mentor={mentor} showTimezone />
          </div>
          <p className="text-slate-500 text-xs mt-2 font-medium">Mentor-local date: {booking.mentorLocalDate}</p>
        </div>

        {/* Meeting link */}
        <div className="sm:col-span-2 pt-4 border-t border-slate-100">
          <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Meeting link</p>
          <a
            href={classRoomPath(booking.id)}
            className="font-semibold text-teal-600 hover:text-teal-800 hover:underline break-all"
          >
            {classRoomPath(booking.id)}
          </a>
        </div>
      </div>
    </div>
  );
}
