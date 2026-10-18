import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { ReportRangeParams } from '../services/dashboardService';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardService.getStats,
    refetchInterval: 60000,
  });
}

export function useTodayAppointments() {
  return useQuery({
    queryKey: ['dashboard', 'appointments-today'],
    queryFn: dashboardService.getTodayAppointments,
    refetchInterval: 60000,
  });
}

export function useDashboardRevenue(params: ReportRangeParams = { period: '12months' }) {
  return useQuery({
    queryKey: ['dashboard', 'revenue', params],
    queryFn: () => dashboardService.getRevenue(params),
  });
}

export function useBedOccupancy() {
  return useQuery({
    queryKey: ['dashboard', 'occupancy'],
    queryFn: dashboardService.getOccupancy,
    refetchInterval: 120000,
  });
}

export function useDepartmentStats() {
  return useQuery({
    queryKey: ['dashboard', 'department-stats'],
    queryFn: dashboardService.getDepartmentStats,
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', limit],
    queryFn: () => dashboardService.getRecentActivity(limit),
    refetchInterval: 30000,
  });
}

export function usePatientTrends(params: ReportRangeParams = {}) {
  return useQuery({
    queryKey: ['dashboard', 'patient-trends', params],
    queryFn: () => dashboardService.getPatientTrends(params),
  });
}

export function useAttendanceTrends(params: ReportRangeParams = {}) {
  return useQuery({
    queryKey: ['dashboard', 'attendance-trends', params],
    queryFn: () => dashboardService.getAttendanceTrends(params),
  });
}
