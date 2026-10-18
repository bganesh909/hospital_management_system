import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ipdService } from '../services/ipdService';
import type {
  AdmissionCreatePayload,
  AdmissionUpdatePayload,
  BedBulkCreatePayload,
  BedCreatePayload,
  DailyRoundCreatePayload,
  ManualBedStatus,
  WardCreatePayload,
  WardPayload,
} from '../services/ipdService';
import { getErrorMessage } from '../lib/utils';

const ADMISSION_KEYS = {
  all: ['ipd-admissions'] as const,
  list: (params?: Record<string, any>) => ['ipd-admissions', 'list', params] as const,
  detail: (id: string) => ['ipd-admissions', 'detail', id] as const,
};

const WARD_KEYS = {
  all: ['ipd-wards'] as const,
  list: (params?: Record<string, any>) => ['ipd-wards', 'list', params] as const,
  beds: (wardId: string) => ['ipd-wards', 'beds', wardId] as const,
};

const BED_KEYS = {
  available: (params?: Record<string, any>) => ['ipd-beds', 'available', params] as const,
};

const ROUND_KEYS = {
  list: (admissionId: string) => ['ipd-rounds', admissionId] as const,
};

// Admissions
export function useAdmissions(params?: Record<string, any>) {
  return useQuery({
    queryKey: ADMISSION_KEYS.list(params),
    queryFn: () => ipdService.getAdmissions(params),
  });
}

export function useAdmission(id: string) {
  return useQuery({
    queryKey: ADMISSION_KEYS.detail(id),
    queryFn: () => ipdService.getAdmission(id),
    enabled: !!id,
  });
}

export function useCreateAdmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdmissionCreatePayload) => ipdService.createAdmission(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMISSION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['ipd-beds'] });
      toast.success('Patient admitted successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to admit patient'));
    },
  });
}

export function useUpdateAdmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdmissionUpdatePayload }) =>
      ipdService.updateAdmission(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMISSION_KEYS.all });
      toast.success('Admission updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update admission'));
    },
  });
}

export function useDischargeAdmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dischargeSummary }: { id: string; dischargeSummary?: string }) =>
      ipdService.dischargeAdmission(id, { discharge_summary: dischargeSummary }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMISSION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['ipd-beds'] });
      toast.success('Patient discharged successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to discharge patient'));
    },
  });
}

export function useTransferBed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bedId }: { id: string; bedId: string }) => ipdService.transferBed(id, bedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMISSION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['ipd-beds'] });
      toast.success('Patient transferred');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to transfer patient'));
    },
  });
}

// Daily Rounds
export function useRounds(admissionId: string) {
  return useQuery({
    queryKey: ROUND_KEYS.list(admissionId),
    queryFn: () => ipdService.getRounds(admissionId),
    enabled: !!admissionId,
  });
}

export function useCreateRound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ admissionId, data }: { admissionId: string; data: DailyRoundCreatePayload }) =>
      ipdService.createRound(admissionId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ROUND_KEYS.list(variables.admissionId) });
      toast.success('Daily round recorded');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to record daily round'));
    },
  });
}

// Wards
export function useWards(params?: Record<string, any>) {
  return useQuery({
    queryKey: WARD_KEYS.list(params),
    queryFn: () => ipdService.getWards(params),
  });
}

export function useCreateWard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: WardCreatePayload) => ipdService.createWard(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Ward created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create ward'));
    },
  });
}

export function useUpdateWard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WardPayload> }) =>
      ipdService.updateWard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Ward updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update ward'));
    },
  });
}

export function useDeleteWard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipdService.deleteWard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Ward deleted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete ward'));
    },
  });
}

export function useWardBeds(wardId: string) {
  return useQuery({
    queryKey: WARD_KEYS.beds(wardId),
    queryFn: () => ipdService.getWardBeds(wardId),
    enabled: !!wardId,
  });
}

// Beds
export function useAvailableBeds(params?: Record<string, any>) {
  return useQuery({
    queryKey: BED_KEYS.available(params),
    queryFn: () => ipdService.getAvailableBeds(params),
  });
}

export function useCreateBed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BedCreatePayload) => ipdService.createBed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Bed created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create bed'));
    },
  });
}

export function useUpdateBedStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ManualBedStatus }) =>
      ipdService.updateBedStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Bed status updated');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update bed status'));
    },
  });
}

export function useCreateBedsBulk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BedBulkCreatePayload) => ipdService.createBedsBulk(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success(`${res?.data?.length ?? 0} beds added`);
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to add beds'));
    },
  });
}

export function useUpdateBedNumber() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bedNumber }: { id: string; bedNumber: string }) =>
      ipdService.updateBedNumber(id, bedNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Bed renamed');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to rename bed'));
    },
  });
}

export function useDeleteBed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ipdService.deleteBed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WARD_KEYS.all });
      toast.success('Bed deleted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete bed'));
    },
  });
}
