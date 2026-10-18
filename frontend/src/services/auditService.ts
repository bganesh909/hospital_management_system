import api from '../config/api';
import type { PaginatedResponse } from '../types/common.types';

export type AuditAction = 'create' | 'update' | 'delete';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  entity_type?: string;
  entity_id?: string;
  action?: AuditAction;
  user_id?: string;
  date_from?: string;
  date_to?: string;
}

export const auditService = {
  getAuditLogs: async (params: AuditLogParams = {}): Promise<PaginatedResponse<AuditLog>> => {
    // Drop empty filters so the backend doesn't receive blank strings
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    const response = await api.get('/audit-logs', { params: clean });
    return response.data;
  },

  getEntityTypes: async (): Promise<{ success: boolean; data: string[] }> => {
    const response = await api.get('/audit-logs/entity-types');
    return response.data;
  },
};
