export interface AvailableSlot {
  startUtc: string; // ISO 8601
  endUtc: string; // ISO 8601
  mentorId: string;
}

export interface AvailabilityResponse {
  requestedDate: string;
  parentTimezone: string;
  slots: AvailableSlot[];
}
