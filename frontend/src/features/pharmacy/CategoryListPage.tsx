import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, Tags } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { Modal } from '../../components/shared/Modal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { FormField, Input } from '../../components/shared/FormField';
import {
  usePharmacyCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../../hooks/usePharmacy';
import type { PharmacyCategory } from '../../services/pharmacyService';
import { useAuthStore } from '../../stores/authStore';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Max 100 characters'),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

export default function CategoryListPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PharmacyCategory | null>(null);
  const [deleting, setDeleting] = useState<PharmacyCategory | null>(null);

  const { data, isLoading } = usePharmacyCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  // The category list is small and unpaginated, so filter in the browser
  const categories = useMemo(() => {
    const all: PharmacyCategory[] = data?.data ?? [];
    const term = search.trim().toLowerCase();
    return term ? all.filter((c) => c.name.toLowerCase().includes(term)) : all;
  }, [data, search]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '' },
  });

  const openCreate = () => {
    setEditing(null);
    reset({ name: '' });
    setModalOpen(true);
  };

  const openEdit = (category: PharmacyCategory) => {
    setEditing(category);
    reset({ name: category.name });
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const onSubmit = ({ name }: CategoryFormValues) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, name: name.trim() }, { onSuccess: closeModal });
    } else {
      createMutation.mutate({ name: name.trim() }, { onSuccess: closeModal });
    }
  };

  const columns = [
    { key: 'name', label: 'Category', render: (c: PharmacyCategory) => <span className="font-medium text-gray-900">{c.name}</span> },
    { key: 'medicine_count', label: 'Medicines', className: 'text-center' },
    {
      key: 'actions',
      label: '',
      render: (c: PharmacyCategory) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(c);
            }}
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"
            title="Rename"
          >
            <Edit size={15} />
          </button>
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDeleting(c);
              }}
              disabled={c.medicine_count > 0}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
              title={c.medicine_count > 0 ? 'Move its medicines to another category first' : 'Delete'}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Categories"
        subtitle="Group medicines for inventory and reporting"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} /> Add Category
          </button>
        }
      />

      <div className="flex items-center justify-between gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." className="w-72" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Tags size={16} />
          {data?.data?.length ?? 0} categories
        </div>
      </div>

      <DataTable
        columns={columns}
        data={categories}
        totalItems={categories.length}
        limit={Math.max(categories.length, 1)}
        loading={isLoading}
        emptyMessage="No categories yet."
      />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Rename Category' : 'Add Category'}
        size="sm"
        footer={
          <div className="flex gap-3">
            <button onClick={closeModal} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Name" required error={errors.name?.message}>
            <Input {...register('name')} error={!!errors.name} placeholder="e.g. Antibiotics" maxLength={100} autoFocus />
          </FormField>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete Category"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
