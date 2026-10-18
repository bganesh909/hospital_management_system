import api from '../config/api';

export interface HospitalSettings {
  id: string;
  hospital_name: string;
  tagline: string | null;
  registration_number: string | null;
  tax_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  currency: string;
  currency_symbol: string;
  tax_rate: number;
  invoice_footer: string | null;
  timezone: string;
  updated_at?: string | null;
}

export type HospitalSettingsUpdate = Partial<Omit<HospitalSettings, 'id' | 'updated_at'>>;

export const settingsService = {
  getSettings: async (): Promise<{ success: boolean; data: HospitalSettings }> => {
    const response = await api.get('/settings');
    return response.data;
  },

  updateSettings: async (data: HospitalSettingsUpdate): Promise<{ success: boolean; data: HospitalSettings }> => {
    const response = await api.put('/settings', data);
    return response.data;
  },
};
