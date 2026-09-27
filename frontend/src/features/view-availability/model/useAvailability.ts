import { useState, useEffect, useCallback, useRef } from 'react';
import { viewAvailabilityApi } from '../api';
import type { AvailableSlot } from '../../../entities/slot/model/types';

export function isAvailabilityAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function isCurrentAvailabilityRequest(
  requestId: number,
  latestRequestId: number,
): boolean {
  return requestId === latestRequestId;
}

export function useAvailability(date: string, timezone: string) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(date && timezone));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const latestRequestId = useRef(0);

  useEffect(() => {
    if (!date || !timezone) return;

    const controller = new AbortController();
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    setIsLoading(true);
    setError(null);

    viewAvailabilityApi.getSlots(date, timezone, { signal: controller.signal })
      .then((res) => {
        if (!isCurrentAvailabilityRequest(requestId, latestRequestId.current)) return;
        const sorted = res.slots.sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
        setSlots(sorted);
      })
      .catch((err: unknown) => {
        if (!isCurrentAvailabilityRequest(requestId, latestRequestId.current)) return;
        if (isAvailabilityAbortError(err) || controller.signal.aborted) return;
        setSlots([]);
        setError(err instanceof Error ? err.message : 'Failed to fetch availability.');
      })
      .finally(() => {
        if (!isCurrentAvailabilityRequest(requestId, latestRequestId.current)) return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [date, timezone, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { slots, isLoading, error, refetch };
}
