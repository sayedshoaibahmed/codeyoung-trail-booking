import { fetchApi } from '../../../shared/api/base';
import type { Booking } from '../model/types';

export const bookingApi = {
  getBooking: (id: string) => fetchApi<Booking>(`/bookings/${id}`),
  getBookingByAccessToken: (accessToken: string) =>
    fetchApi<Booking>('/booking-access', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
    }),
};
