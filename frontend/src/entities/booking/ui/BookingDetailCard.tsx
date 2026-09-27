/**
 * entities/booking — ui/BookingDetailCard.tsx
 *
 * Displays the stored booking (GET /bookings/:id). Mentor and times come from
 * the booking record — they are not recomputed on the client.
 */
import type { Booking } from '../model/types';
import { MentorBadge, mentorFromBooking } from '../../mentor';
import { classRoomPath } from '../../../shared/lib/classRoomPath';
import { formatBookingDate, formatBookingTime } from '../lib/display';
import { formatTimezoneLabel } from '../../../shared/lib/timezoneLabel';

interface BookingDetailCardProps {
  booking: Booking;
}

export function BookingDetailCard({ booking }: BookingDetailCardProps) {
  const mentor = mentorFromBooking(booking);
  const dateLabel = formatBookingDate(booking.startTimeUtc, booking.parentTimezone);
  const parentStart = formatBookingTime(booking.startTimeUtc, booking.parentTimezone);
  const parentEnd = formatBookingTime(booking.endTimeUtc, booking.parentTimezone);
  const mentorStart = formatBookingTime(booking.startTimeUtc, booking.mentorTimezone);
  const mentorEnd = formatBookingTime(booking.endTimeUtc, booking.mentorTimezone);

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
        <div className="sm:col-span-2">
          <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Booking reference</p>
          <p className="font-mono text-slate-800 text-sm break-all">{booking.id}</p>
        </div>

        <div>
          <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Parent</p>
          <p className="font-semibold text-slate-900 text-base break-words">{booking.parentName}</p>
        </div>

        <div>
          <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Student</p>
          <p className="font-semibold text-slate-900 text-base break-words">{booking.childName}</p>
        </div>

        <div className="sm:col-span-2 bg-amber-50 rounded-xl p-4 border border-amber-100 space-y-4">
          <div>
            <p className="text-amber-800 font-medium mb-1 uppercase tracking-wide text-xs">Class date</p>
            <p className="font-bold text-amber-900 text-base sm:text-lg break-words">{dateLabel}</p>
          </div>
          <div>
            <p className="text-amber-800 font-medium mb-1 uppercase tracking-wide text-xs">Your local time</p>
            <p className="font-bold text-amber-900 text-base sm:text-lg break-words">
              {parentStart} – {parentEnd}
            </p>
            <p className="text-amber-700 text-xs mt-1 font-medium break-words">
              {formatTimezoneLabel(booking.parentTimezone)}
            </p>
          </div>
          <div>
            <p className="text-amber-800 font-medium mb-1 uppercase tracking-wide text-xs">Mentor time</p>
            <p className="font-bold text-amber-900 text-base sm:text-lg break-words">
              {mentorStart} – {mentorEnd}
            </p>
            <p className="text-amber-700 text-xs mt-1 font-medium break-words">
              {formatTimezoneLabel(booking.mentorTimezone)}
            </p>
          </div>
        </div>

        <div className="sm:col-span-2">
          <p className="text-slate-500 font-medium mb-2 uppercase tracking-wide text-xs">Assigned mentor</p>
          <div className="inline-block">
            <MentorBadge mentor={mentor} showTimezone />
          </div>
        </div>

        {booking.status === 'CONFIRMED' && (
          <div className="sm:col-span-2 pt-4 border-t border-slate-100">
            <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide text-xs">Join class</p>
            <a
              href={classRoomPath(booking.id)}
              className="font-semibold text-teal-600 hover:text-teal-800 hover:underline break-all"
            >
              {classRoomPath(booking.id)}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
