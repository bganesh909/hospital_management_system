import { currencySymbol } from '../../lib/currency';
import { SubNav, STAFF_NAV } from '../../components/shared/SubNav';
import { useState } from 'react';
import { Wallet, Download, CheckCircle, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input } from '../../components/shared/FormField';
import {
  usePayroll,
  usePayrollSummary,
  useGeneratePayroll,
  useMarkPayrollPaid,
  useUpdatePayroll,
} from '../../hooks/useStaff';
import type { PayrollRecord, PayrollSummary } from '../../services/staffService';

const months = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const rs = (value: number | null | undefined) =>
  `${currencySymbol()} ${(value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayrollPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [page, setPage] = useState(1);
  const [confirmPay, setConfirmPay] = useState<PayrollRecord | null>(null);
  const [editing, setEditing] = useState<PayrollRecord | null>(null);
  const limit = 20;

  const { data: response, isLoading } = usePayroll({ month, year, page, limit });
  const records: PayrollRecord[] = response?.data || [];
  const totalItems = response?.meta?.total || 0;
  // Totals for the whole month, not just the current page
  const { data: summaryResp } = usePayrollSummary({ month, year });
  const summary: PayrollSummary | undefined = summaryResp?.data;

  const generatePayroll = useGeneratePayroll();
  const markPaid = useMarkPayrollPaid();

  const handleGenerate = () => {
    generatePayroll.mutate({ month, year });
  };

  const handleMarkPaid = () => {
    if (!confirmPay) return;
    markPaid.mutate(confirmPay.id, {
      onSuccess: () => setConfirmPay(null),
    });
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = now.getFullYear() - 2 + i;
    return { value: String(y), label: String(y) };
  });

  const columns = [
    {
      key: 'full_name',
      label: 'Employee',
      render: (item: PayrollRecord) => (
        <div>
          <p className="font-medium text-gray-900">{item.full_name}</p>
          <p className="text-xs text-gray-500">{item.employee_number}</p>
        </div>
      ),
    },
    {
      key: 'basic_salary',
      label: 'Basic Salary',
      render: (item: PayrollRecord) => <span>{rs(item.basic_salary)}</span>,
    },
    {
      key: 'allowances',
      label: 'Allowances',
      render: (item: PayrollRecord) => <span className="text-green-600">+{rs(item.allowances)}</span>,
    },
    {
      key: 'deductions',
      label: 'Deductions',
      render: (item: PayrollRecord) => <span className="text-red-500">-{rs(item.deductions)}</span>,
    },
    {
      key: 'net_salary',
      label: 'Net Salary',
      render: (item: PayrollRecord) => <span className="font-semibold text-gray-900">{rs(item.net_salary)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: PayrollRecord) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: PayrollRecord) => (
        <div className="flex items-center gap-2">
          {item.status === 'pending' && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(item); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Pencil size={12} />
              Edit
            </button>
          )}
          {item.status !== 'paid' && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmPay(item); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
            >
              <CheckCircle size={12} />
              Mark Paid
            </button>
          )}
          {item.status === 'paid' && item.paid_at && (
            <span className="text-xs text-gray-500">
              Paid on {new Date(item.paid_at).toLocaleDateString()}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <SubNav items={STAFF_NAV} />
      <PageHeader
        title="Payroll Management"
        subtitle="Generate and manage staff payroll"
        actions={
          <button
            onClick={handleGenerate}
            disabled={generatePayroll.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <Download size={16} />
            {generatePayroll.isPending ? 'Generating...' : 'Generate Payroll'}
          </button>
        }
      />

      {/* Month/Year Selector */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Month:</label>
          <select
            value={month}
            onChange={(e) => { setMonth(parseInt(e.target.value)); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Year:</label>
          <select
            value={year}
            onChange={(e) => { setYear(parseInt(e.target.value)); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payroll Summary Cards */}
      {summary && summary.total_records > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Basic</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{rs(summary.total_basic)}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.total_records} staff</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Allowances / Deductions</p>
            <p className="text-lg font-bold mt-1">
              <span className="text-green-600">+{rs(summary.total_allowances)}</span>
            </p>
            <p className="text-sm font-semibold text-red-500">-{rs(summary.total_deductions)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Net Payroll</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{rs(summary.total_net)}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Paid / Outstanding</p>
            <p className="text-lg font-bold text-green-600 mt-1">
              {rs(summary.paid_amount)} <span className="text-xs font-medium text-gray-500">({summary.paid_count})</span>
            </p>
            <p className="text-sm font-semibold text-yellow-600">
              {rs(summary.pending_amount)} <span className="text-xs font-medium text-gray-500">({summary.pending_count})</span>
            </p>
          </div>
        </div>
      )}

      {!isLoading && records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Wallet size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No payroll records</h3>
          <p className="text-gray-500 mb-4">
            No payroll has been generated for {months[month - 1].label} {year}.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generatePayroll.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            <Download size={16} />
            Generate Payroll
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={records}
          totalItems={totalItems}
          page={page}
          limit={limit}
          onPageChange={setPage}
          loading={isLoading}
          emptyMessage="No payroll records found"
        />
      )}

      <ConfirmDialog
        open={!!confirmPay}
        title="Mark as Paid"
        message={confirmPay ? `Mark payroll for ${confirmPay.full_name} (${rs(confirmPay.net_salary)}) as paid?` : ''}
        confirmLabel="Mark Paid"
        variant="info"
        onConfirm={handleMarkPaid}
        onCancel={() => setConfirmPay(null)}
        loading={markPaid.isPending}
      />

      <EditPayrollModal record={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function EditPayrollModal({ record, onClose }: { record: PayrollRecord | null; onClose: () => void }) {
  const updatePayroll = useUpdatePayroll();
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (record && loadedFor !== record.id) {
    setLoadedFor(record.id);
    setAllowances(String(record.allowances ?? 0));
    setDeductions(String(record.deductions ?? 0));
  }
  if (!record && loadedFor !== null) {
    setLoadedFor(null);
  }
  if (!record) return null;

  const a = parseFloat(allowances) || 0;
  const d = parseFloat(deductions) || 0;
  const net = record.basic_salary + a - d;
  const error = a < 0 || d < 0 ? 'Amounts cannot be negative' : net < 0 ? 'Deductions exceed salary plus allowances' : '';

  const handleSave = () => {
    if (error) return;
    updatePayroll.mutate({ id: record.id, data: { allowances: a, deductions: d } }, { onSuccess: onClose });
  };

  return (
    <Modal
      open={!!record}
      onClose={onClose}
      title={`Edit Payroll – ${record.full_name ?? ''}`}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!!error || updatePayroll.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {updatePayroll.isPending ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-3">
          <span className="text-gray-500">Basic Salary</span>
          <span className="font-medium">{rs(record.basic_salary)}</span>
        </div>
        <FormField label={`Allowances (${currencySymbol()})`}>
          <Input type="number" min={0} step="0.01" value={allowances} onChange={(e) => setAllowances(e.target.value)} />
        </FormField>
        <FormField label={`Deductions (${currencySymbol()})`} error={error || undefined}>
          <Input type="number" min={0} step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
        </FormField>
        <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
          <span className="font-semibold text-gray-900">Net Salary</span>
          <span className="font-bold text-gray-900">{rs(net)}</span>
        </div>
      </div>
    </Modal>
  );
}
