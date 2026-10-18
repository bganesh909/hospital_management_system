import api from '../config/api';
import type { ApiResponse } from '../types/common.types';

export interface DashboardStats {
  total_patients: number;
  new_patients_this_month: number;
  /** Percent change vs previous period; null when there's no baseline */
  patients_change: number | null;
  todays_appointments: number;
  appointments_change: number | null;
  total_beds: number;
  occupied_beds: number;
  bed_occupancy_percent: number;
  monthly_revenue: number;
  revenue_change: number | null;
  total_doctors: number;
  total_staff: number;
  active_admissions: number;
  weekly_visits: { day: string; patients: number }[];
}

export interface TodayAppointment {
  id: string;
  time: string | null;
  patient_name: string;
  doctor_name: string;
  department: string | null;
  status: string;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface RevenueReport {
  series: RevenueDataPoint[];
  totals: {
    total_invoiced: number;
    total_paid: number;
    total_pending: number;
  };
}

export interface OccupancyData {
  ward_id: string;
  ward: string;
  total_beds: number;
  occupied: number;
  available: number;
  occupancy_percent: number;
}

export interface DepartmentStat {
  department: string;
  patients: number;
  doctors: number;
}

export interface ActivityItem {
  id: string;
  type: 'patient' | 'appointment' | 'billing' | 'admission' | 'discharge';
  description: string;
  timestamp: string;
}

export interface PatientReport {
  series: { month: string; new_patients: number; returning: number }[];
  summary: {
    total_patients: number;
    new_in_range: number;
    new_this_month: number;
    returning_in_range: number;
  };
}

export interface AttendanceReport {
  total_staff: number;
  on_leave: number;
  average_attendance: number;
  months: { month: string; present: number; absent: number; leave: number }[];
}

export interface ReportRangeParams {
  period?: string;
  date_from?: string;
  date_to?: string;
}

export const dashboardService = {
  getStats: async (): Promise<ApiResponse<DashboardStats>> => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getTodayAppointments: async (): Promise<ApiResponse<TodayAppointment[]>> => {
    const response = await api.get('/dashboard/today-appointments');
    return response.data;
  },

  getRevenue: async (params: ReportRangeParams = { period: '12months' }): Promise<ApiResponse<RevenueReport>> => {
    const response = await api.get('/dashboard/revenue', { params });
    return response.data;
  },

  getOccupancy: async (): Promise<ApiResponse<OccupancyData[]>> => {
    const response = await api.get('/dashboard/occupancy');
    return response.data;
  },

  getDepartmentStats: async (): Promise<ApiResponse<DepartmentStat[]>> => {
    const response = await api.get('/dashboard/department-stats');
    return response.data;
  },

  getRecentActivity: async (limit = 10): Promise<ApiResponse<ActivityItem[]>> => {
    const response = await api.get('/dashboard/recent-activity', { params: { limit } });
    return response.data;
  },

  getPatientTrends: async (params: ReportRangeParams = {}): Promise<ApiResponse<PatientReport>> => {
    const response = await api.get('/dashboard/patient-trends', { params });
    return response.data;
  },

  getAttendanceTrends: async (params: ReportRangeParams = {}): Promise<ApiResponse<AttendanceReport>> => {
    const response = await api.get('/dashboard/attendance-trends', { params });
    return response.data;
  },
};
