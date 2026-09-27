/**
 * pages/booking-access — route-level composition ONLY.
 *
 * Opened from the confirmation email View Booking link (/b/:accessToken).
 * Works on a cold load: only the path token and POST /booking-access.
 */
import { useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useBookingAccess } from '../../../features/view-booking/model/useBookingAccess';
import { CancelBookingDialog } from '../../../features/cancel-booking/ui/CancelBookingDialog';
import { BookingDetailCard } from '../../../entities/booking/ui/BookingDetailCard';
import { canOfferCancellation } from '../../../entities/booking/lib/display';
import { Button } from '../../../shared/ui/button';
import { classRoomPath, classSummaryFromBooking } from '../../../shared/lib/classRoomPath';

export function BookingAccessPage() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const location = useLocation();
  const cancellationToken: string | undefined = location.state?.cancellationToken;

  const { booking, isLoading, error, refetch } = useBookingAccess(accessToken);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-gray-500 animate-pulse text-center">Loading booking details…</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-red-500 mb-4 break-words">
            {error ?? 'Booking link is invalid or has expired.'}
          </p>
          <Link to="/" className="text-blue-600 hover:underline text-sm">
            ← Back to booking
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12 px-4 font-sans text-slate-900 overflow-x-hidden">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-slate-100 p-4 sm:p-8 lg:p-12 min-w-0">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-semibold text-teal-800 hover:text-teal-950 mb-6"
        >
          ← Back to Booking
        </Link>

        <div className="text-center mb-10">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 shadow-sm ${
              booking.status === 'CONFIRMED'
                ? 'bg-green-100 text-green-600 border-4 border-green-50'
                : 'bg-red-100 text-red-600 border-4 border-red-50'
            }`}
          >
            {booking.status === 'CONFIRMED' ? (
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-teal-950 tracking-tight">
            {booking.status === 'CONFIRMED' ? 'Booking Details' : 'Booking Cancelled'}
          </h1>
          <p className="text-slate-500 mt-3 text-sm font-medium break-all">Ref: {booking.id}</p>
        </div>

        <div className="mb-10">
          <BookingDetailCard booking={booking} />
        </div>

        {cancellationToken && booking.status === 'CONFIRMED' && (
          <div className="mb-10 p-5 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg text-sm shadow-sm">
            <h4 className="font-bold text-amber-900 mb-1 flex items-center">
              <span className="mr-2">🔑</span> Save your cancellation token
            </h4>
            <p className="text-amber-800 mb-3 font-medium">
              You will need this token to cancel the class. It is also in your confirmation email.
            </p>
            <code className="bg-white px-4 py-2.5 rounded-md border border-amber-200 font-mono text-amber-900 block break-all select-all shadow-sm">
              {cancellationToken}
            </code>
          </div>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center mt-8">
          {booking.status === 'CONFIRMED' ? (
            <>
              <Link
                to={classRoomPath(booking.id)}
                state={{
                  accessToken,
                  classSummary: classSummaryFromBooking(booking),
                }}
                className="inline-flex items-center justify-center w-full sm:w-auto whitespace-nowrap rounded-xl text-base font-bold transition-colors bg-amber-500 text-slate-900 hover:bg-amber-600 shadow-sm h-14 px-8"
              >
                Join Class
              </Link>
              {canOfferCancellation(booking) ? (
                <Button variant="outline" size="lg" className="h-14 rounded-xl px-8 w-full sm:w-auto" onClick={() => setShowCancelDialog(true)}>
                  Cancel Booking
                </Button>
              ) : (
                <p className="w-full text-center text-sm text-slate-500 font-medium">
                  Cancellation is no longer available because the class has started.
                </p>
              )}
            </>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center justify-center w-full sm:w-auto whitespace-nowrap rounded-xl text-base font-bold transition-colors bg-amber-500 text-slate-900 hover:bg-amber-600 shadow-sm h-14 px-8"
            >
              Book a New Class
            </Link>
          )}
        </div>
      </div>

      {showCancelDialog && (
        <CancelBookingDialog
          bookingId={booking.id}
          onClose={() => setShowCancelDialog(false)}
          onSuccess={() => {
            setShowCancelDialog(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
