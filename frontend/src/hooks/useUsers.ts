import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { userService } from '../services/userService';
import type {
  CreateUserPayload,
  UnlinkedUserParams,
  UpdateProfilePayload,
  UpdateUserPayload,
  UserListParams,
} from '../services/userService';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import type { ChangePasswordRequest } from '../types/auth.types';
import { getErrorMessage } from '../lib/utils';

const USERS_KEY = 'users';

export function useUsers(params: UserListParams = {}) {
  return useQuery({
    queryKey: [USERS_KEY, params],
    queryFn: () => userService.getUsers(params),
  });
}

export function useUnlinkedUsers(params: UnlinkedUserParams, enabled = true) {
  return useQuery({
    queryKey: [USERS_KEY, 'unlinked', params],
    queryFn: () => userService.getUnlinkedUsers(params),
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserPayload) => userService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success('User created successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create user'));
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserPayload }) =>
      userService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success('User updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update user'));
    },
  });
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      userService.setUserStatus(id, is_active),
    onSuccess: (_data, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      toast.success(is_active ? 'User activated' : 'User deactivated');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to change user status'));
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password: string }) =>
      userService.resetPassword(id, new_password),
    onSuccess: () => {
      toast.success('Password reset. The user must log in again.');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to reset password'));
    },
  });
}

export function useUpdateProfile() {
  const { setUser } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfilePayload) => userService.updateProfile(data),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(['auth', 'me'], user);
      toast.success('Profile updated');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update profile'));
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authService.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to change password'));
    },
  });
}
