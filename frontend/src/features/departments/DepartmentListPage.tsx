import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { Modal } from '../../components/shared/Modal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { FormField, Input, Textarea } from '../../components/shared/FormField';
import { DoctorPicker } from '../../components/shared/DoctorPicker';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from '../../hooks/useDoctors';
import type { Department } from '../../services/doctorService';

const departmentSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Max 100 characters'),
  description: z.string().optional(),
  head_id: z.string().optional(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

const emptyValues: DepartmentFormValues = { name: '', description: '', head_id: '' };

export default function DepartmentListPage() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const { data, isLoading } = useDepartments({ search: search || undefined });
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const departments: Department[] = data?.data ?? [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: emptyValues,
  });

  const openCreate = () => {
    setEditing(null);
    reset(emptyValues);
    setModalOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    reset({ name: dept.name, description: dept.description ?? '', head_id: dept.head_id ?? '' });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const onSubmit = (values: DepartmentFormValues) => {
    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      head_id: values.head_id || null,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload }, { onSuccess: closeModal });
    } else {
      // A new department has no doctors yet, so a head can only be picked when editing
      createMutation.mutate({ name: payload.name, description: payload.description }, { onSuccess: closeModal });
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Department',
      render: (d: Department) => (
        <div>
          <p className="font-medium text-gray-900">{d.name}</p>
          {d.description && <p className="text-xs text-gray-500 line-clamp-1">{d.description}</p>}
        </div>
      ),
    },
    {
      key: 'head_name',
      label: 'Head of Department',
      render: (d: Department) => (d.head_name ? `Dr. ${d.head_name}` : '—'),
    },
    { key: 'doctor_count', label: 'Doctors', className: 'text-center' },
    { key: 'staff_count', label: 'Staff', className: 'text-center' },
    {
      key: 'actions',
      label: '',
      render: (d: Department) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(d);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
            title="Edit"
          >
            <Edit size={15} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleting(d);
            }}
            disabled={d.doctor_count > 0 || d.staff_count > 0}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
            title={d.doctor_count > 0 || d.staff_count > 0 ? 'Reassign doctors and staff before deleting' : 'Delete'}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        subtitle="Manage hospital departments and their heads"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} /> Add Department
          </button>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search departments..."
          className="w-72"
        />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Building2 size={16} />
          {data?.meta?.total ?? departments.length} departments
        </div>
      </div>

      <DataTable
        columns={columns}
        data={departments}
        totalItems={departments.length}
        limit={100}
        loading={isLoading}
        emptyMessage="No departments yet. Add your first department."
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Department' : 'Add Department'}
        footer={
          <div className="flex gap-3">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} error={!!errors.name} placeholder="e.g. Cardiology" maxLength={100} />
          </FormField>
          <FormField label="Description">
            <Textarea {...register('description')} placeholder="What this department handles" />
          </FormField>
          {editing && (
            <FormField label="Head of Department">
              <Controller
                control={control}
                name="head_id"
                render={({ field }) => (
                  <DoctorPicker
                    value={field.value ?? ''}
                    onChange={(id) => field.onChange(id)}
                    departmentId={editing.id}
                    placeholder={editing.doctor_count ? 'No head assigned' : 'No doctors in this department yet'}
                  />
                )}
              />
            </FormField>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Department"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
