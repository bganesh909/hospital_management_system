import api from '../config/api';
import type { DoctorUser } from './doctorService';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AppointmentType = 'consultation' | 'follow_up' | 'emergency';

export interface Appointment {
  id: string;
  appointment_number: string;
  patient_id: string;
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    patient_number: string;
    phone: string;
  } | null;
  doctor_id: string;
  doctor?: {
    id: string;
    specialization: string;
    user?: DoctorUser | null;
  } | null;
  appointment_date: string;
  start_time: string;
  end_time?: string | null;
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string | null;
  notes?: string | null;
  cancelled_reason?: string | null;
  booked_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentFormData {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  type: AppointmentType;
  reason?: string;
  notes?: string;
}

export interface AppointmentListParams {
  page?: number;
  limit?: number;
  appointment_date?: string;
  status?: string;
  doctor_id?: string;
  patient_id?: string;
  search?: string;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
}

export const appointmentService = {
  getAll: async (params: AppointmentListParams = {}) => {
    const response = await api.get('/appointments', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/appointments/${id}`);
    return response.data;
  },

  create: async (data: AppointmentFormData) => {
    const response = await api.post('/appointments', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Omit<AppointmentFormData, 'patient_id'>>) => {
    const response = await api.put(`/appointments/${id}`, data);
    return response.data;
  },

  cancel: async (id: string, reason: string) => {
    const response = await api.patch(`/appointments/${id}/cancel`, {
      cancelled_reason: reason,
    });
    return response.data;
  },

  updateStatus: async (id: string, status: AppointmentStatus) => {
    const response = await api.patch(`/appointments/${id}/status`, {
      status,
    });
    return response.data;
  },

  getSlots: async (doctorId: string, date: string) => {
    const response = await api.get('/appointments/slots', {
      params: { doctor_id: doctorId, appointment_date: date },
    });
    return response.data;
  },

  getToday: async () => {
    const response = await api.get('/appointments/today');
    return response.data;
  },
};
