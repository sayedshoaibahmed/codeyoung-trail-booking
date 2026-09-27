import { Link } from 'react-router-dom';
import { useDashboard } from '../../../features/view-dashboard/model/useDashboard';
import { formatMentorShift, MentorBadge } from '../../../entities/mentor';
import { classRoomPath } from '../../../shared/lib/classRoomPath';
import type { DashboardBookingDto, MentorUtilizationDto } from '../../../features/view-dashboard/api';

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(d);
}

function BookingCard({
  booking,
  mentors,
}: {
  booking: DashboardBookingDto;
  mentors: MentorUtilizationDto[];
}) {
  const mentor = mentors.find((m) => m.mentorId === booking.mentorId);
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 sm:p-5 shadow-sm transition-all hover:shadow-md min-w-0">
      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
        <h4 className="font-bold text-slate-900 min-w-0 break-words">{booking.childName} <span className="text-slate-400 font-medium">(Parent: {booking.parentName})</span></h4>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide uppercase shrink-0 ${booking.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {booking.status}
        </span>
      </div>
      <div className="text-sm text-slate-600 space-y-1.5 font-medium break-words">
        <p><strong className="text-slate-700">Time (UTC):</strong> {formatDateTime(booking.startTimeUtc)} (1 hr)</p>
        <p><strong className="text-slate-700">Mentor local date:</strong> {booking.mentorLocalDate}</p>
        <div className="pt-3 pb-1">
          <MentorBadge
            mentor={{
              id: booking.mentorId,
              name: mentor?.mentorName ?? 'Unknown mentor',
              timezone: 'Asia/Kolkata',
            }}
            showTimezone={false}
          />
        </div>
        {booking.status === 'CONFIRMED' && (
          <p className="pt-2 border-t border-slate-100 mt-2">
            <Link
              to={classRoomPath(booking.id)}
              className="text-teal-600 hover:text-teal-800 font-bold inline-flex items-center break-all"
            >
              Join Room →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardWidget() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-48 max-w-full bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-36 max-w-full bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 p-6 rounded-lg border border-red-200 text-center">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h3>
        <p className="text-red-600">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  // Determine "today" based on generation time (approximate server UTC day or local)
  // For simplicity, we just display the lists returned by the backend.
  // The backend already categorized them into "upcomingConfirmed" and "recentlyCancelled"
  
  return (
    <div className="space-y-10">
      
      {/* Summary Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Total Bookings</p>
          <p className="text-4xl font-extrabold text-teal-950">{data.summary.totalBookings}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-green-200 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-green-500">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Confirmed</p>
          <p className="text-4xl font-extrabold text-green-700">{data.summary.confirmedBookings}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-200 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-red-500">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Cancelled</p>
          <p className="text-4xl font-extrabold text-red-700">{data.summary.cancelledBookings}</p>
        </div>
      </section>

      {/* Mentor Load / Utilization */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 sm:px-8 py-5 border-b border-slate-200">
          <h3 className="text-lg font-extrabold text-teal-950">Mentor Load & Shifts</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-white text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 sm:px-8 py-4">Mentor</th>
                <th className="px-4 sm:px-8 py-4">Shift</th>
                <th className="px-4 sm:px-8 py-4 text-center">Confirmed</th>
                <th className="px-4 sm:px-8 py-4 text-center">Cancelled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.mentorUtilization.map((m: MentorUtilizationDto) => (
                <tr key={m.mentorId} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 sm:px-8 py-5">
                    <div className="font-bold text-slate-900">{m.mentorName}</div>
                    <div className="text-slate-500 text-xs font-medium break-all">{m.mentorEmail}</div>
                  </td>
                  <td className="px-4 sm:px-8 py-5">
                    <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-teal-50 text-teal-800 border border-teal-100 whitespace-nowrap">
                      {formatMentorShift(m.shift)}
                    </span>
                  </td>
                  <td className="px-4 sm:px-8 py-5 font-bold text-slate-700 text-center text-lg">{m.confirmedCount}</td>
                  <td className="px-4 sm:px-8 py-5 text-slate-400 font-medium text-center">{m.cancelledCount}</td>
                </tr>
              ))}
              {data.mentorUtilization.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 sm:px-8 py-12 text-center text-slate-500 font-medium">No mentor data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Confirmed */}
        <section>
          <h3 className="text-lg font-extrabold text-teal-950 mb-5 flex items-center">
            Upcoming Classes
            <span className="ml-3 bg-amber-100 text-amber-800 text-xs py-1 px-2.5 rounded-md font-bold">
              {data.upcomingConfirmed.length}
            </span>
          </h3>
          <div className="space-y-4">
            {data.upcomingConfirmed.map(b => (
              <BookingCard key={b.id} booking={b} mentors={data.mentorUtilization} />
            ))}
            {data.upcomingConfirmed.length === 0 && (
              <div className="p-6 sm:p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-white">
                <p className="text-slate-500 font-medium">No upcoming confirmed classes.</p>
              </div>
            )}
          </div>
        </section>

        {/* Recently Cancelled */}
        <section>
          <h3 className="text-lg font-extrabold text-teal-950 mb-5 flex items-center">
            Recently Cancelled
            <span className="ml-3 bg-slate-100 text-slate-600 text-xs py-1 px-2.5 rounded-md font-bold">
              {data.recentlyCancelled.length}
            </span>
          </h3>
          <div className="space-y-4">
            {data.recentlyCancelled.map(b => (
              <BookingCard key={b.id} booking={b} mentors={data.mentorUtilization} />
            ))}
            {data.recentlyCancelled.length === 0 && (
              <div className="p-6 sm:p-10 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-white">
                <p className="text-slate-500 font-medium">No recently cancelled classes.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
