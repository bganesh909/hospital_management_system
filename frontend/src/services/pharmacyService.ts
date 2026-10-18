import api from '../config/api';
import type { Prescription } from './opdService';

export interface Medicine {
  id: string;
  name: string;
  generic_name: string | null;
  category_id: string | null;
  category_name: string | null;
  manufacturer: string | null;
  unit_price: number;
  stock_quantity: number;
  reorder_level: number;
  expiry_date: string | null;
  batch_number: string | null;
  requires_prescription: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicineCreatePayload {
  name: string;
  generic_name?: string;
  category_id?: string;
  manufacturer?: string;
  unit_price: number;
  stock_quantity?: number;
  reorder_level?: number;
  expiry_date?: string;
  batch_number?: string;
  requires_prescription?: boolean;
  description?: string;
}

// Stock is changed via the stock endpoint, not the medicine update
export type MedicineUpdatePayload = Partial<Omit<MedicineCreatePayload, 'stock_quantity'>>;

export interface StockUpdatePayload {
  quantity: number;
  operation: 'add' | 'subtract' | 'set';
}

export interface PharmacyCategory {
  id: string;
  name: string;
  medicine_count: number;
}

export interface DispensationItem {
  id: string;
  dispensation_id: string;
  medicine_id: string;
  medicine_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Dispensation {
  id: string;
  dispensation_number: string;
  prescription_id: string;
  prescription_number: string | null;
  patient_id: string | null;
  patient_name: string | null;
  doctor_name: string | null;
  dispensed_by: string;
  total_amount: number;
  status: 'dispensed' | 'returned' | 'partial';
  notes: string | null;
  items: DispensationItem[];
  created_at: string;
}

export type PendingPrescription = Prescription;

export interface DispensationCreatePayload {
  prescription_id: string;
  items: {
    medicine_id?: string;
    medicine_name?: string;
    quantity: number;
  }[];
  notes?: string;
}

export const pharmacyService = {
  // Medicines
  getMedicines: async (params?: Record<string, any>) => {
    const response = await api.get('/pharmacy/medicines', { params });
    return response.data;
  },

  getMedicine: async (id: string) => {
    const response = await api.get(`/pharmacy/medicines/${id}`);
    return response.data;
  },

  createMedicine: async (data: MedicineCreatePayload) => {
    const response = await api.post('/pharmacy/medicines', data);
    return response.data;
  },

  updateMedicine: async (id: string, data: MedicineUpdatePayload) => {
    const response = await api.put(`/pharmacy/medicines/${id}`, data);
    return response.data;
  },

  updateStock: async (id: string, data: StockUpdatePayload) => {
    const response = await api.patch(`/pharmacy/medicines/${id}/stock`, data);
    return response.data;
  },

  getLowStock: async () => {
    const response = await api.get('/pharmacy/medicines/low-stock');
    return response.data;
  },

  getExpiring: async () => {
    const response = await api.get('/pharmacy/medicines/expiring');
    return response.data;
  },

  // Categories
  getCategories: async () => {
    const response = await api.get('/pharmacy/categories');
    return response.data;
  },

  createCategory: async (data: { name: string }) => {
    const response = await api.post('/pharmacy/categories', data);
    return response.data;
  },

  updateCategory: async (id: string, data: { name: string }) => {
    const response = await api.put(`/pharmacy/categories/${id}`, data);
    return response.data;
  },

  deleteCategory: async (id: string) => {
    const response = await api.delete(`/pharmacy/categories/${id}`);
    return response.data;
  },

  // Dispensations
  getDispensations: async (params?: Record<string, any>) => {
    const response = await api.get('/pharmacy/dispensations', { params });
    return response.data;
  },

  createDispensation: async (data: DispensationCreatePayload) => {
    const response = await api.post('/pharmacy/dispensations', data);
    return response.data;
  },

  // Pending Prescriptions
  getPendingPrescriptions: async () => {
    const response = await api.get('/pharmacy/prescriptions/pending');
    return response.data;
  },
};
