import { currencySymbol } from '../../lib/currency';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Send, Printer, CreditCard, FileText, Pencil, Ban, Undo2 } from 'lucide-react';
import api from '../../config/api';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  useInvoice,
  useInvoicePayments,
  useIssueInvoice,
  useCreatePayment,
  useCancelInvoice,
  useRefundPayment,
  useInvoiceRefunds,
} from '../../hooks/useBilling';
import { useAuthStore } from '../../stores/authStore';
import type { Invoice, Payment, PaymentMethod, Refund } from '../../services/billingService';
import InvoiceEditModal from './InvoiceEditModal';
import { printInvoice, type HospitalInfo } from './InvoicePrint';

const rs = (value: number | null | undefined) =>
  `${currencySymbol()} ${(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'cheque', label: 'Cheque' },
];

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: invoiceResp, isLoading } = useInvoice(id || '');
  const { data: paymentsResp } = useInvoicePayments(id || '');
  const { data: refundsResp } = useInvoiceRefunds(id || '');
  // Hospital details for the printout; printing still works if settings are unavailable
  const { data: hospital } = useQuery<HospitalInfo | null>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data?.data ?? null,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const issueInvoice = useIssueInvoice();
  const createPayment = useCreatePayment();
  const cancelInvoice = useCancelInvoice();
  const refundPayment = useRefundPayment();
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const [refundAdjust, setRefundAdjust] = useState(false);

  const [paymentModal, setPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const invoice: Invoice | undefined = invoiceResp?.data;
  const payments: Payment[] = paymentsResp?.data || [];
  const refunds: Refund[] = refundsResp?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Invoice not found</h3>
        <button
          onClick={() => navigate('/billing')}
          className="mt-4 text-blue-600 hover:underline text-sm"
        >
          Back to invoices
        </button>
      </div>
    );
  }

  const handleRecordPayment = () => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;

    createPayment.mutate(
      {
        invoice_id: invoice.id,
        amount,
        method: payMethod,
        transaction_ref: payRef || undefined,
        notes: payNotes || undefined,
      },
      {
        onSuccess: () => {
          setPaymentModal(false);
          setPayAmount('');
          setPayMethod('cash');
          setPayRef('');
          setPayNotes('');
        },
      }
    );
  };

  const handleIssue = () => {
    issueInvoice.mutate(invoice.id);
  };

  const handlePrint = () => {
    printInvoice({ invoice, payments, refunds, hospital });
  };

  const canCancel = isAdmin && ['draft', 'issued', 'overdue'].includes(invoice.status) && invoice.paid_amount === 0;

  const handleCancel = () => {
    cancelInvoice.mutate(
      { id: invoice.id, reason: cancelReason.trim() || undefined },
      {
        onSuccess: () => {
          setCancelOpen(false);
          setCancelReason('');
        },
      }
    );
  };

  const refundable = (payment: Payment) => payment.amount - (payment.refunded_amount ?? 0);

  const openRefund = (payment: Payment) => {
    setRefundTarget(payment);
    setRefundAmount(String(refundable(payment)));
    setRefundReason('');
    setRefundMethod(payment.method);
    setRefundAdjust(false);
  };

  const refundValue = parseFloat(refundAmount);
  const refundInvalid =
    !refundTarget || !refundValue || refundValue <= 0 || refundValue > refundable(refundTarget) || !refundReason.trim();

  const handleRefund = () => {
    if (!refundTarget || refundInvalid) return;
    refundPayment.mutate(
      {
        paymentId: refundTarget.id,
        data: {
          amount: refundValue,
          reason: refundReason.trim(),
          method: refundMethod,
          adjust_invoice: refundAdjust,
        },
      },
      { onSuccess: () => setRefundTarget(null) }
    );
  };

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        subtitle={`Created on ${new Date(invoice.created_at).toLocaleDateString()}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/billing')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            {invoice.status === 'draft' && (
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                <Pencil size={16} />
                Edit
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setCancelOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 text-sm font-medium"
              >
                <Ban size={16} />
                Cancel Invoice
              </button>
            )}
            {invoice.status === 'draft' && (
              <button
                onClick={handleIssue}
                disabled={issueInvoice.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
              >
                <Send size={16} />
                {issueInvoice.isPending ? 'Issuing...' : 'Issue Invoice'}
              </button>
            )}
            {['issued', 'partial', 'overdue'].includes(invoice.status) && invoice.due_amount > 0 && (
              <button
                onClick={() => {
                  setPayAmount(String(invoice.due_amount));
                  setPaymentModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <CreditCard size={16} />
                Record Payment
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              <Printer size={16} />
              Print
            </button>
          </div>
        }
      />

      <div className="space-y-6 max-w-4xl">
        {/* Invoice Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h2>
                <StatusBadge status={invoice.status} />
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p><span className="font-medium text-gray-700">Patient:</span> {invoice.patient_name}</p>
                {invoice.ipd_admission_id && (
                  <p><span className="font-medium text-gray-700">Admission:</span> {invoice.ipd_admission_id}</p>
                )}
                <p><span className="font-medium text-gray-700">Created:</span> {new Date(invoice.created_at).toLocaleDateString()}</p>
                {invoice.due_date && (
                  <p><span className="font-medium text-gray-700">Due Date:</span> {new Date(invoice.due_date).toLocaleDateString()}</p>
                )}
                {invoice.notes && (
                  <p><span className="font-medium text-gray-700">Notes:</span> {invoice.notes}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Amount Due</p>
              <p className={`text-3xl font-bold ${invoice.due_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {rs(invoice.due_amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Line Items</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">#</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Type</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Description</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-600">Qty</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-600">Unit Price</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-gray-100">
                    <td className="px-6 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 capitalize">
                        {item.item_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-700">{item.description}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-6 py-3 text-right text-gray-700">{rs(item.unit_price)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">{rs(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Invoice Totals</h3>
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{rs(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax</span>
              <span className="font-medium">{rs(invoice.tax_amount)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="font-medium text-red-500">-{rs(invoice.discount_amount)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">{rs(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Paid</span>
              <span className="font-medium text-green-600">{rs(invoice.paid_amount)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="font-semibold text-gray-900">Due</span>
              <span className={`font-bold ${invoice.due_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {rs(invoice.due_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Payment History</h3>
          </div>
          {payments.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No payments recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Date</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Method</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Reference</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Notes</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Amount</th>
                    {isAdmin && <th className="px-6 py-3" />}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-100">
                      <td className="px-6 py-3 text-gray-700">{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td className="px-6 py-3">
                        <span className="capitalize">{payment.method?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">{payment.transaction_ref || '-'}</td>
                      <td className="px-6 py-3 text-gray-500">{payment.notes || '-'}</td>
                      <td className="px-6 py-3">
                        <StatusBadge status={payment.status} />
                        {payment.refunded_amount > 0 && payment.status !== 'refunded' && (
                          <p className="text-xs text-orange-600 mt-1">Refunded {rs(payment.refunded_amount)}</p>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-green-600">+{rs(payment.amount)}</td>
                      {isAdmin && (
                        <td className="px-6 py-3 text-right">
                          {payment.status === 'completed' && refundable(payment) > 0 && (
                            <button
                              onClick={() => openRefund(payment)}
                              className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-700"
                            >
                              <Undo2 size={14} />
                              Refund
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {refunds.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Refunds</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Date</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Refund #</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Payment</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Method</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Reason</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((refund) => (
                    <tr key={refund.id} className="border-b border-gray-100">
                      <td className="px-6 py-3 text-gray-700">{new Date(refund.refunded_at).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-gray-700">{refund.refund_number}</td>
                      <td className="px-6 py-3 text-gray-500">{refund.payment_number || '-'}</td>
                      <td className="px-6 py-3 capitalize">{refund.method.replace(/_/g, ' ')}</td>
                      <td className="px-6 py-3 text-gray-500">
                        {refund.reason}
                        {refund.adjusted_invoice && <span className="block text-xs text-gray-400">Invoice total reduced</span>}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-orange-600">-{rs(refund.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <InvoiceEditModal invoice={invoice} open={editOpen} onClose={() => setEditOpen(false)} />

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel ${invoice.invoice_number}?`}
        size="md"
        footer={
          <>
            <button
              onClick={() => setCancelOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Keep Invoice
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelInvoice.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {cancelInvoice.isPending ? 'Cancelling...' : 'Cancel Invoice'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            The invoice will be marked as cancelled and can no longer be paid. This cannot be undone.
          </p>
          <FormField label="Reason">
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why is this invoice being cancelled?"
            />
          </FormField>
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title={`Refund ${refundTarget?.payment_number ?? ''}`}
        size="md"
        footer={
          <>
            <button
              onClick={() => setRefundTarget(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleRefund}
              disabled={refundPayment.isPending || refundInvalid}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {refundPayment.isPending ? 'Refunding...' : 'Record Refund'}
            </button>
          </>
        }
      >
        {refundTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Payment amount</span>
                <span className="font-medium">{rs(refundTarget.amount)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Already refunded</span>
                <span className="font-medium">{rs(refundTarget.refunded_amount)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Refundable</span>
                <span className="font-medium text-orange-600">{rs(refundable(refundTarget))}</span>
              </div>
            </div>
            <FormField
              label="Refund Amount"
              required
              error={
                refundValue > refundable(refundTarget) ? 'Cannot refund more than the refundable amount' : undefined
              }
            >
              <Input
                type="number"
                min={0}
                max={refundable(refundTarget)}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </FormField>
            <FormField label="Refund Method" required>
              <Select
                options={paymentMethods}
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
              />
            </FormField>
            <FormField label="Reason" required>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Why is this payment being refunded?"
              />
            </FormField>
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={refundAdjust}
                onChange={(e) => setRefundAdjust(e.target.checked)}
                className="mt-0.5 rounded border-gray-300"
              />
              <span>
                Reduce the invoice total by this amount
                <span className="block text-xs text-gray-500">
                  Use when the service was not provided. Otherwise the refunded amount becomes due again.
                </span>
              </span>
            </label>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Record Payment"
        size="md"
        footer={
          <>
            <button
              onClick={() => setPaymentModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleRecordPayment}
              disabled={createPayment.isPending || !payAmount || parseFloat(payAmount) <= 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {createPayment.isPending ? 'Recording...' : 'Record Payment'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice Total</span>
              <span className="font-medium">{rs(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-500">Outstanding</span>
              <span className="font-medium text-red-600">{rs(invoice.due_amount)}</span>
            </div>
          </div>
          <FormField label="Amount" required>
            <Input
              type="number"
              min={0}
              max={invoice.due_amount}
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          <FormField label="Payment Method" required>
            <Select
              options={paymentMethods}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            />
          </FormField>
          <FormField label="Transaction Reference">
            <Input
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="Transaction ID or cheque number"
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
