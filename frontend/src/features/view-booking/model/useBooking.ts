/**
 * features/view-booking — model/useBooking.ts
 *
 * Fetches a single booking by ID and exposes { booking, isLoading, error }.
 * Reload can be triggered by calling refetch().
 *
 * This hook is the correct owner of GET /bookings/:id data-orchestration.
 * ConfirmationPage uses this hook rather than calling the entity API directly,
 * keeping the page as pure route-level composition.
 *
 * FSD rule: features may import from entities and shared. Never from widgets/pages.
 */
import { useState, useEffect, useCallback } from 'react';
import { bookingApi } from '../../../entities/booking/api';
import type { Booking } from '../../../entities/booking/model/types';

interface UseBookingResult {
  booking: Booking | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch the booking (e.g. after cancellation) */
  refetch: () => void;
}

export function useBooking(id: string | undefined): UseBookingResult {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!id) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);

    bookingApi.getBooking(id)
      .then((res) => { if (mounted) setBooking(res); })
      .catch((err) => { if (mounted) setError(err.message ?? 'Failed to load booking.'); })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [id, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { booking, isLoading, error, refetch };
}
