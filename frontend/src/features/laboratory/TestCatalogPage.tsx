import { currencySymbol } from '../../lib/currency';
import { useState } from 'react';
import { Plus, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { useTestCatalog, useCreateCatalogItem, useUpdateCatalogItem } from '../../hooks/useLaboratory';
import type { TestCatalogItem } from '../../services/laboratoryService';

const emptyForm = { test_code: '', name: '', category: '', description: '', normal_range: '', unit: '', price: '', turnaround_hours: '24', is_active: true };
const categories = ['Hematology', 'Biochemistry', 'Microbiology', 'Immunology', 'Pathology', 'Radiology', 'Cardiology', 'Urology'];

export default function TestCatalogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const { data, isLoading } = useTestCatalog({ page, limit: 20, search: search || undefined });
  const createMutation = useCreateCatalogItem();
  const updateMutation = useUpdateCatalogItem();

  const columns = [
    { key: 'test_code', label: 'Code', className: 'font-mono text-xs' },
    { key: 'name', label: 'Test Name' },
    { key: 'category', label: 'Category', render: (r: any) => r.category || '—' },
    { key: 'normal_range', label: 'Normal Range', render: (r: any) => r.normal_range ? <span className="text-xs">{r.normal_range} {r.unit || ''}</span> : '—' },
    { key: 'price', label: 'Price', render: (r: any) => `${currencySymbol()} ${Number(r.price).toFixed(2)}`, className: 'text-right' },
    { key: 'turnaround_hours', label: 'TAT', render: (r: any) => (r.turnaround_hours ? `${r.turnaround_hours}h` : '—') },
    {
      key: 'is_active', label: 'Status', render: (r: any) => (
        <button
          onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: r.id, data: { is_active: !r.is_active } }); }}
          disabled={updateMutation.isPending}
          title={r.is_active ? 'Click to deactivate' : 'Click to activate'}
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          {r.is_active ? 'Active' : 'Inactive'}
        </button>
      )
    },
    {
      key: 'actions', label: '', render: (r: any) => (
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
          <Edit size={15} />
        </button>
      )
    },
  ];

  const openEdit = (test: TestCatalogItem) => {
    setEditId(test.id);
    setFormData({ test_code: test.test_code, name: test.name, category: test.category || '', description: test.description || '', normal_range: test.normal_range || '', unit: test.unit || '', price: String(test.price), turnaround_hours: String(test.turnaround_hours ?? 24), is_active: test.is_active });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (!formData.test_code.trim() || !formData.name.trim() || !formData.price) { toast.error('Fill required fields'); return; }
    if (Number.isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) { toast.error('Price must be 0 or more'); return; }
    if (formData.turnaround_hours && !(parseInt(formData.turnaround_hours, 10) >= 1)) { toast.error('Turnaround must be at least 1 hour'); return; }
    const { test_code, ...rest } = formData;
    const payload = {
      ...rest,
      name: rest.name.trim(),
      category: rest.category || undefined,
      description: rest.description || undefined,
      normal_range: rest.normal_range || undefined,
      unit: rest.unit || undefined,
      price: parseFloat(rest.price),
      turnaround_hours: parseInt(rest.turnaround_hours, 10) || 24,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload }, { onSuccess: () => setShowModal(false) });
    } else {
      createMutation.mutate({ ...payload, test_code: test_code.trim().toUpperCase() }, { onSuccess: () => setShowModal(false) });
    }
  };

  return (
    <div>
      <PageHeader title="Test Catalog" subtitle="Manage available laboratory tests" actions={
        <button onClick={() => { setEditId(null); setFormData(emptyForm); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus size={16} /> Add Test</button>
      } />
      <div className="mb-4"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search tests..." className="w-72" /></div>
      <DataTable columns={columns} data={data?.data || []} totalItems={data?.meta?.total || 0} page={page} limit={20} onPageChange={setPage} loading={isLoading} />

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Test' : 'Add New Test'} size="lg" footer={
        <div className="flex gap-3">
          <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {editId ? 'Update' : 'Create'}
          </button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Test Code" required><Input value={formData.test_code} onChange={(e) => setFormData({ ...formData, test_code: e.target.value })} placeholder="e.g. CBC-01" maxLength={20} disabled={!!editId} /></FormField>
          <FormField label="Test Name" required><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Complete Blood Count" /></FormField>
          <FormField label="Category"><Select options={categories.map((c) => ({ value: c, label: c }))} value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} placeholder="Select category" /></FormField>
          <FormField label={`Price (${currencySymbol()})`} required><Input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} /></FormField>
          <FormField label="Normal Range"><Input value={formData.normal_range} onChange={(e) => setFormData({ ...formData, normal_range: e.target.value })} placeholder="e.g. 4.5-11.0" /></FormField>
          <FormField label="Unit"><Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g. x10^3/uL" /></FormField>
          <FormField label="Turnaround (hours)"><Input type="number" min="1" value={formData.turnaround_hours} onChange={(e) => setFormData({ ...formData, turnaround_hours: e.target.value })} placeholder="24" /></FormField>
          <FormField label="Status"><Select options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} value={String(formData.is_active)} onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })} /></FormField>
          <FormField label="Description" className="col-span-2"><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></FormField>
        </div>
      </Modal>
    </div>
  );
}
