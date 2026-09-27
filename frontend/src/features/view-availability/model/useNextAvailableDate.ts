import { useEffect, useState } from 'react';
import { viewAvailabilityApi } from '../api';

const NEXT_DATE_ERROR = "We couldn't check future availability.";

export function useNextAvailableDate(date: string, timezone: string, enabled: boolean) {
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !date || !timezone) {
      setNextAvailableDate(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setNextAvailableDate(null);

    viewAvailabilityApi.getNextAvailableDate(date, timezone, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return;
        setNextAvailableDate(res.nextAvailableDate);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) return;
        setNextAvailableDate(null);
        setError(NEXT_DATE_ERROR);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [date, timezone, enabled]);

  return { nextAvailableDate, isLoading, error };
}
