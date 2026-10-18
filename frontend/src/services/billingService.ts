import api from '../config/api';

export type InvoiceItemType = 'consultation' | 'lab_test' | 'medicine' | 'bed_charge' | 'procedure' | 'other';
export type InvoiceStatus = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'insurance' | 'cheque';

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_type: InvoiceItemType | string;
  item_reference_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  patient_id: string;
  patient_name?: string | null;
  ipd_admission_id?: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  status: InvoiceStatus;
  due_date?: string | null;
  notes?: string | null;
  generated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceItemPayload {
  item_type: InvoiceItemType;
  item_reference_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreateInvoicePayload {
  patient_id: string;
  ipd_admission_id?: string;
  items: CreateInvoiceItemPayload[];
  tax_amount: number;
  discount_amount: number;
  due_date?: string;
  notes?: string;
  issue?: boolean;
}

/** Draft invoices only; `items` replaces all line items and totals are recomputed server-side. */
export interface UpdateInvoicePayload {
  items?: CreateInvoiceItemPayload[];
  tax_amount?: number;
  discount_amount?: number;
  due_date?: string | null;
  notes?: string | null;
}

export interface Payment {
  id: string;
  payment_number: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  transaction_ref?: string | null;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  refunded_amount: number;
  received_by?: string | null;
  payment_date: string;
  notes?: string | null;
  created_at: string;
}

export interface CreatePaymentPayload {
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  transaction_ref?: string;
  notes?: string;
}

export interface Refund {
  id: string;
  refund_number: string;
  payment_id: string;
  payment_number?: string | null;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  reason: string;
  adjusted_invoice: boolean;
  refunded_by?: string | null;
  refunded_at: string;
  created_at: string;
}

export interface CreateRefundPayload {
  amount: number;
  reason: string;
  method?: PaymentMethod;
  adjust_invoice?: boolean;
}

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'settled';

export interface InsuranceClaim {
  id: string;
  claim_number: string;
  patient_id: string;
  patient_name?: string | null;
  invoice_id: string;
  invoice_number?: string | null;
  insurance_provider: string;
  policy_number: string;
  claimed_amount: number;
  approved_amount?: number | null;
  status: ClaimStatus;
  submitted_at: string;
  settled_at?: string | null;
  remarks?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateInsuranceClaimPayload {
  invoice_id: string;
  patient_id?: string;
  insurance_provider: string;
  policy_number: string;
  claimed_amount: number;
}

export interface UpdateInsuranceClaimPayload {
  status?: InsuranceClaim['status'];
  approved_amount?: number;
  remarks?: string | null;
}

export interface RevenueStats {
  total_revenue: number;
  total_paid: number;
  total_pending: number;
  total_invoices: number;
}

export const billingService = {
  getInvoices: async (params?: Record<string, any>) => {
    const response = await api.get('/billing/invoices', { params });
    return response.data;
  },

  getInvoice: async (id: string) => {
    const response = await api.get(`/billing/invoices/${id}`);
    return response.data;
  },

  createInvoice: async (data: CreateInvoicePayload) => {
    const response = await api.post('/billing/invoices', data);
    return response.data;
  },

  updateInvoice: async (id: string, data: UpdateInvoicePayload) => {
    const response = await api.put(`/billing/invoices/${id}`, data);
    return response.data;
  },

  issueInvoice: async (id: string) => {
    const response = await api.patch(`/billing/invoices/${id}/issue`);
    return response.data;
  },

  cancelInvoice: async (id: string, reason?: string) => {
    const response = await api.patch(`/billing/invoices/${id}/cancel`, { reason });
    return response.data;
  },

  getPayments: async (params?: Record<string, any>) => {
    const response = await api.get('/billing/payments', { params });
    return response.data;
  },

  getInvoicePayments: async (invoiceId: string) => {
    const response = await api.get('/billing/payments', {
      params: { invoice_id: invoiceId },
    });
    return response.data;
  },

  createPayment: async (data: CreatePaymentPayload) => {
    const response = await api.post('/billing/payments', data);
    return response.data;
  },

  refundPayment: async (paymentId: string, data: CreateRefundPayload) => {
    const response = await api.post(`/billing/payments/${paymentId}/refund`, data);
    return response.data;
  },

  getRefunds: async (params?: { invoice_id?: string; payment_id?: string; page?: number; limit?: number }) => {
    const response = await api.get('/billing/refunds', { params });
    return response.data;
  },

  getInsuranceClaims: async (params?: Record<string, any>) => {
    const response = await api.get('/billing/insurance-claims', { params });
    return response.data;
  },

  createInsuranceClaim: async (data: CreateInsuranceClaimPayload) => {
    const response = await api.post('/billing/insurance-claims', data);
    return response.data;
  },

  updateInsuranceClaim: async (id: string, data: UpdateInsuranceClaimPayload) => {
    const response = await api.patch(`/billing/insurance-claims/${id}`, data);
    return response.data;
  },

  getRevenue: async (params?: { from?: string; to?: string }) => {
    const response = await api.get('/billing/revenue', { params });
    return response.data;
  },
};
