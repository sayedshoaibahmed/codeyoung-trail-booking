/**
 * features/view-booking — model/useBookingAccess.ts
 *
 * Loads a booking via POST /booking-access. The token comes from the route
 * path (email View Booking link). Does not persist credentials in the browser.
 */
import { useState, useEffect, useCallback } from 'react';
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

    let mounted = true;
    setIsLoading(true);
    setError(null);

    bookingApi.getBookingByAccessToken(accessToken)
      .then((res) => { if (mounted) setBooking(res); })
      .catch((err) => {
        if (!mounted) return;
        const message = err instanceof ApiError ? err.message : SAFE_ACCESS_ERROR;
        setError(message || SAFE_ACCESS_ERROR);
        setBooking(null);
      })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [accessToken, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { booking, isLoading, error, refetch };
}
