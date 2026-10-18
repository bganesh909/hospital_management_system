import api from '../config/api';

export type OpdVisitStatus = 'in_progress' | 'completed' | 'referred';

export interface OpdVitals {
  vitals_bp?: string | null;
  vitals_temp?: number | null;
  vitals_pulse?: number | null;
  vitals_weight?: number | null;
  vitals_height?: number | null;
  vitals_spo2?: number | null;
}

export interface OpdVisit extends OpdVitals {
  id: string;
  visit_number: string;
  patient_id: string;
  patient_name: string | null;
  doctor_id: string;
  doctor_name: string | null;
  appointment_id?: string | null;
  visit_date: string;
  status: OpdVisitStatus;
  symptoms?: string | null;
  diagnosis?: string | null;
  treatment_plan?: string | null;
  follow_up_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpdVisitCreatePayload extends OpdVitals {
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  symptoms?: string;
  diagnosis?: string;
  treatment_plan?: string;
  follow_up_date?: string;
}

export type OpdVisitUpdatePayload = Omit<OpdVisitCreatePayload, 'patient_id' | 'doctor_id' | 'appointment_id'>;

export interface PrescriptionItem {
  id?: string;
  medicine_id?: string | null;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
  quantity: number;
  unit_price?: number | null;
}

export type PrescriptionStatus = 'active' | 'dispensed' | 'cancelled';

export interface Prescription {
  id: string;
  prescription_number: string;
  opd_visit_id: string | null;
  ipd_admission_id: string | null;
  patient_id: string;
  patient_name: string | null;
  doctor_id: string;
  doctor_name: string | null;
  items: PrescriptionItem[];
  notes?: string | null;
  status: PrescriptionStatus;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionCreatePayload {
  opd_visit_id?: string;
  ipd_admission_id?: string;
  patient_id: string;
  doctor_id: string;
  items: Omit<PrescriptionItem, 'id' | 'unit_price'>[];
  notes?: string;
}

export interface PrescriptionUpdatePayload {
  notes?: string;
  status?: PrescriptionStatus;
}

export const opdService = {
  // Visits
  getVisits: async (params?: Record<string, any>) => {
    const response = await api.get('/opd/visits', { params });
    return response.data;
  },

  getVisit: async (id: string) => {
    const response = await api.get(`/opd/visits/${id}`);
    return response.data;
  },

  createVisit: async (data: OpdVisitCreatePayload) => {
    const response = await api.post('/opd/visits', data);
    return response.data;
  },

  updateVisit: async (id: string, data: OpdVisitUpdatePayload) => {
    const response = await api.put(`/opd/visits/${id}`, data);
    return response.data;
  },

  completeVisit: async (id: string) => {
    const response = await api.patch(`/opd/visits/${id}/complete`);
    return response.data;
  },

  // Prescriptions
  getPrescriptions: async (params?: Record<string, any>) => {
    const response = await api.get('/opd/prescriptions', { params });
    return response.data;
  },

  getPrescription: async (id: string) => {
    const response = await api.get(`/opd/prescriptions/${id}`);
    return response.data;
  },

  createPrescription: async (data: PrescriptionCreatePayload) => {
    const response = await api.post('/opd/prescriptions', data);
    return response.data;
  },

  updatePrescription: async (id: string, data: PrescriptionUpdatePayload) => {
    const response = await api.put(`/opd/prescriptions/${id}`, data);
    return response.data;
  },
};
