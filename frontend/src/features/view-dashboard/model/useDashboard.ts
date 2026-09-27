import { useState, useEffect, useCallback } from 'react';
import { dashboardApi, type DashboardResponse } from '../api';

export function useDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);

    dashboardApi.getDashboard()
      .then((res) => { if (mounted) setData(res); })
      .catch((err) => { if (mounted) setError(err.message ?? 'Failed to load dashboard'); })
      .finally(() => { if (mounted) setIsLoading(false); });

    return () => { mounted = false; };
  }, [tick]);

  const refetch = useCallback(() => setTick(t => t + 1), []);

  return { data, isLoading, error, refetch };
}
