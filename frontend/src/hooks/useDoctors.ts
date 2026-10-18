import { getErrorMessage } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  doctorService,
  departmentService,
} from '../services/doctorService';
import type {
  DepartmentPayload,
  DoctorFormData,
  DoctorListParams,
  DoctorSchedule,
  DoctorUpdateData,
} from '../services/doctorService';

const DOCTORS_KEY = 'doctors';
const DEPARTMENTS_KEY = 'departments';

export function useDoctors(params: DoctorListParams = {}) {
  return useQuery({
    queryKey: [DOCTORS_KEY, params],
    queryFn: () => doctorService.getAll(params),
  });
}

export function useDoctor(id: string | undefined) {
  return useQuery({
    queryKey: [DOCTORS_KEY, id],
    queryFn: () => doctorService.getById(id!),
    enabled: !!id,
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DoctorFormData) => doctorService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] });
      toast.success('Doctor added successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to add doctor'));
    },
  });
}

export function useUpdateDoctor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DoctorUpdateData }) =>
      doctorService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] });
      toast.success('Doctor updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update doctor'));
    },
  });
}

export function useDoctorSchedule(id: string | undefined) {
  return useQuery({
    queryKey: [DOCTORS_KEY, id, 'schedule'],
    queryFn: () => doctorService.getSchedule(id!),
    enabled: !!id,
  });
}

export function useUpdateDoctorSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, schedule }: { id: string; schedule: DoctorSchedule[] }) =>
      doctorService.updateSchedule(id, schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] });
      toast.success('Schedule updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update schedule'));
    },
  });
}

export function useAvailableDoctors(departmentId?: string) {
  return useQuery({
    queryKey: [DOCTORS_KEY, 'available', departmentId],
    queryFn: () => doctorService.getAvailable(departmentId),
  });
}

export function useDepartments(params?: { search?: string }) {
  return useQuery({
    queryKey: [DEPARTMENTS_KEY, params],
    queryFn: () => departmentService.getAll(params),
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DepartmentPayload) => departmentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY] });
      toast.success('Department created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create department'));
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentPayload> }) =>
      departmentService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [DOCTORS_KEY] });
      toast.success('Department updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update department'));
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEPARTMENTS_KEY] });
      toast.success('Department deleted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete department'));
    },
  });
}
