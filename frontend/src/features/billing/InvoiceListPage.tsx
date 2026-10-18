import { currencySymbol } from '../../lib/currency';
import { SubNav, BILLING_NAV } from '../../components/shared/SubNav';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Eye } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchInput } from '../../components/shared/SearchInput';
import { useInvoices } from '../../hooks/useBilling';
import type { Invoice } from '../../services/billingService';

const statusTabs = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'issued', label: 'Issued' },
  { key: 'partial', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const limit = 20;

  const params: Record<string, any> = { page, limit };
  if (activeTab !== 'all') params.status = activeTab;
  if (search) params.search = search;
  if (dateFrom) params.from = dateFrom;
  if (dateTo) params.to = dateTo;
  if (sortKey) {
    params.sort_by = sortKey;
    params.sort_dir = sortDir;
  }

  const { data: response, isLoading } = useInvoices(params);
  const invoices: Invoice[] = response?.data || [];
  const totalItems = response?.meta?.total || 0;

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const columns = [
    {
      key: 'invoice_number',
      label: 'Invoice #',
      sortable: true,
      render: (item: Invoice) => (
        <span className="font-medium text-blue-600">{item.invoice_number}</span>
      ),
    },
    {
      key: 'patient_name',
      label: 'Patient',
      sortable: true,
    },
    {
      key: 'total_amount',
      label: 'Total',
      sortable: true,
      render: (item: Invoice) => (
        <span className="font-semibold">{currencySymbol()} {item.total_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'paid_amount',
      label: 'Paid',
      render: (item: Invoice) => (
        <span className="text-green-600">{currencySymbol()} {item.paid_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'due_amount',
      label: 'Due',
      render: (item: Invoice) => (
        <span className={item.due_amount > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
          ${item.due_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: Invoice) => <StatusBadge status={item.status} />,
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (item: Invoice) => new Date(item.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Invoice) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/billing/${item.id}`);
          }}
          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
          title="View Details"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <SubNav items={BILLING_NAV} />
      <PageHeader
        title="Billing & Invoices"
        subtitle="Manage patient invoices and payments"
        actions={
          <button
            onClick={() => navigate('/billing/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            New Invoice
          </button>
        }
      />

      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search invoices..."
          className="w-72"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Clear dates
          </button>
        )}
      </div>

      {!isLoading && invoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Invoices</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{totalItems}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
            <p className="text-xl font-bold text-gray-900 mt-1">
              ${invoices.reduce((s, i) => s + (i.total_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Paid</p>
            <p className="text-xl font-bold text-green-600 mt-1">
              ${invoices.reduce((s, i) => s + (i.paid_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Due</p>
            <p className="text-xl font-bold text-red-600 mt-1">
              ${invoices.reduce((s, i) => s + (i.due_amount || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      {!isLoading && invoices.length === 0 && !search && activeTab === 'all' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 mb-4">Create your first invoice to start billing patients.</p>
          <button
            onClick={() => navigate('/billing/new')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Create Invoice
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          totalItems={totalItems}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          onRowClick={(item) => navigate(`/billing/${item.id}`)}
          loading={isLoading}
          emptyMessage="No invoices found matching your filters"
        />
      )}
    </div>
  );
}
