export interface Booking {
  id: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  parentTimezone: string;
  startTimeUtc: string; // ISO 8601
  endTimeUtc: string; // ISO 8601
  mentorId: string;
  mentorName: string;
  mentorTimezone: string;
  mentorLocalDate: string;
  meetingLink: string;
  status: 'CONFIRMED' | 'CANCELLED';
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
