import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pharmacyService } from '../services/pharmacyService';
import type {
  MedicineCreatePayload,
  MedicineUpdatePayload,
  DispensationCreatePayload,
  StockUpdatePayload,
} from '../services/pharmacyService';
import { getErrorMessage } from '../lib/utils';

const MEDICINE_KEYS = {
  all: ['pharmacy-medicines'] as const,
  list: (params?: Record<string, any>) => ['pharmacy-medicines', 'list', params] as const,
  detail: (id: string) => ['pharmacy-medicines', 'detail', id] as const,
  lowStock: ['pharmacy-medicines', 'low-stock'] as const,
  expiring: ['pharmacy-medicines', 'expiring'] as const,
};

const CATEGORY_KEYS = {
  all: ['pharmacy-categories'] as const,
};

const DISPENSATION_KEYS = {
  all: ['pharmacy-dispensations'] as const,
  list: (params?: Record<string, any>) => ['pharmacy-dispensations', 'list', params] as const,
};

const PENDING_KEYS = {
  all: ['pharmacy-pending-prescriptions'] as const,
};

// Medicines
export function useMedicines(params?: Record<string, any>) {
  return useQuery({
    queryKey: MEDICINE_KEYS.list(params),
    queryFn: () => pharmacyService.getMedicines(params),
  });
}

export function useMedicine(id: string) {
  return useQuery({
    queryKey: MEDICINE_KEYS.detail(id),
    queryFn: () => pharmacyService.getMedicine(id),
    enabled: !!id,
  });
}

export function useCreateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: MedicineCreatePayload) => pharmacyService.createMedicine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDICINE_KEYS.all });
      toast.success('Medicine added successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to add medicine'));
    },
  });
}

export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MedicineUpdatePayload }) =>
      pharmacyService.updateMedicine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDICINE_KEYS.all });
      toast.success('Medicine updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update medicine'));
    },
  });
}

export function useUpdateStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: StockUpdatePayload }) =>
      pharmacyService.updateStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEDICINE_KEYS.all });
      toast.success('Stock updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update stock'));
    },
  });
}

export function useLowStockMedicines() {
  return useQuery({
    queryKey: MEDICINE_KEYS.lowStock,
    queryFn: () => pharmacyService.getLowStock(),
  });
}

export function useExpiringMedicines() {
  return useQuery({
    queryKey: MEDICINE_KEYS.expiring,
    queryFn: () => pharmacyService.getExpiring(),
  });
}

// Categories
export function usePharmacyCategories() {
  return useQuery({
    queryKey: CATEGORY_KEYS.all,
    queryFn: () => pharmacyService.getCategories(),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => pharmacyService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.all });
      toast.success('Category created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create category'));
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      pharmacyService.updateCategory(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.all });
      // Medicine rows show category_name
      queryClient.invalidateQueries({ queryKey: MEDICINE_KEYS.all });
      toast.success('Category updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update category'));
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pharmacyService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEYS.all });
      toast.success('Category deleted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to delete category'));
    },
  });
}

// Dispensations
export function useDispensations(params?: Record<string, any>) {
  return useQuery({
    queryKey: DISPENSATION_KEYS.list(params),
    queryFn: () => pharmacyService.getDispensations(params),
  });
}

export function useCreateDispensation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DispensationCreatePayload) => pharmacyService.createDispensation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISPENSATION_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PENDING_KEYS.all });
      queryClient.invalidateQueries({ queryKey: MEDICINE_KEYS.all });
      toast.success('Medicines dispensed successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to dispense medicines'));
    },
  });
}

// Pending Prescriptions
export function usePendingPrescriptions() {
  return useQuery({
    queryKey: PENDING_KEYS.all,
    queryFn: () => pharmacyService.getPendingPrescriptions(),
  });
}
