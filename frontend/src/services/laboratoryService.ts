import api from '../config/api';

export type LabPriority = 'normal' | 'urgent' | 'stat';
export type LabRequestStatus = 'requested' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
export type LabResultStatus = 'normal' | 'abnormal' | 'critical';

export interface TestCatalogItem {
  id: string;
  test_code: string;
  name: string;
  category?: string | null;
  description?: string | null;
  normal_range?: string | null;
  unit?: string | null;
  price: number;
  turnaround_hours: number;
  is_active: boolean;
  created_at: string;
}

export interface TestCatalogCreatePayload {
  test_code: string;
  name: string;
  category?: string;
  description?: string;
  normal_range?: string;
  unit?: string;
  price: number;
  turnaround_hours?: number;
  is_active?: boolean;
}

export interface LabRequestItem {
  id: string;
  request_id: string;
  test_id: string;
  test_name?: string | null;
  test_code?: string | null;
  normal_range?: string | null;
  unit?: string | null;
  result_value?: string | null;
  result_status: 'pending' | LabResultStatus;
  performed_by?: string | null;
  performed_at?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabRequest {
  id: string;
  request_number: string;
  patient_id: string;
  patient_name?: string | null;
  patient_number?: string | null;
  doctor_id: string;
  doctor_name?: string | null;
  opd_visit_id?: string | null;
  ipd_admission_id?: string | null;
  priority: LabPriority;
  status: LabRequestStatus;
  notes?: string | null;
  items: LabRequestItem[];
  created_at: string;
  updated_at: string;
}

export interface LabRequestCreatePayload {
  patient_id: string;
  doctor_id: string;
  opd_visit_id?: string;
  ipd_admission_id?: string;
  priority: LabPriority;
  notes?: string;
  items: { test_id: string }[];
}

export interface ResultEntryPayload {
  result_value: string;
  result_status: LabResultStatus;
  remarks?: string;
}

export const laboratoryService = {
  // Test Catalog
  getCatalog: async (params?: Record<string, any>) => {
    const response = await api.get('/lab/catalog', { params });
    return response.data;
  },

  createCatalogItem: async (data: TestCatalogCreatePayload) => {
    const response = await api.post('/lab/catalog', data);
    return response.data;
  },

  updateCatalogItem: async (id: string, data: Partial<Omit<TestCatalogCreatePayload, 'test_code'>>) => {
    const response = await api.put(`/lab/catalog/${id}`, data);
    return response.data;
  },

  // Lab Requests
  getRequests: async (params?: Record<string, any>) => {
    const response = await api.get('/lab/requests', { params });
    return response.data;
  },

  getRequest: async (id: string) => {
    const response = await api.get(`/lab/requests/${id}`);
    return response.data;
  },

  createRequest: async (data: LabRequestCreatePayload) => {
    const response = await api.post('/lab/requests', data);
    return response.data;
  },

  updateRequestStatus: async (id: string, status: LabRequestStatus) => {
    const response = await api.patch(`/lab/requests/${id}/status`, { status });
    return response.data;
  },

  updateItemResult: async (itemId: string, data: ResultEntryPayload) => {
    const response = await api.patch(`/lab/requests/items/${itemId}/result`, data);
    return response.data;
  },

  getPendingRequests: async () => {
    const response = await api.get('/lab/requests/pending');
    return response.data;
  },

  getReport: async (id: string) => {
    const response = await api.get(`/lab/requests/${id}`);
    return response.data;
  },
};
