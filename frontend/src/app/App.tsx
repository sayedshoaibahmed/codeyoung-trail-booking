import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '../pages/landing/ui/LandingPage';
import { BookingPage } from '../pages/booking/ui/BookingPage';
import { ConfirmationPage } from '../pages/confirmation/ui/ConfirmationPage';
import { BookingAccessPage } from '../pages/booking-access/ui/BookingAccessPage';
import { ClassRoomPage } from '../pages/class-room/ui/ClassRoomPage';
import { CancelBookingLinkPage } from '../pages/cancel-booking-link/ui/CancelBookingLinkPage';
import { AdminDashboardPage } from '../pages/admin-dashboard/ui/AdminDashboardPage';
import { AdminLoginPage } from '../pages/admin-login/ui/AdminLoginPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/book" element={<BookingPage />} />
      <Route path="/b/:accessToken" element={<BookingAccessPage />} />
      <Route path="/confirmation/:id" element={<ConfirmationPage />} />
      <Route path="/class/:id" element={<ClassRoomPage />} />
      <Route path="/cancel/:bookingId" element={<CancelBookingLinkPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
    </Routes>
  );
}
