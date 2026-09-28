/**
 * pages/cancel-booking-link — opens the existing cancel dialog from an email link.
 * Uses booking id + cancellation token only. Does not load booking details by id.
 */
import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CancelBookingDialog } from '../../../features/cancel-booking/ui/CancelBookingDialog';

export function CancelBookingLinkPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = (searchParams.get('token') ?? '').replace(/\s+/g, '');
  const heading = useMemo(
    () => (token ? 'Confirm cancellation' : 'Enter your cancellation token'),
    [token],
  );

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-red-500">Booking link is invalid or has expired.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        <Link to="/book" className="inline-flex text-sm font-semibold text-teal-800 hover:text-teal-950 mb-6">
          ← Back to Booking
        </Link>
        <h1 className="text-2xl font-extrabold text-teal-950 mb-2">{heading}</h1>
        <p className="text-sm text-slate-500 mb-6">
          Cancellation still uses your existing cancellation token. No extra credentials are required.
        </p>
      </div>
      <CancelBookingDialog
        bookingId={bookingId}
        initialToken={token}
        onClose={() => navigate('/book')}
        onSuccess={() => navigate('/book')}
      />
    </div>
  );
}
