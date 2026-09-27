import { fetchApi } from '../../../shared/api/base';

export interface CancelBookingRequest {
  cancellationToken: string;
}

export interface CancelBookingResponse {
  bookingId: string;
  status: 'CANCELLED';
  cancelledAt: string;
  alreadyCancelled: boolean;
}

export const cancelBookingApi = {
  cancel: (bookingId: string, data: CancelBookingRequest) => 
    fetchApi<CancelBookingResponse>(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
