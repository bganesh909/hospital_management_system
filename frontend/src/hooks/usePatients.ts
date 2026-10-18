import { getErrorMessage } from '../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { patientService } from '../services/patientService';
import type { PatientFormData, PatientListParams } from '../services/patientService';

const PATIENTS_KEY = 'patients';

export function usePatients(params: PatientListParams = {}) {
  return useQuery({
    queryKey: [PATIENTS_KEY, params],
    queryFn: () => patientService.getAll(params),
  });
}

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: [PATIENTS_KEY, id],
    queryFn: () => patientService.getById(id!),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PatientFormData) => patientService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
      toast.success('Patient registered successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to register patient'));
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatientFormData }) =>
      patientService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
      toast.success('Patient updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update patient'));
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => patientService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PATIENTS_KEY] });
      toast.success('Patient deleted successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete patient'));
    },
  });
}

export function usePatientHistory(id: string | undefined) {
  return useQuery({
    queryKey: [PATIENTS_KEY, id, 'history'],
    queryFn: () => patientService.getHistory(id!),
    enabled: !!id,
  });
}

export function useSearchPatients(query: string) {
  return useQuery({
    queryKey: [PATIENTS_KEY, 'search', query],
    queryFn: () => patientService.search(query),
    enabled: query.length >= 2,
  });
}
