import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Stethoscope, Clock, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { StatCard } from '../../components/shared/StatCard';
import { Select } from '../../components/shared/FormField';
import { useOpdVisits } from '../../hooks/useOpd';
import type { OpdVisit } from '../../services/opdService';

export default function OpdListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const params: Record<string, any> = { page, limit: 20 };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;
  if (dateFilter) params.date = dateFilter;
  if (sortKey) {
    params.sort_by = sortKey;
    params.sort_order = sortDir;
  }

  const { data: response, isLoading } = useOpdVisits(params);
  const visits: OpdVisit[] = response?.data || [];
  const meta = response?.meta;

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const totalVisits = meta?.total || 0;
  const inProgress = visits.filter(v => v.status === 'in_progress').length;
  const completed = visits.filter(v => v.status === 'completed').length;

  const columns = [
    {
      key: 'visit_number',
      label: 'Visit #',
      sortable: true,
      render: (item: OpdVisit) => (
        <span className="font-medium text-blue-600">{item.visit_number}</span>
      ),
    },
    {
      key: 'patient_name',
      label: 'Patient',
      render: (item: OpdVisit) => (
        <div>
          <p className="font-medium text-gray-900">{item.patient_name ?? '--'}</p>
        </div>
      ),
    },
    {
      key: 'doctor_name',
      label: 'Doctor',
      render: (item: OpdVisit) => (
        <span className="text-gray-700">{item.doctor_name ?? '--'}</span>
      ),
    },
    {
      key: 'visit_date',
      label: 'Date',
      sortable: true,
      render: (item: OpdVisit) => (
        <span className="text-gray-600">
          {new Date(item.visit_date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'diagnosis',
      label: 'Diagnosis',
      render: (item: OpdVisit) => (
        <span className="text-gray-600 max-w-[200px] truncate block">
          {item.diagnosis || '--'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item: OpdVisit) => <StatusBadge status={item.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPD Queue"
        subtitle="Manage outpatient visits and consultations"
        actions={
          <button
            onClick={() => navigate('/opd/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            New Visit
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Visits"
          value={totalVisits}
          icon={Stethoscope}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="In Progress"
          value={inProgress}
          icon={Clock}
          iconColor="text-yellow-600"
          iconBg="bg-yellow-100"
        />
        <StatCard
          title="Completed"
          value={completed}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title="Today's Queue"
          value={visits.length}
          icon={XCircle}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by patient, doctor, or visit number..."
            className="flex-1"
          />
          <div className="flex gap-3">
            <Select
              options={[
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'referred', label: 'Referred' },
              ]}
              placeholder="All Statuses"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-40"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={visits}
          totalItems={meta?.total || 0}
          page={page}
          limit={20}
          onPageChange={setPage}
          onSort={(key, dir) => {
            setSortKey(key);
            setSortDir(dir);
          }}
          onRowClick={(item) => navigate(`/opd/${item.id}`)}
          loading={isLoading}
          emptyMessage="No OPD visits found"
        />
      </div>
    </div>
  );
}
