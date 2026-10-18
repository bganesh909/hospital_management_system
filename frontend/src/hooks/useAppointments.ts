import { getErrorMessage } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { appointmentService } from '../services/appointmentService';
import type {
  AppointmentFormData,
  AppointmentListParams,
  AppointmentStatus,
} from '../services/appointmentService';

const APPOINTMENTS_KEY = 'appointments';

export function useAppointments(params: AppointmentListParams = {}) {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, params],
    queryFn: () => appointmentService.getAll(params),
  });
}

export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, id],
    queryFn: () => appointmentService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AppointmentFormData) => appointmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
      toast.success('Appointment booked successfully');
    },
    onError: (error: any) => {
      toast.error(
        getErrorMessage(error, 'Failed to book appointment'),
      );
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Omit<AppointmentFormData, 'patient_id'>>;
    }) => appointmentService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
      toast.success('Appointment updated successfully');
    },
    onError: (error: any) => {
      toast.error(
        getErrorMessage(error, 'Failed to update appointment'),
      );
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      appointmentService.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
      toast.success('Appointment cancelled');
    },
    onError: (error: any) => {
      toast.error(
        getErrorMessage(error, 'Failed to cancel appointment'),
      );
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [APPOINTMENTS_KEY] });
      toast.success('Status updated');
    },
    onError: (error: any) => {
      toast.error(
        getErrorMessage(error, 'Failed to update status'),
      );
    },
  });
}

export function useAppointmentSlots(doctorId: string, date: string) {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, 'slots', doctorId, date],
    queryFn: () => appointmentService.getSlots(doctorId, date),
    enabled: !!doctorId && !!date,
  });
}

export function useTodayAppointments() {
  return useQuery({
    queryKey: [APPOINTMENTS_KEY, 'today'],
    queryFn: () => appointmentService.getToday(),
  });
}
