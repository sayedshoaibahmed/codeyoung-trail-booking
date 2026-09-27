/**
 * Dummy classroom. End Call / Leave Class only navigate away.
 * They must not cancel the booking or touch cancellation credentials.
 */
import { useParams, useLocation, Link } from 'react-router-dom';
import { Button } from '../../../shared/ui/button';
import { leaveClassPath, type ClassRoomNavState } from '../../../shared/lib/classRoomPath';
import { formatBookingDate, formatBookingTime } from '../../../entities/booking/lib/display';
import { formatTimezoneLabel } from '../../../shared/lib/timezoneLabel';

export function ClassRoomPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navState = (location.state ?? {}) as ClassRoomNavState;
  const summary = navState.classSummary;
  const exitTo = leaveClassPath(navState.accessToken);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans overflow-x-hidden">
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex flex-wrap justify-between items-center gap-x-3 gap-y-2 text-white">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 shrink-0 bg-amber-500 rounded flex items-center justify-center font-bold text-slate-900">
            CY
          </div>
          <h1 className="text-base sm:text-xl font-bold tracking-tight text-slate-100 truncate">Live Classroom</h1>
        </div>
        <Link to={exitTo} className="text-sm font-medium text-slate-400 hover:text-white transition-colors shrink-0 whitespace-nowrap">
          Leave Class
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-3xl w-full bg-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center shadow-2xl border border-slate-700 relative overflow-hidden min-w-0">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-amber-500" />
          <div className="inline-flex p-5 bg-slate-700 rounded-full mb-6 border-4 border-slate-600">
            <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Demo Class Room</h2>
          <p className="text-slate-400 mb-6 text-base sm:text-lg leading-relaxed max-w-xl mx-auto break-words">
            This is the dummy classroom for booking{' '}
            <strong className="text-slate-200 break-all">{id}</strong>.
            No external video provider is used.
          </p>
          {summary && (
            <div className="mb-8 text-left bg-slate-900/50 rounded-xl p-4 sm:p-5 border border-slate-700 text-sm space-y-2">
              <p className="text-slate-300"><span className="text-slate-500">Student</span> {summary.childName}</p>
              <p className="text-slate-300"><span className="text-slate-500">Mentor</span> {summary.mentorName}</p>
              <p className="text-slate-300"><span className="text-slate-500">Status</span> {summary.status}</p>
              <p className="text-slate-300 break-words">
                <span className="text-slate-500">Class date</span>{' '}
                {formatBookingDate(summary.startTimeUtc, summary.parentTimezone)}
              </p>
              <p className="text-slate-300 break-words">
                <span className="text-slate-500">Your local time</span>{' '}
                {formatBookingTime(summary.startTimeUtc, summary.parentTimezone)} –{' '}
                {formatBookingTime(summary.endTimeUtc, summary.parentTimezone)}
              </p>
              <p className="text-slate-400 text-xs break-words">{formatTimezoneLabel(summary.parentTimezone)}</p>
              <p className="text-slate-300 break-words">
                <span className="text-slate-500">Mentor time</span>{' '}
                {formatBookingTime(summary.startTimeUtc, summary.mentorTimezone)} –{' '}
                {formatBookingTime(summary.endTimeUtc, summary.mentorTimezone)}
              </p>
              <p className="text-slate-400 text-xs break-words">{formatTimezoneLabel(summary.mentorTimezone)}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center">
            <Button variant="secondary" className="px-8 h-12 rounded-xl bg-slate-700 text-white hover:bg-slate-600 border-none w-full sm:w-auto">
              Mute Mic
            </Button>
            <Button variant="secondary" className="px-8 h-12 rounded-xl bg-slate-700 text-white hover:bg-slate-600 border-none w-full sm:w-auto">
              Stop Video
            </Button>
            <Link to={exitTo} className="w-full sm:w-auto">
              <Button variant="destructive" className="px-8 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700 w-full">
                End Call
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-slate-500 text-xs">
            Ending the call leaves the classroom. It does not cancel the booking.
          </p>
        </div>
      </div>
    </div>
  );
}
