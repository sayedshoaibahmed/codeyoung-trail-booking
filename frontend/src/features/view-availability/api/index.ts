import { fetchApi } from '../../../shared/api/base';
import type { AvailabilityResponse } from '../../../entities/slot/model/types';

export const viewAvailabilityApi = {
  getSlots: (date: string, timezone: string, options?: RequestInit) =>
    fetchApi<AvailabilityResponse>(
      `/availability?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`,
      options,
    ),
};
