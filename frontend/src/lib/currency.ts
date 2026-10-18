import { queryClient } from '../config/queryClient';
import type { HospitalSettings } from '../services/settingsService';

/** Currency symbol from hospital settings (loaded by the sidebar), defaulting to Rs. */
export function currencySymbol(): string {
  const cached = queryClient.getQueryData<{ data?: HospitalSettings }>(['settings']);
  return cached?.data?.currency_symbol || 'Rs.';
}
