import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsService } from '../services/settingsService';
import type { HospitalSettingsUpdate } from '../services/settingsService';
import { getErrorMessage } from '../lib/utils';

const SETTINGS_KEY = ['settings'];

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: settingsService.getSettings,
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: HospitalSettingsUpdate) => settingsService.updateSettings(data),
    onSuccess: (res) => {
      queryClient.setQueryData(SETTINGS_KEY, res);
      toast.success('Settings saved');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to save settings'));
    },
  });
}
