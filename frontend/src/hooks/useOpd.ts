import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { opdService } from '../services/opdService';
import type {
  OpdVisitCreatePayload,
  OpdVisitUpdatePayload,
  PrescriptionCreatePayload,
  PrescriptionUpdatePayload,
} from '../services/opdService';
import { getErrorMessage } from '../lib/utils';

const VISIT_KEYS = {
  all: ['opd-visits'] as const,
  list: (params?: Record<string, any>) => ['opd-visits', 'list', params] as const,
  detail: (id: string) => ['opd-visits', 'detail', id] as const,
};

const PRESCRIPTION_KEYS = {
  all: ['opd-prescriptions'] as const,
  list: (params?: Record<string, any>) => ['opd-prescriptions', 'list', params] as const,
  detail: (id: string) => ['opd-prescriptions', 'detail', id] as const,
};

export function useOpdVisits(params?: Record<string, any>) {
  return useQuery({
    queryKey: VISIT_KEYS.list(params),
    queryFn: () => opdService.getVisits(params),
  });
}

export function useOpdVisit(id: string) {
  return useQuery({
    queryKey: VISIT_KEYS.detail(id),
    queryFn: () => opdService.getVisit(id),
    enabled: !!id,
  });
}

export function useCreateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OpdVisitCreatePayload) => opdService.createVisit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VISIT_KEYS.all });
      toast.success('OPD visit created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create OPD visit'));
    },
  });
}

export function useUpdateVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: OpdVisitUpdatePayload }) =>
      opdService.updateVisit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VISIT_KEYS.all });
      toast.success('Visit updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update visit'));
    },
  });
}

export function useCompleteVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => opdService.completeVisit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VISIT_KEYS.all });
      toast.success('Visit marked as completed');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to complete visit'));
    },
  });
}

export function usePrescriptions(params?: Record<string, any>) {
  return useQuery({
    queryKey: PRESCRIPTION_KEYS.list(params),
    queryFn: () => opdService.getPrescriptions(params),
  });
}

export function usePrescription(id: string) {
  return useQuery({
    queryKey: PRESCRIPTION_KEYS.detail(id),
    queryFn: () => opdService.getPrescription(id),
    enabled: !!id,
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PrescriptionCreatePayload) => opdService.createPrescription(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRESCRIPTION_KEYS.all });
      toast.success('Prescription created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create prescription'));
    },
  });
}

export function useUpdatePrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PrescriptionUpdatePayload }) =>
      opdService.updatePrescription(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PRESCRIPTION_KEYS.all });
      toast.success('Prescription updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update prescription'));
    },
  });
}
