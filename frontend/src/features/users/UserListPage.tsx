import { useCallback, useState } from 'react';
import { Edit, KeyRound, Plus, Power, UserCog } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchInput } from '../../components/shared/SearchInput';
import { Modal } from '../../components/shared/Modal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { FormField, Input, Select } from '../../components/shared/FormField';
import { useResetPassword, useSetUserStatus, useUsers } from '../../hooks/useUsers';
import { useAuthStore } from '../../stores/authStore';
import type { ManagedUser, UserListParams } from '../../services/userService';
import type { UserRole } from '../../types/auth.types';
import { ROLE_OPTIONS, UserFormModal } from './UserFormModal';

const statusFilterOptions = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const roleLabel = (role: UserRole) => ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;

export default function UserListPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<ManagedUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const params: UserListParams = { page, limit };
  if (search) params.search = search;
  if (role) params.role = role as UserRole;
  if (active) params.is_active = active === 'true';

  const { data, isLoading } = useUsers(params);
  const users: ManagedUser[] = data?.data ?? [];
  const totalItems = data?.meta?.total ?? 0;

  const setStatus = useSetUserStatus();
  const resetPassword = useResetPassword();

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setEditing(user);
    setFormOpen(true);
  };

  const openReset = (user: ManagedUser) => {
    setResetTarget(user);
    setNewPassword('');
    setPasswordError('');
  };

  const handleReset = () => {
    if (!resetTarget) return;
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    resetPassword.mutate(
      { id: resetTarget.id, new_password: newPassword },
      { onSuccess: () => setResetTarget(null) },
    );
  };

  const handleToggleStatus = () => {
    if (!statusTarget) return;
    setStatus.mutate(
      { id: statusTarget.id, is_active: !statusTarget.is_active },
      { onSettled: () => setStatusTarget(null) },
    );
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Name',
      render: (item: ManagedUser) => (
        <div>
          <p className="font-medium text-gray-900">
            {item.full_name}
            {item.id === currentUser?.id && <span className="ml-2 text-xs font-normal text-blue-600">(you)</span>}
          </p>
          <p className="text-xs text-gray-500">{item.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (item: ManagedUser) => <span>{item.phone || '-'}</span> },
    {
      key: 'role',
      label: 'Role',
      render: (item: ManagedUser) => (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
          {roleLabel(item.role)}
        </span>
      ),
    },
    {
      key: 'linked_as',
      label: 'Profile',
      render: (item: ManagedUser) =>
        item.linked_as?.length ? (
          <span className="text-sm capitalize text-gray-700">{item.linked_as.join(', ')}</span>
        ) : (
          <span className="text-xs text-amber-600">Not linked</span>
        ),
    },
    {
      key: 'is_active',
      label: 'Status',
      render: (item: ManagedUser) => <StatusBadge status={item.is_active ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: ManagedUser) => {
        const isSelf = item.id === currentUser?.id;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(item); }}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
              title="Edit"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openReset(item); }}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-600"
              title="Reset password"
            >
              <KeyRound size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setStatusTarget(item); }}
              disabled={isSelf}
              className={`p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${
                item.is_active ? 'hover:bg-red-50 text-red-600' : 'hover:bg-green-50 text-green-600'
              }`}
              title={isSelf ? "You can't deactivate yourself" : item.is_active ? 'Deactivate' : 'Activate'}
            >
              <Power size={16} />
            </button>
          </div>
        );
      },
    },
  ];

  const hasFilters = !!(search || role || active);

  return (
    <div>
      <PageHeader
        title="User Accounts"
        subtitle="Manage who can log in and what role they have"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add User
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-4 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by name, email or phone..."
          className="w-72"
        />
        <Select
          options={ROLE_OPTIONS}
          placeholder="All roles"
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="w-44"
        />
        <Select
          options={statusFilterOptions}
          placeholder="All statuses"
          value={active}
          onChange={(e) => { setActive(e.target.value); setPage(1); }}
          className="w-40"
        />
      </div>

      {!isLoading && users.length === 0 && !hasFilters ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <UserCog size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No users yet</h3>
          <p className="text-gray-500 mb-4">Create accounts for doctors, nurses and other staff.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add User
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          totalItems={totalItems}
          page={page}
          limit={limit}
          onPageChange={setPage}
          loading={isLoading}
          emptyMessage="No users match your filters"
        />
      )}

      <UserFormModal open={formOpen} onClose={() => setFormOpen(false)} user={editing} />

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.is_active ? 'Deactivate user?' : 'Activate user?'}
        message={
          statusTarget?.is_active
            ? `${statusTarget?.full_name} will be logged out and won't be able to log in until reactivated.`
            : `${statusTarget?.full_name} will be able to log in again.`
        }
        confirmLabel={statusTarget?.is_active ? 'Deactivate' : 'Activate'}
        variant={statusTarget?.is_active ? 'danger' : 'info'}
        onConfirm={handleToggleStatus}
        onCancel={() => setStatusTarget(null)}
        loading={setStatus.isPending}
      />

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset Password"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setResetTarget(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={resetPassword.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {resetPassword.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
          </>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          Set a new password for <span className="font-medium">{resetTarget?.full_name}</span>. They'll be signed out
          of all sessions.
        </p>
        <FormField label="New Password" required error={passwordError}>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
            error={!!passwordError}
            autoComplete="new-password"
          />
        </FormField>
      </Modal>
    </div>
  );
}
