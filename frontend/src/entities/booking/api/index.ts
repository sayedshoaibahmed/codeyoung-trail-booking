import { fetchApi } from '../../../shared/api/base';
import type { Booking } from '../model/types';

export const bookingApi = {
  getBooking: (id: string) => fetchApi<Booking>(`/bookings/${id}`),
  getBookingByAccessToken: (accessToken: string, signal?: AbortSignal) =>
    fetchApi<Booking>('/booking-access', {
      method: 'POST',
      body: JSON.stringify({ accessToken }),
      signal,
    }),
};
