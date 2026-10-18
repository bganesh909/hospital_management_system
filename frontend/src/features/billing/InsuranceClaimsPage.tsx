import { currencySymbol } from '../../lib/currency';
import { SubNav, BILLING_NAV } from '../../components/shared/SubNav';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import {
  useInsuranceClaims,
  useCreateInsuranceClaim,
  useUpdateInsuranceClaim,
  useInvoices,
} from '../../hooks/useBilling';
import { useAuthStore } from '../../stores/authStore';
import type { ClaimStatus, InsuranceClaim, Invoice } from '../../services/billingService';

const rs = (value: number | null | undefined) =>
  value == null ? '-' : `${currencySymbol()} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const statusTabs: { value: '' | ClaimStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'settled', label: 'Settled' },
  { value: 'rejected', label: 'Rejected' },
];

// Mirrors CLAIM_TRANSITIONS in billing_service.py
const nextStatuses: Record<ClaimStatus, ClaimStatus[]> = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['settled'],
  rejected: [],
  settled: [],
};

const statusLabel = (status: string) => status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function InsuranceClaimsPage() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((state) => state.user?.role === 'admin');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | ClaimStatus>('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<InsuranceClaim | null>(null);

  const { data, isLoading } = useInsuranceClaims({
    page,
    limit: 20,
    status: status || undefined,
    search: search || undefined,
  });
  const claims: InsuranceClaim[] = data?.data ?? [];

  const columns = [
    { key: 'claim_number', label: 'Claim #', render: (c: InsuranceClaim) => <span className="font-medium text-gray-900">{c.claim_number}</span> },
    { key: 'patient_name', label: 'Patient', render: (c: InsuranceClaim) => c.patient_name || '-' },
    {
      key: 'invoice_number',
      label: 'Invoice',
      render: (c: InsuranceClaim) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/billing/${c.invoice_id}`);
          }}
          className="text-blue-600 hover:underline"
        >
          {c.invoice_number || 'View'}
        </button>
      ),
    },
    {
      key: 'insurance_provider',
      label: 'Provider',
      render: (c: InsuranceClaim) => (
        <div>
          <p className="text-gray-900">{c.insurance_provider}</p>
          <p className="text-xs text-gray-500">Policy {c.policy_number}</p>
        </div>
      ),
    },
    { key: 'claimed_amount', label: 'Claimed', render: (c: InsuranceClaim) => rs(c.claimed_amount) },
    { key: 'approved_amount', label: 'Approved', render: (c: InsuranceClaim) => rs(c.approved_amount) },
    { key: 'status', label: 'Status', render: (c: InsuranceClaim) => <StatusBadge status={c.status} /> },
    { key: 'submitted_at', label: 'Submitted', render: (c: InsuranceClaim) => new Date(c.submitted_at).toLocaleDateString() },
  ];

  return (
    <div>
      <SubNav items={BILLING_NAV} />
      <PageHeader
        title="Insurance Claims"
        subtitle="Submit claims against invoices and track them to settlement"
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            New Claim
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                status === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search claim, provider, policy or patient..."
          className="w-full lg:w-80"
        />
      </div>

      <DataTable
        columns={columns}
        data={claims}
        totalItems={data?.meta?.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        onRowClick={isAdmin ? (claim) => setSelected(claim) : undefined}
        loading={isLoading}
        emptyMessage="No insurance claims found"
      />
      {isAdmin && claims.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">Click a claim to review, approve, reject or settle it.</p>
      )}

      <CreateClaimModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <UpdateClaimModal claim={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function CreateClaimModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createClaim = useCreateInsuranceClaim();
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [provider, setProvider] = useState('');
  const [policy, setPolicy] = useState('');
  const [amount, setAmount] = useState('');

  const { data: invoiceResults, isFetching } = useInvoices({
    search: invoiceSearch || undefined,
    limit: 8,
  });
  const candidates: Invoice[] = (invoiceResults?.data ?? []).filter(
    (inv: Invoice) => !['draft', 'cancelled'].includes(inv.status)
  );

  const reset = () => {
    setInvoiceSearch('');
    setInvoice(null);
    setProvider('');
    setPolicy('');
    setAmount('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const claimed = parseFloat(amount);
  const amountError =
    invoice && claimed > invoice.total_amount ? 'Claimed amount cannot exceed the invoice total' : undefined;
  const invalid = !invoice || !provider.trim() || !policy.trim() || !claimed || claimed <= 0 || !!amountError;

  const handleSubmit = () => {
    if (invalid || !invoice) return;
    createClaim.mutate(
      {
        invoice_id: invoice.id,
        insurance_provider: provider.trim(),
        policy_number: policy.trim(),
        claimed_amount: claimed,
      },
      { onSuccess: close }
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New Insurance Claim"
      size="lg"
      footer={
        <>
          <button onClick={close} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={invalid || createClaim.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createClaim.isPending ? 'Submitting...' : 'Submit Claim'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {invoice ? (
          <div className="flex items-start justify-between bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
            <div>
              <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
              <p className="text-gray-600">{invoice.patient_name}</p>
              <p className="text-gray-600">
                Total {rs(invoice.total_amount)} · Due {rs(invoice.due_amount)}
              </p>
            </div>
            <button onClick={() => setInvoice(null)} className="text-blue-600 hover:underline text-xs font-medium">
              Change
            </button>
          </div>
        ) : (
          <FormField label="Invoice" required>
            <SearchInput
              value={invoiceSearch}
              onChange={setInvoiceSearch}
              placeholder="Search by invoice number or patient name..."
            />
            <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
              {isFetching && candidates.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">Searching...</p>
              ) : candidates.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">No issued invoices found</p>
              ) : (
                candidates.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => {
                      setInvoice(inv);
                      setAmount(String(inv.due_amount > 0 ? inv.due_amount : inv.total_amount));
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between gap-2"
                  >
                    <span>
                      <span className="font-medium text-gray-900">{inv.invoice_number}</span>
                      <span className="text-gray-500"> · {inv.patient_name}</span>
                    </span>
                    <span className="text-gray-600">{rs(inv.total_amount)}</span>
                  </button>
                ))
              )}
            </div>
          </FormField>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Insurance Provider" required>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Star Health" />
          </FormField>
          <FormField label="Policy Number" required>
            <Input value={policy} onChange={(e) => setPolicy(e.target.value)} />
          </FormField>
        </div>
        <FormField label={`Claimed Amount (${currencySymbol()})`} required error={amountError}>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  );
}

function UpdateClaimModal({ claim, onClose }: { claim: InsuranceClaim | null; onClose: () => void }) {
  const updateClaim = useUpdateInsuranceClaim();
  const [nextStatus, setNextStatus] = useState<ClaimStatus | ''>('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Initialise the form when a different claim is opened
  if (claim && loadedFor !== claim.id) {
    setLoadedFor(claim.id);
    setNextStatus('');
    setApprovedAmount(String(claim.approved_amount ?? claim.claimed_amount));
    setRemarks(claim.remarks ?? '');
  }
  if (!claim && loadedFor !== null) {
    setLoadedFor(null);
  }

  if (!claim) return null;

  const options = nextStatuses[claim.status] ?? [];
  const approved = parseFloat(approvedAmount);
  const needsAmount = nextStatus === 'approved';
  const amountError =
    needsAmount && (!approved || approved < 0)
      ? 'Approved amount is required'
      : needsAmount && approved > claim.claimed_amount
        ? 'Cannot exceed the claimed amount'
        : undefined;
  const remarksChanged = (remarks.trim() || null) !== (claim.remarks ?? null);
  const invalid = (!nextStatus && !remarksChanged) || !!amountError;

  const handleSave = () => {
    if (invalid) return;
    updateClaim.mutate(
      {
        id: claim.id,
        data: {
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(needsAmount ? { approved_amount: approved } : {}),
          ...(remarksChanged ? { remarks: remarks.trim() || null } : {}),
        },
      },
      { onSuccess: onClose }
    );
  };

  return (
    <Modal
      open={!!claim}
      onClose={onClose}
      title={`Claim ${claim.claim_number}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={invalid || updateClaim.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updateClaim.isPending ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Patient</span>
            <span className="font-medium">{claim.patient_name || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Provider</span>
            <span className="font-medium">{claim.insurance_provider}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Claimed</span>
            <span className="font-medium">{rs(claim.claimed_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Approved</span>
            <span className="font-medium">{rs(claim.approved_amount)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Status</span>
            <StatusBadge status={claim.status} />
          </div>
        </div>

        {options.length > 0 ? (
          <FormField label="Change status to">
            <Select
              placeholder="Keep current status"
              options={options.map((s) => ({ value: s, label: statusLabel(s) }))}
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as ClaimStatus | '')}
            />
          </FormField>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <ShieldCheck size={16} />
            This claim is {claim.status} and can no longer change status.
          </p>
        )}

        {needsAmount && (
          <FormField label={`Approved Amount (${currencySymbol()})`} required error={amountError}>
            <Input
              type="number"
              min={0}
              max={claim.claimed_amount}
              step="0.01"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
            />
          </FormField>
        )}
        {nextStatus === 'settled' && (
          <p className="text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
            Settling records an insurance payment of {rs(claim.approved_amount)} on the invoice (up to the amount still due).
          </p>
        )}

        <FormField label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Notes from the insurer..." />
        </FormField>
      </div>
    </Modal>
  );
}
