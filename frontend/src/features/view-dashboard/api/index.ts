import { fetchApi } from '../../../shared/api/base';

export interface DashboardBookingDto {
  id: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  mentorId: string;
  startTimeUtc: string;
  endTimeUtc: string;
  mentorLocalDate: string;
  status: 'CONFIRMED' | 'CANCELLED';
  cancelledAt: string | null;
  meetingLink: string;
}

export interface MentorUtilizationDto {
  mentorId: string;
  mentorName: string;
  mentorEmail: string;
  shift: 'SHIFT_1' | 'SHIFT_2';
  confirmedCount: number;
  cancelledCount: number;
}

export interface DashboardResponse {
  generatedAt: string;
  summary: {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
  };
  upcomingConfirmed: DashboardBookingDto[];
  recentlyCancelled: DashboardBookingDto[];
  mentorUtilization: MentorUtilizationDto[];
}

export const dashboardApi = {
  getDashboard: () => fetchApi<DashboardResponse>('/admin/dashboard'),
};
