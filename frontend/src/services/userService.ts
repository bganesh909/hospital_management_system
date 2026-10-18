import api from '../config/api';
import type { User, UserRole } from '../types/auth.types';

export interface ManagedUser extends User {
  created_at: string;
  updated_at: string;
  linked_as: ('doctor' | 'staff')[];
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone?: string;
  is_active?: boolean;
}

export interface UpdateUserPayload {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role?: UserRole;
  is_active?: boolean;
}

export interface UnlinkedUserParams {
  link: 'doctor' | 'staff';
  role?: UserRole[];
  search?: string;
  limit?: number;
}

export interface UpdateProfilePayload {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
}

export const userService = {
  getUsers: async (params: UserListParams = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  getUnlinkedUsers: async ({ role, ...rest }: UnlinkedUserParams) => {
    // Repeat `role` per value (role=nurse&role=receptionist), which FastAPI parses as a list
    const params = new URLSearchParams();
    Object.entries(rest).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    role?.forEach((r) => params.append('role', r));
    const response = await api.get('/users/unlinked', { params });
    return response.data;
  },

  createUser: async (data: CreateUserPayload) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  updateUser: async (id: string, data: UpdateUserPayload) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  setUserStatus: async (id: string, is_active: boolean) => {
    const response = await api.patch(`/users/${id}/status`, { is_active });
    return response.data;
  },

  resetPassword: async (id: string, new_password: string) => {
    const response = await api.patch(`/users/${id}/password`, { new_password });
    return response.data;
  },

  updateProfile: async (data: UpdateProfilePayload): Promise<User> => {
    const response = await api.put<User>('/auth/me', data);
    return response.data;
  },
};
