import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BedDouble, Users, LogOut, Clock } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { StatCard } from '../../components/shared/StatCard';
import { Select } from '../../components/shared/FormField';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { useAdmissions, useDischargeAdmission } from '../../hooks/useIpd';
import type { Admission } from '../../services/ipdService';

export default function IpdListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dischargeTarget, setDischargeTarget] = useState<Admission | null>(null);

  const params: Record<string, any> = { page, limit: 20 };
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;
  if (sortKey) {
    params.sort_by = sortKey;
    params.sort_order = sortDir;
  }

  const { data: response, isLoading } = useAdmissions(params);
  const admissions: Admission[] = response?.data || [];
  const meta = response?.meta;

  const discharge = useDischargeAdmission();

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const admitted = admissions.filter(a => a.status === 'admitted').length;
  const discharged = admissions.filter(a => a.status === 'discharged').length;

  const columns = [
    {
      key: 'admission_number',
      label: 'Admission #',
      sortable: true,
      render: (item: Admission) => (
        <span className="font-medium text-blue-600">{item.admission_number}</span>
      ),
    },
    {
      key: 'patient_name',
      label: 'Patient',
      sortable: true,
      render: (item: Admission) => (
        <div>
          <p className="font-medium text-gray-900">{item.patient_name || '—'}</p>
          {item.patient_number && <p className="text-xs text-gray-500">{item.patient_number}</p>}
        </div>
      ),
    },
    {
      key: 'doctor_name',
      label: 'Doctor',
      sortable: true,
      render: (item: Admission) => item.doctor_name || '—',
    },
    {
      key: 'bed_number',
      label: 'Bed',
      render: (item: Admission) =>
        item.bed_number ? (
          <div>
            <p className="text-sm font-medium">{item.ward_name}</p>
            <p className="text-xs text-gray-500">Bed {item.bed_number}</p>
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'admission_date',
      label: 'Admitted On',
      sortable: true,
      render: (item: Admission) => (
        <span className="text-gray-600">
          {new Date(item.admission_date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (item: Admission) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      label: '',
      render: (item: Admission) =>
        item.status === 'admitted' ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDischargeTarget(item);
            }}
            className="px-3 py-1 text-xs font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
          >
            Discharge
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="IPD Admissions"
        subtitle="Manage inpatient admissions and discharges"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/ipd/wards')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <BedDouble size={16} />
              Ward Overview
            </button>
            <button
              onClick={() => navigate('/ipd/admit')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              New Admission
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Admissions"
          value={meta?.total || 0}
          icon={BedDouble}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Currently Admitted"
          value={admitted}
          icon={Users}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
        />
        <StatCard
          title="Discharged"
          value={discharged}
          icon={LogOut}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
        <StatCard
          title="Avg Stay (days)"
          value="--"
          icon={Clock}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <SearchInput
            value={search}
            onChange={handleSearch}
            placeholder="Search by patient, doctor, or admission number..."
            className="flex-1"
          />
          <Select
            options={[
              { value: 'admitted', label: 'Admitted' },
              { value: 'discharged', label: 'Discharged' },
              { value: 'transferred', label: 'Transferred' },
              { value: 'deceased', label: 'Deceased' },
            ]}
            placeholder="All Statuses"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-44"
          />
        </div>

        <DataTable
          columns={columns}
          data={admissions}
          totalItems={meta?.total || 0}
          page={page}
          limit={20}
          onPageChange={setPage}
          onSort={(key, dir) => {
            setSortKey(key);
            setSortDir(dir);
          }}
          loading={isLoading}
          onRowClick={(item: Admission) => navigate(`/ipd/admissions/${item.id}`)}
          emptyMessage="No admissions found"
        />
      </div>

      <ConfirmDialog
        open={!!dischargeTarget}
        title="Discharge Patient"
        message={`Are you sure you want to discharge ${dischargeTarget?.patient_name}? This will free up their assigned bed.`}
        confirmLabel="Discharge"
        variant="warning"
        onConfirm={() => {
          if (dischargeTarget) {
            discharge.mutate({ id: dischargeTarget.id });
            setDischargeTarget(null);
          }
        }}
        onCancel={() => setDischargeTarget(null)}
        loading={discharge.isPending}
      />
    </div>
  );
}
