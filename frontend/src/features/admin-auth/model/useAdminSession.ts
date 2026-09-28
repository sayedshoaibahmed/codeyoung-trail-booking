import { useEffect, useState } from 'react';
import { adminAuthApi } from '../api';

export type AdminSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function useAdminSession(): AdminSessionStatus {
  const [status, setStatus] = useState<AdminSessionStatus>('loading');

  useEffect(() => {
    const controller = new AbortController();
    adminAuthApi.getSession()
      .then(() => {
        if (!controller.signal.aborted) setStatus('authenticated');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('unauthenticated');
      });
    return () => controller.abort();
  }, []);

  return status;
}
