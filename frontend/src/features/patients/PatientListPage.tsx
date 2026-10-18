import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Eye, Edit2, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SearchInput } from '../../components/shared/SearchInput';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { usePatients, useDeletePatient } from '../../hooks/usePatients';
import type { Patient } from '../../services/patientService';

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function PatientListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);

  const { data, isLoading } = usePatients({
    page,
    limit: 20,
    search: search || undefined,
  });

  const deleteMutation = useDeletePatient();

  const patients: Patient[] = data?.data ?? [];
  const meta = data?.meta;

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const columns = [
    {
      key: 'patient_number',
      label: 'Patient #',
      sortable: true,
      render: (p: Patient) => (
        <span className="font-medium text-blue-600">{p.patient_number}</span>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (p: Patient) => (
        <div>
          <p className="font-medium text-gray-900">
            {p.first_name} {p.last_name}
          </p>
          {p.email && (
            <p className="text-xs text-gray-500">{p.email}</p>
          )}
        </div>
      ),
    },
    {
      key: 'age',
      label: 'Age',
      render: (p: Patient) =>
        p.date_of_birth ? `${calculateAge(p.date_of_birth)} yrs` : '—',
    },
    {
      key: 'gender',
      label: 'Gender',
      render: (p: Patient) => (
        <span className="capitalize">{p.gender}</span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (p: Patient) => p.phone || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (p: Patient) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-32',
      render: (p: Patient) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/patients/${p.id}`)}
            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600"
            title="View"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => navigate(`/patients/${p.id}/edit`)}
            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => setDeleteTarget(p)}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Patient Directory"
        subtitle="View and manage all patient records"
        actions={
          <button
            onClick={() => navigate('/patients/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Patient
          </button>
        }
      />

      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search patients by name, phone, or patient number..."
          className="max-w-md"
        />
      </div>

      <DataTable
        columns={columns}
        data={patients}
        totalItems={meta?.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        onRowClick={(p) => navigate(`/patients/${p.id}`)}
        loading={isLoading}
        emptyMessage="No patients found. Click 'Add Patient' to register a new patient."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Patient"
        message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
