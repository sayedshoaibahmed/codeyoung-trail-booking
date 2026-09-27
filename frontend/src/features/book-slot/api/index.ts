import { fetchApi } from '../../../shared/api/base';
import { v4 as uuidv4 } from 'uuid';

export interface BookSlotRequest {
  parentName: string;
  parentEmail: string;
  childName: string;
  parentTimezone: string;
  requestedStartIso: string;
}

export interface BookSlotResponse {
  bookingId: string;
  mentorName: string;
  startUtc: string;
  endUtc: string;
  meetingLink: string;
  cancellationToken: string;
  status: 'CONFIRMED';
}

export const bookSlotApi = {
  book: (data: BookSlotRequest, idempotencyKey: string) => 
    fetchApi<BookSlotResponse>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Idempotency-Key': idempotencyKey,
      }
    }),
  generateKey: () => uuidv4(),
};
