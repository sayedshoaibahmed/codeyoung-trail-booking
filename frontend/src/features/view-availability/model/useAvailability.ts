import { useState, useEffect, useCallback } from 'react';
import { viewAvailabilityApi } from '../api';
import type { AvailableSlot } from '../../../entities/slot/model/types';

export function useAvailability(date: string, timezone: string) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(date && timezone));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!date || !timezone) return;

    let mounted = true;
    setIsLoading(true);
    setError(null);

    viewAvailabilityApi.getSlots(date, timezone)
      .then(res => {
        if (mounted) {
          // Sort slots by start time
          const sorted = res.slots.sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
          setSlots(sorted);
        }
      })
      .catch(err => {
        if (mounted) {
          // A failed request is not an empty calendar. Drop any previous slots.
          setSlots([]);
          setError(err.message || 'Failed to fetch availability.');
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => { mounted = false; };
  }, [date, timezone, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { slots, isLoading, error, refetch };
}
