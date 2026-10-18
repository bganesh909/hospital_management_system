import api from '../config/api';

export interface Patient {
  id: string;
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
  blood_group?: string;
  phone: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  allergies?: string;
  status: 'active' | 'discharged' | 'deceased';
  registered_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientFormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  blood_group?: string;
  phone: string;
  email?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  allergies?: string;
}

export interface PatientListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export const patientService = {
  getAll: async (params: PatientListParams = {}) => {
    const response = await api.get('/patients', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/patients/${id}`);
    return response.data;
  },

  create: async (data: PatientFormData) => {
    const response = await api.post('/patients', data);
    return response.data;
  },

  update: async (id: string, data: PatientFormData) => {
    const response = await api.put(`/patients/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/patients/${id}`);
    return response.data;
  },

  getHistory: async (id: string) => {
    const response = await api.get(`/patients/${id}/history`);
    return response.data;
  },

  search: async (query: string) => {
    const response = await api.get('/patients/search', {
      params: { q: query },
    });
    return response.data;
  },
};
