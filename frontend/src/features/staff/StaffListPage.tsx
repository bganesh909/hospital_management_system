import { SubNav, STAFF_NAV } from '../../components/shared/SubNav';
import { useState, useCallback } from 'react';
import { Plus, Edit, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchInput } from '../../components/shared/SearchInput';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select } from '../../components/shared/FormField';
import { UserPicker } from '../../components/shared/UserPicker';
import { UserFormModal } from '../users/UserFormModal';
import { useStaffList, useCreateStaff, useUpdateStaff } from '../../hooks/useStaff';
import { useDepartments } from '../../hooks/useDoctors';
import type {
  StaffMember,
  CreateStaffPayload,
  EmploymentType,
  StaffShift,
  StaffStatus,
} from '../../services/staffService';
import type { User, UserRole } from '../../types/auth.types';

// Doctors get their profile from the Doctors module, so staff accounts use the other roles
const STAFF_ROLES: UserRole[] = ['admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech'];

const employmentTypes = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' },
];

const shifts = [
  { value: 'day', label: 'Day' },
  { value: 'night', label: 'Night' },
  { value: 'rotating', label: 'Rotating' },
];

const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'resigned', label: 'Resigned' },
];

type StaffForm = Required<Omit<CreateStaffPayload, 'department_id' | 'salary'>> & {
  department_id: string;
  salary: number;
  status: StaffStatus;
};

const emptyForm: StaffForm = {
  user_id: '',
  department_id: '',
  designation: '',
  join_date: '',
  salary: 0,
  employment_type: 'full_time',
  shift: 'day',
  status: 'active',
};

export default function StaffListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [editingName, setEditingName] = useState('');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [pickedUser, setPickedUser] = useState<User | null>(null);

  const { data: deptData } = useDepartments();
  const departmentOptions = (deptData?.data ?? []).map((d: any) => ({ value: d.id, label: d.name }));
  const limit = 20;

  const params: Record<string, any> = { page, limit };
  if (search) params.search = search;
  if (sortKey) { params.sort_by = sortKey; params.sort_dir = sortDir; }

  const { data: response, isLoading } = useStaffList(params);
  const staffList: StaffMember[] = response?.data || [];
  const totalItems = response?.meta?.total || 0;

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setPickedUser(null);
    setModalOpen(true);
  };

  const openEdit = (staff: StaffMember) => {
    setEditingId(staff.id);
    setEditingName(staff.full_name ? `${staff.full_name}${staff.email ? ` (${staff.email})` : ''}` : staff.user_id);
    setForm({
      user_id: staff.user_id,
      department_id: staff.department_id ?? '',
      designation: staff.designation,
      join_date: staff.join_date,
      salary: staff.salary ?? 0,
      employment_type: staff.employment_type,
      shift: staff.shift,
      status: staff.status,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.user_id || !form.designation || !form.join_date) return;

    const common = {
      department_id: form.department_id || undefined,
      designation: form.designation,
      join_date: form.join_date,
      salary: form.salary || undefined,
      employment_type: form.employment_type,
      shift: form.shift,
    };

    if (editingId) {
      updateStaff.mutate({ id: editingId, data: { ...common, status: form.status } }, {
        onSuccess: () => setModalOpen(false),
      });
    } else {
      createStaff.mutate({ ...common, user_id: form.user_id }, {
        onSuccess: () => setModalOpen(false),
      });
    }
  };

  const isSaving = createStaff.isPending || updateStaff.isPending;

  const columns = [
    {
      key: 'employee_number',
      label: 'Employee #',
      sortable: true,
      render: (item: StaffMember) => (
        <span className="font-medium text-blue-600">{item.employee_number}</span>
      ),
    },
    {
      key: 'full_name',
      label: 'Name',
      sortable: true,
      render: (item: StaffMember) => (
        <div>
          <p className="font-medium text-gray-900">{item.full_name}</p>
          <p className="text-xs text-gray-500">{item.email}</p>
        </div>
      ),
    },
    { key: 'department_name', label: 'Department', render: (item: StaffMember) => <span>{item.department_name ?? '-'}</span> },
    { key: 'designation', label: 'Designation', sortable: true },
    {
      key: 'employment_type',
      label: 'Type',
      render: (item: StaffMember) => (
        <span className="capitalize text-sm">{item.employment_type?.replace(/_/g, ' ')}</span>
      ),
    },
    {
      key: 'shift',
      label: 'Shift',
      render: (item: StaffMember) => <span className="capitalize">{item.shift}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (item: StaffMember) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: StaffMember) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEdit(item); }}
          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
          title="Edit"
        >
          <Edit size={16} />
        </button>
      ),
    },
  ];

  return (
    <div>
      <SubNav items={STAFF_NAV} />
      <PageHeader
        title="Staff Directory"
        subtitle="Manage hospital staff members"
        actions={
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add Staff
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search staff..."
          className="w-72"
        />
      </div>

      {!isLoading && staffList.length === 0 && !search ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff members yet</h3>
          <p className="text-gray-500 mb-4">Add your first staff member to get started.</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add Staff
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={staffList}
          totalItems={totalItems}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
          loading={isLoading}
          emptyMessage="No staff found matching your search"
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Staff Member' : 'Add Staff Member'}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Add Staff'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="User Account" required>
            <UserPicker
              link="staff"
              roles={STAFF_ROLES}
              value={form.user_id}
              onChange={(userId) => setForm({ ...form, user_id: userId })}
              disabled={!!editingId}
              selectedLabel={editingName}
              selectedUser={pickedUser}
              onCreateNew={() => setCreateUserOpen(true)}
            />
          </FormField>
          <FormField label="Department">
            <Select
              options={departmentOptions}
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              placeholder="Select department"
            />
          </FormField>
          <FormField label="Designation" required>
            <Input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              placeholder="e.g. Senior Nurse"
            />
          </FormField>
          <FormField label="Join Date" required>
            <Input
              type="date"
              value={form.join_date}
              onChange={(e) => setForm({ ...form, join_date: e.target.value })}
            />
          </FormField>
          <FormField label="Salary">
            <Input
              type="number"
              min={0}
              value={form.salary}
              onChange={(e) => setForm({ ...form, salary: parseFloat(e.target.value) || 0 })}
              placeholder="Monthly salary"
            />
          </FormField>
          <FormField label="Employment Type" required>
            <Select
              options={employmentTypes}
              value={form.employment_type}
              onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
            />
          </FormField>
          <FormField label="Shift" required>
            <Select
              options={shifts}
              value={form.shift}
              onChange={(e) => setForm({ ...form, shift: e.target.value as StaffShift })}
            />
          </FormField>
          {editingId && (
            <FormField label="Status">
              <Select
                options={statuses}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as StaffStatus })}
              />
            </FormField>
          )}
        </div>
      </Modal>

      <UserFormModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        allowedRoles={STAFF_ROLES}
        defaultRole="nurse"
        onCreated={(user) => {
          setPickedUser(user);
          setForm((f) => ({ ...f, user_id: user.id }));
        }}
      />
    </div>
  );
}
