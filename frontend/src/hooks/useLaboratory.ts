import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { laboratoryService } from '../services/laboratoryService';
import type {
  TestCatalogCreatePayload,
  LabRequestCreatePayload,
  LabRequestStatus,
  ResultEntryPayload,
} from '../services/laboratoryService';
import { getErrorMessage } from '../lib/utils';

const CATALOG_KEYS = {
  all: ['lab-catalog'] as const,
  list: (params?: Record<string, any>) => ['lab-catalog', 'list', params] as const,
};

const REQUEST_KEYS = {
  all: ['lab-requests'] as const,
  list: (params?: Record<string, any>) => ['lab-requests', 'list', params] as const,
  detail: (id: string) => ['lab-requests', 'detail', id] as const,
  pending: ['lab-requests', 'pending'] as const,
};

// Test Catalog
export function useTestCatalog(params?: Record<string, any>) {
  return useQuery({
    queryKey: CATALOG_KEYS.list(params),
    queryFn: () => laboratoryService.getCatalog(params),
  });
}

export function useCreateCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TestCatalogCreatePayload) => laboratoryService.createCatalogItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.all });
      toast.success('Test added to catalog');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to add test'));
    },
  });
}

export function useUpdateCatalogItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<TestCatalogCreatePayload, 'test_code'>> }) =>
      laboratoryService.updateCatalogItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.all });
      toast.success('Test updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update test'));
    },
  });
}

// Lab Requests
export function useLabRequests(params?: Record<string, any>) {
  return useQuery({
    queryKey: REQUEST_KEYS.list(params),
    queryFn: () => laboratoryService.getRequests(params),
  });
}

export function useLabRequest(id: string) {
  return useQuery({
    queryKey: REQUEST_KEYS.detail(id),
    queryFn: () => laboratoryService.getRequest(id),
    enabled: !!id,
  });
}

export function useCreateLabRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LabRequestCreatePayload) => laboratoryService.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUEST_KEYS.all });
      toast.success('Lab request created');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create lab request'));
    },
  });
}

export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LabRequestStatus }) =>
      laboratoryService.updateRequestStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUEST_KEYS.all });
      toast.success('Request status updated');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    },
  });
}

export function useUpdateItemResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: ResultEntryPayload }) =>
      laboratoryService.updateItemResult(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUEST_KEYS.all });
      toast.success('Result recorded');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to record result'));
    },
  });
}

export function usePendingLabRequests() {
  return useQuery({
    queryKey: REQUEST_KEYS.pending,
    queryFn: () => laboratoryService.getPendingRequests(),
  });
}

export function useLabReport(id: string) {
  return useQuery({
    queryKey: ['lab-report', id],
    queryFn: () => laboratoryService.getReport(id),
    enabled: !!id,
  });
}
