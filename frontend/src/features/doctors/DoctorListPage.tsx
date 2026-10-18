import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Eye, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SearchInput } from '../../components/shared/SearchInput';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useDoctors, useDepartments } from '../../hooks/useDoctors';
import type { Doctor } from '../../services/doctorService';

export default function DoctorListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const { data, isLoading } = useDoctors({
    page,
    limit: 20,
    search: search || undefined,
    department_id: departmentFilter || undefined,
  });

  const { data: deptData } = useDepartments();
  const departments = deptData?.data ?? [];

  const doctors: Doctor[] = data?.data ?? [];
  const meta = data?.meta;

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (d: Doctor) => (
        <div>
          <p className="font-medium text-gray-900">
            Dr. {d.user?.full_name || '—'}
          </p>
          <p className="text-xs text-gray-500">{d.qualification}</p>
        </div>
      ),
    },
    {
      key: 'specialization',
      label: 'Specialization',
      sortable: true,
      render: (d: Doctor) => (
        <span className="text-gray-700">{d.specialization}</span>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      render: (d: Doctor) => (
        <span className="text-gray-700">{d.department?.name || '—'}</span>
      ),
    },
    {
      key: 'experience_years',
      label: 'Experience',
      sortable: true,
      render: (d: Doctor) => (
        <span className="text-gray-700">
          {d.experience_years != null ? `${d.experience_years} yrs` : '—'}
        </span>
      ),
    },
    {
      key: 'consultation_fee',
      label: 'Fee',
      sortable: true,
      render: (d: Doctor) => (
        <span className="font-medium text-gray-900">
          ${d.consultation_fee?.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'is_available',
      label: 'Availability',
      render: (d: Doctor) =>
        d.is_available ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle size={12} />
            Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
            <XCircle size={12} />
            Unavailable
          </span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-24',
      render: (d: Doctor) => (
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => navigate(`/doctors/${d.id}/edit`)}
            className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Doctor Directory"
        subtitle="Browse all doctors, specializations, and schedules"
        actions={
          <button
            onClick={() => navigate('/doctors/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Add Doctor
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search doctors by name or specialization..."
          className="max-w-md"
        />
        <select
          value={departmentFilter}
          onChange={(e) => {
            setDepartmentFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">All Departments</option>
          {departments.map((dept: any) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={doctors}
        totalItems={meta?.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        loading={isLoading}
        emptyMessage="No doctors found. Click 'Add Doctor' to register a new doctor."
      />
    </div>
  );
}
