import api from '../config/api';
import type { ApiResponse, PaginatedResponse } from '../types/common.types';

export interface Notification {
  id: string;
  user_id: string;
  /** Free-form on the backend; known values: appointment, lab_result, billing, system */
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  sent_via: 'in_app' | 'email' | 'both';
  email_sent: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  id: string;
  user_id: string;
  appointment_email: boolean;
  lab_result_email: boolean;
  billing_email: boolean;
  system_email: boolean;
  created_at: string;
  updated_at: string;
}

export type NotificationPreferencesUpdate = Partial<
  Pick<NotificationPreferences, 'appointment_email' | 'lab_result_email' | 'billing_email' | 'system_email'>
>;

export interface NotificationListParams {
  page?: number;
  limit?: number;
  is_read?: boolean;
}

export const notificationService = {
  getNotifications: async (params?: NotificationListParams): Promise<PaginatedResponse<Notification>> => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  getUnreadCount: async (): Promise<ApiResponse<{ unread_count: number }>> => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: string): Promise<ApiResponse<Notification>> => {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.patch('/notifications/read-all');
    return response.data;
  },

  getPreferences: async (): Promise<ApiResponse<NotificationPreferences>> => {
    const response = await api.get('/notifications/preferences');
    return response.data;
  },

  updatePreferences: async (data: NotificationPreferencesUpdate): Promise<ApiResponse<NotificationPreferences>> => {
    const response = await api.put('/notifications/preferences', data);
    return response.data;
  },
};
