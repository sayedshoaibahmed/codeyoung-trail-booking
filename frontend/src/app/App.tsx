import { Routes, Route } from 'react-router-dom';
import { BookingPage } from '../pages/booking/ui/BookingPage';
import { ConfirmationPage } from '../pages/confirmation/ui/ConfirmationPage';
import { ClassRoomPage } from '../pages/class-room/ui/ClassRoomPage';
import { AdminDashboardPage } from '../pages/admin-dashboard/ui/AdminDashboardPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<BookingPage />} />
      <Route path="/confirmation/:id" element={<ConfirmationPage />} />
      <Route path="/class/:id" element={<ClassRoomPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
    </Routes>
  );
}
