import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '../lib/utils';
import { billingService } from '../services/billingService';
import type {
  CreateInsuranceClaimPayload,
  CreateInvoicePayload,
  CreatePaymentPayload,
  CreateRefundPayload,
  UpdateInsuranceClaimPayload,
  UpdateInvoicePayload,
} from '../services/billingService';

export function useInvoices(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => billingService.getInvoices(params),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => billingService.getInvoice(id),
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoicePayload) => billingService.createInvoice(data),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(variables.issue ? 'Invoice issued successfully' : 'Invoice saved as draft');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to create invoice'));
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInvoicePayload }) =>
      billingService.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice updated successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update invoice'));
    },
  });
}

export function useIssueInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingService.issueInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice issued successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to issue invoice'));
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentPayload) => billingService.createPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Payment recorded successfully');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to record payment'));
    },
  });
}

export function useInvoicePayments(invoiceId: string) {
  return useQuery({
    queryKey: ['payments', invoiceId],
    queryFn: () => billingService.getInvoicePayments(invoiceId),
    enabled: !!invoiceId,
  });
}

export function useRevenue(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['revenue', params],
    queryFn: () => billingService.getRevenue(params),
  });
}

export function useInsuranceClaims(params?: Record<string, any>) {
  return useQuery({
    queryKey: ['insurance-claims', params],
    queryFn: () => billingService.getInsuranceClaims(params),
  });
}

export function useCancelInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      billingService.cancelInvoice(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice cancelled');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to cancel invoice'));
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: CreateRefundPayload }) =>
      billingService.refundPayment(paymentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      toast.success('Refund recorded');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to record refund'));
    },
  });
}

export function useInvoiceRefunds(invoiceId: string) {
  return useQuery({
    queryKey: ['refunds', invoiceId],
    queryFn: () => billingService.getRefunds({ invoice_id: invoiceId, limit: 100 }),
    enabled: !!invoiceId,
  });
}

export function useCreateInsuranceClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInsuranceClaimPayload) => billingService.createInsuranceClaim(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      toast.success('Insurance claim submitted');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to submit claim'));
    },
  });
}

export function useUpdateInsuranceClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInsuranceClaimPayload }) =>
      billingService.updateInsuranceClaim(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-claims'] });
      // Settling a claim records an insurance payment on the invoice
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Claim updated');
    },
    onError: (error: any) => {
      toast.error(getErrorMessage(error, 'Failed to update claim'));
    },
  });
}
