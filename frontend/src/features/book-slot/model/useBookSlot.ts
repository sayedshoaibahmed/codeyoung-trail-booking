import { useState, useRef } from 'react';
import { bookSlotApi, type BookSlotRequest, type BookSlotResponse } from '../api';
import { ApiError } from '../../../shared/api/base';

export const SLOT_NO_LONGER_AVAILABLE_MESSAGE =
  'This time is no longer available. Please choose another slot.';

export function isSlotConflictError(error: ApiError | null): boolean {
  return error?.code === 'SLOT_NOT_AVAILABLE';
}

export function bookingErrorDisplayMessage(error: ApiError): string {
  if (isSlotConflictError(error)) return SLOT_NO_LONGER_AVAILABLE_MESSAGE;
  return error.message || 'An error occurred.';
}

export type BookOutcome =
  | { ok: true; booking: BookSlotResponse }
  | { ok: false; error: ApiError };

export function useBookSlot() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Persist the idempotency key across retries for the same form state
  const idempotencyKeyRef = useRef(bookSlotApi.generateKey());

  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = bookSlotApi.generateKey();
  };

  const book = async (data: BookSlotRequest): Promise<BookOutcome> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await bookSlotApi.book(data, idempotencyKeyRef.current);
      resetIdempotencyKey();
      return { ok: true, booking: response };
    } catch (err: unknown) {
      const apiError = err instanceof ApiError
        ? err
        : new ApiError(500, 'UNKNOWN', err instanceof Error ? err.message : 'An error occurred.');
      if (isSlotConflictError(apiError)) {
        resetIdempotencyKey();
      }
      setError(apiError);
      return { ok: false, error: apiError };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { book, isSubmitting, error, resetError: () => setError(null) };
}
