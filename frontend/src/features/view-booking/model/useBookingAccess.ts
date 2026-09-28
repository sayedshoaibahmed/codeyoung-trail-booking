/**
 * features/view-booking — model/useBookingAccess.ts
 *
 * Loads a booking via POST /booking-access. The token comes from the route
 * path (email View Booking link). Does not persist credentials in the browser.
 */
import { useCallback, useEffect, useState } from 'react';
import { bookingApi } from '../../../entities/booking/api';
import { ApiError } from '../../../shared/api/base';
import type { Booking } from '../../../entities/booking/model/types';

const SAFE_ACCESS_ERROR = 'Booking link is invalid or has expired.';

interface UseBookingAccessResult {
  booking: Booking | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useBookingAccess(accessToken: string | undefined): UseBookingAccessResult {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(accessToken));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      setBooking(null);
      setError(SAFE_ACCESS_ERROR);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    bookingApi.getBookingByAccessToken(accessToken, controller.signal)
      .then((res) => { if (!controller.signal.aborted) setBooking(res); })
      .catch((err) => {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        const message = err instanceof ApiError ? err.message : SAFE_ACCESS_ERROR;
        setError(message || SAFE_ACCESS_ERROR);
        setBooking(null);
      })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });

    return () => { controller.abort(); };
  }, [accessToken, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { booking, isLoading, error, refetch };
}
