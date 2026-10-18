import api from '../config/api';

export interface DoctorUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string | null;
}

export interface Doctor {
  id: string;
  user_id: string;
  user?: DoctorUser | null;
  department_id: string | null;
  department?: { id: string; name: string } | null;
  specialization: string;
  qualification: string;
  license_number: string;
  experience_years: number | null;
  consultation_fee: number;
  bio?: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorFormData {
  user_id: string;
  department_id?: string;
  specialization: string;
  qualification: string;
  license_number: string;
  experience_years?: number;
  consultation_fee: number;
  bio?: string;
  is_available?: boolean;
}

// user_id and license_number can't be changed after creation
export type DoctorUpdateData = Partial<Omit<DoctorFormData, 'user_id' | 'license_number'>>;

export interface DoctorSchedule {
  id?: string;
  doctor_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients: number;
  is_active: boolean;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  head_id?: string | null;
  head_name?: string | null;
  doctor_count: number;
  staff_count: number;
  created_at: string;
  updated_at: string;
}

export interface DepartmentPayload {
  name: string;
  description?: string | null;
  head_id?: string | null;
}

export interface DoctorListParams {
  page?: number;
  limit?: number;
  search?: string;
  department_id?: string;
}

export const doctorService = {
  getAll: async (params: DoctorListParams = {}) => {
    const response = await api.get('/doctors', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/doctors/${id}`);
    return response.data;
  },

  create: async (data: DoctorFormData) => {
    const response = await api.post('/doctors', data);
    return response.data;
  },

  update: async (id: string, data: DoctorUpdateData) => {
    const response = await api.put(`/doctors/${id}`, data);
    return response.data;
  },

  getSchedule: async (id: string) => {
    const response = await api.get(`/doctors/${id}/schedule`);
    return response.data;
  },

  updateSchedule: async (id: string, schedule: DoctorSchedule[]) => {
    const response = await api.put(`/doctors/${id}/schedule`, schedule);
    return response.data;
  },

  getAvailable: async (departmentId?: string) => {
    const response = await api.get('/doctors/available', {
      params: departmentId ? { department_id: departmentId } : undefined,
    });
    return response.data;
  },
};

export const departmentService = {
  getAll: async (params?: { search?: string }) => {
    const response = await api.get('/departments', { params: { limit: 100, ...params } });
    return response.data;
  },

  create: async (data: DepartmentPayload) => {
    const response = await api.post('/departments', data);
    return response.data;
  },

  update: async (id: string, data: Partial<DepartmentPayload>) => {
    const response = await api.put(`/departments/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/departments/${id}`);
    return response.data;
  },
};
