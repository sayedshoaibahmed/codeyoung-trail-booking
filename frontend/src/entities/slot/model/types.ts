export type SlotAvailabilityStatus = 'available' | 'full' | 'blocked';

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  status: SlotAvailabilityStatus;
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  slots: AvailableSlot[];
}
