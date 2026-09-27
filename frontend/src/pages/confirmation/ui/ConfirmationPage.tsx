/**
 * Legacy URL. Booking details are not available from a booking id.
 * The supported page is /b/:accessToken (POST /api/booking-access).
 * This route must not call GET /api/bookings/:id.
 */
import { Link } from 'react-router-dom';

export function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-slate-700 mb-4">
          Booking details open from the secure link in your confirmation email
          (it starts with /b/). A booking id on its own is not enough.
        </p>
        <Link to="/book" className="text-blue-600 hover:underline text-sm">
          ← Back to Booking
        </Link>
      </div>
    </div>
  );
}
