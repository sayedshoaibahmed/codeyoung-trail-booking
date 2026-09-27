import { fetchApi } from '../../../shared/api/base';
import type { AvailabilityResponse } from '../../../entities/slot/model/types';

export interface NextAvailableDateResponse {
  date: string;
  timezone: string;
  searchDays: number;
  nextAvailableDate: string | null;
}

export const viewAvailabilityApi = {
  getSlots: (date: string, timezone: string, options?: RequestInit) =>
    fetchApi<AvailabilityResponse>(
      `/availability?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`,
      options,
    ),

  getNextAvailableDate: (date: string, timezone: string, options?: RequestInit) =>
    fetchApi<NextAvailableDateResponse>(
      `/availability/next?date=${encodeURIComponent(date)}&timezone=${encodeURIComponent(timezone)}`,
      options,
    ),
};
