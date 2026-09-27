import { useState, useRef } from 'react';
import { bookSlotApi, type BookSlotRequest, type BookSlotResponse } from '../api';
import { ApiError } from '../../../shared/api/base';

export function useBookSlot() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  
  // Persist the idempotency key across retries for the same form state
  const idempotencyKeyRef = useRef(bookSlotApi.generateKey());

  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = bookSlotApi.generateKey();
  };

  const book = async (data: BookSlotRequest): Promise<BookSlotResponse | null> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await bookSlotApi.book(data, idempotencyKeyRef.current);
      // On success, reset the key so the next booking gets a new one
      resetIdempotencyKey();
      return response;
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(500, 'UNKNOWN', err.message || 'An error occurred.'));
      }
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { book, isSubmitting, error, resetError: () => setError(null) };
}
