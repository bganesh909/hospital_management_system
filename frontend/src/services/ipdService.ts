import api from '../config/api';

export type WardType = 'general' | 'semi_private' | 'private' | 'icu' | 'nicu' | 'emergency';
export type BedStatus = 'available' | 'occupied' | 'maintenance' | 'reserved';

export interface Ward {
  id: string;
  name: string;
  type: WardType;
  floor?: number | null;
  total_beds: number;
  charge_per_day: number;
  occupied_beds: number;
  available_beds: number;
  maintenance_beds: number;
  reserved_beds: number;
  created_at: string;
  updated_at: string;
}

export interface WardPayload {
  name: string;
  type: WardType;
  floor?: number | null;
  charge_per_day: number;
}

export interface WardCreatePayload extends WardPayload {
  // Beds created with the ward, numbered bed_prefix + 1..total_beds
  total_beds?: number;
  bed_prefix?: string;
}

export type ManualBedStatus = Exclude<BedStatus, 'occupied'>;

export interface Bed {
  id: string;
  ward_id: string;
  bed_number: string;
  is_occupied: boolean;
  status: BedStatus;
  created_at: string;
  ward_name?: string | null;
  ward_type?: WardType | null;
  charge_per_day?: number | null;
  admission_id?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
}

export interface BedCreatePayload {
  ward_id: string;
  bed_number: string;
  status?: ManualBedStatus;
}

export interface BedBulkCreatePayload {
  ward_id: string;
  prefix?: string;
  start?: number;
  count: number;
}

export interface Admission {
  id: string;
  admission_number: string;
  patient_id: string;
  patient_name?: string | null;
  patient_number?: string | null;
  doctor_id: string;
  doctor_name?: string | null;
  ward_id?: string | null;
  ward_name?: string | null;
  bed_id?: string | null;
  bed_number?: string | null;
  admission_date: string;
  discharge_date?: string | null;
  reason: string;
  diagnosis?: string | null;
  discharge_summary?: string | null;
  status: 'admitted' | 'discharged' | 'transferred' | 'deceased';
  admitted_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionCreatePayload {
  patient_id: string;
  doctor_id: string;
  bed_id?: string;
  reason: string;
  diagnosis?: string;
}

export interface AdmissionUpdatePayload {
  doctor_id?: string;
  bed_id?: string;
  diagnosis?: string;
}

export interface DailyRound {
  id: string;
  admission_id: string;
  doctor_id: string;
  doctor_name?: string | null;
  round_date: string;
  notes?: string | null;
  vitals_bp?: string | null;
  vitals_temp?: number | null;
  vitals_pulse?: number | null;
  vitals_spo2?: number | null;
  instructions?: string | null;
  created_at: string;
}

export interface DailyRoundCreatePayload {
  doctor_id: string;
  notes?: string;
  vitals_bp?: string;
  vitals_temp?: number;
  vitals_pulse?: number;
  vitals_spo2?: number;
  instructions?: string;
}

export const ipdService = {
  // Admissions
  getAdmissions: async (params?: Record<string, any>) => {
    const response = await api.get('/ipd/admissions', { params });
    return response.data;
  },

  getAdmission: async (id: string) => {
    const response = await api.get(`/ipd/admissions/${id}`);
    return response.data;
  },

  createAdmission: async (data: AdmissionCreatePayload) => {
    const response = await api.post('/ipd/admissions', data);
    return response.data;
  },

  updateAdmission: async (id: string, data: AdmissionUpdatePayload) => {
    const response = await api.put(`/ipd/admissions/${id}`, data);
    return response.data;
  },

  dischargeAdmission: async (id: string, data: { discharge_summary?: string } = {}) => {
    const response = await api.patch(`/ipd/admissions/${id}/discharge`, data);
    return response.data;
  },

  transferBed: async (id: string, bedId: string) => {
    const response = await api.patch(`/ipd/admissions/${id}/transfer`, { bed_id: bedId });
    return response.data;
  },

  // Daily Rounds
  getRounds: async (admissionId: string) => {
    const response = await api.get(`/ipd/rounds/${admissionId}`);
    return response.data;
  },

  createRound: async (admissionId: string, data: DailyRoundCreatePayload) => {
    const response = await api.post('/ipd/rounds', { ...data, admission_id: admissionId });
    return response.data;
  },

  // Wards
  getWards: async (params?: Record<string, any>) => {
    const response = await api.get('/ipd/wards', { params });
    return response.data;
  },

  createWard: async (data: WardCreatePayload) => {
    const response = await api.post('/ipd/wards', data);
    return response.data;
  },

  updateWard: async (id: string, data: Partial<WardPayload>) => {
    const response = await api.put(`/ipd/wards/${id}`, data);
    return response.data;
  },

  deleteWard: async (id: string) => {
    const response = await api.delete(`/ipd/wards/${id}`);
    return response.data;
  },

  getWardBeds: async (wardId: string) => {
    const response = await api.get('/ipd/beds', { params: { ward_id: wardId, limit: 500 } });
    return response.data;
  },

  // Beds
  createBed: async (data: BedCreatePayload) => {
    const response = await api.post('/ipd/beds', data);
    return response.data;
  },

  createBedsBulk: async (data: BedBulkCreatePayload) => {
    const response = await api.post('/ipd/beds/bulk', data);
    return response.data;
  },

  updateBedStatus: async (id: string, status: ManualBedStatus) => {
    const response = await api.patch(`/ipd/beds/${id}`, { status });
    return response.data;
  },

  updateBedNumber: async (id: string, bedNumber: string) => {
    const response = await api.patch(`/ipd/beds/${id}`, { bed_number: bedNumber });
    return response.data;
  },

  deleteBed: async (id: string) => {
    const response = await api.delete(`/ipd/beds/${id}`);
    return response.data;
  },

  getAvailableBeds: async (params?: Record<string, any>) => {
    const response = await api.get('/ipd/beds', {
      params: { limit: 100, ...params, status: 'available' },
    });
    return response.data;
  },
};
