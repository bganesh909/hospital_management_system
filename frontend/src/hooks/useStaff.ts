import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/utils';
import { staffService } from '../services/staffService';
import type {
  CreateLeaveRequestPayload,
  CreateStaffPayload,
  MarkAttendancePayload,
  UpdateLeaveRequestPayload,
  UpdatePayrollPayload,
  UpdateStaffPayload,
} from '../services/staffService';

export function useStaffList(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['staff', params],
    queryFn: () => staffService.getStaff(params),
  });
}

export function useStaffMember(id: string) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffService.getStaffMember(id),
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStaffPayload) => staffService.createStaff(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member added successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to add staff member'));
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStaffPayload }) =>
      staffService.updateStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update staff member'));
    },
  });
}

// Attendance
export function useAttendance(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['attendance', params],
    queryFn: () => staffService.getAttendance(params),
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MarkAttendancePayload) => staffService.markAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance marked successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to mark attendance'));
    },
  });
}

export function useStaffAttendance(staffId: string, month: number, year: number) {
  return useQuery({
    queryKey: ['attendance', staffId, month, year],
    queryFn: () => staffService.getStaffAttendance(staffId, month, year),
    enabled: !!staffId,
  });
}

// Leave
export function useLeaveRequests(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['leave-requests', params],
    queryFn: () => staffService.getLeaveRequests(params),
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeaveRequestPayload) => staffService.createLeaveRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Leave request submitted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to submit leave request'));
    },
  });
}

export function useUpdateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLeaveRequestPayload }) =>
      staffService.updateLeaveRequest(id, data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      // Approving or cancelling approved leave changes attendance records
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Leave request ${variables.data.status}`);
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update leave request'));
    },
  });
}

// Payroll
export function usePayroll(params: { month: number; year: number; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['payroll', params],
    queryFn: () => staffService.getPayroll(params),
  });
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { month: number; year: number }) => staffService.generatePayroll(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
      const created = res?.data?.created ?? 0;
      toast.success(
        created > 0
          ? `Payroll generated for ${created} staff member${created === 1 ? '' : 's'}`
          : 'Payroll already generated for all eligible staff'
      );
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to generate payroll'));
    },
  });
}

export function useMarkPayrollPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffService.markPayrollPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
      toast.success('Payroll marked as paid');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to mark payroll as paid'));
    },
  });
}

export function usePayrollSummary(params: { month: number; year: number }) {
  return useQuery({
    queryKey: ['payroll-summary', params],
    queryFn: () => staffService.getPayrollSummary(params),
  });
}

export function useUpdatePayroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayrollPayload }) =>
      staffService.updatePayroll(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
      toast.success('Payroll updated');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update payroll'));
    },
  });
}
