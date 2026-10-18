import { currencySymbol } from '../../lib/currency';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useState, useCallback } from 'react';
import {
  Plus,
  Pill,
  AlertTriangle,
  Clock,
  Package,
  Edit2,
  PackagePlus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { StatCard } from '../../components/shared/StatCard';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import {
  useMedicines,
  useLowStockMedicines,
  useExpiringMedicines,
  useCreateMedicine,
  useUpdateMedicine,
  useUpdateStock,
  usePharmacyCategories,
} from '../../hooks/usePharmacy';
import type { Medicine, MedicineCreatePayload } from '../../services/pharmacyService';

const blankToUndefined = (v?: string) => (v && v.trim() ? v : undefined);

const medicineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  generic_name: z.string().optional(),
  category_id: z.string().optional(),
  manufacturer: z.string().optional(),
  unit_price: z.coerce.number().min(0, 'Must be positive'),
  stock_quantity: z.coerce.number().int().min(0),
  reorder_level: z.coerce.number().int().min(0),
  expiry_date: z.string().optional(),
  batch_number: z.string().optional(),
  requires_prescription: z.boolean(),
  description: z.string().optional(),
});

const stockSchema = z.object({
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  operation: z.enum(['add', 'subtract']),
});

type MedicineFormData = z.infer<typeof medicineSchema>;
type StockFormData = z.infer<typeof stockSchema>;

type TabKey = 'all' | 'low_stock' | 'expiring';

export default function MedicineListPage() {
  const role = useAuthStore((st) => st.user?.role);
  const canManage = role === 'admin' || role === 'pharmacist';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editMedicine, setEditMedicine] = useState<Medicine | null>(null);
  const [stockMedicine, setStockMedicine] = useState<Medicine | null>(null);
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const params: Record<string, any> = { page, limit: 20 };
  if (search) params.search = search;
  if (sortKey) {
    params.sort_by = sortKey;
    params.sort_order = sortDir;
  }

  const { data: medicinesResponse, isLoading } = useMedicines(params);
  const { data: lowStockResponse } = useLowStockMedicines();
  const { data: expiringResponse } = useExpiringMedicines();
  const { data: categoriesResponse } = usePharmacyCategories();

  const allMedicines: Medicine[] = medicinesResponse?.data || [];
  const lowStockMedicines: Medicine[] = lowStockResponse?.data || [];
  const expiringMedicines: Medicine[] = expiringResponse?.data || [];
  const categories = categoriesResponse?.data || [];
  const meta = medicinesResponse?.meta;

  const createMedicine = useCreateMedicine();
  const updateMedicine = useUpdateMedicine();
  const updateStock = useUpdateStock();

  const displayData =
    activeTab === 'low_stock'
      ? lowStockMedicines
      : activeTab === 'expiring'
        ? expiringMedicines
        : allMedicines;

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  // Medicine Form
  const medicineForm = useForm<MedicineFormData>({
    resolver: zodResolver(medicineSchema),
  });

  const stockForm = useForm<StockFormData>({
    resolver: zodResolver(stockSchema),
    defaultValues: { operation: 'add' },
  });

  const openAddModal = () => {
    setEditMedicine(null);
    medicineForm.reset({
      name: '',
      generic_name: '',
      category_id: '',
      manufacturer: '',
      unit_price: 0,
      stock_quantity: 0,
      reorder_level: 10,
      expiry_date: '',
      batch_number: '',
      requires_prescription: true,
      description: '',
    });
    setShowMedicineModal(true);
  };

  const openEditModal = (medicine: Medicine) => {
    setEditMedicine(medicine);
    medicineForm.reset({
      name: medicine.name,
      generic_name: medicine.generic_name || '',
      category_id: medicine.category_id || '',
      manufacturer: medicine.manufacturer || '',
      unit_price: medicine.unit_price,
      stock_quantity: medicine.stock_quantity,
      reorder_level: medicine.reorder_level,
      expiry_date: medicine.expiry_date || '',
      batch_number: medicine.batch_number || '',
      requires_prescription: medicine.requires_prescription,
      description: medicine.description || '',
    });
    setShowMedicineModal(true);
  };

  const openStockModal = (medicine: Medicine) => {
    setStockMedicine(medicine);
    stockForm.reset({ quantity: 0, operation: 'add' });
    setShowStockModal(true);
  };

  const handleMedicineSubmit = async (data: MedicineFormData) => {
    const payload: MedicineCreatePayload = {
      name: data.name,
      generic_name: blankToUndefined(data.generic_name),
      category_id: blankToUndefined(data.category_id),
      manufacturer: blankToUndefined(data.manufacturer),
      unit_price: data.unit_price,
      stock_quantity: data.stock_quantity,
      reorder_level: data.reorder_level,
      expiry_date: blankToUndefined(data.expiry_date),
      batch_number: blankToUndefined(data.batch_number),
      requires_prescription: data.requires_prescription,
      description: blankToUndefined(data.description),
    };
    try {
      if (editMedicine) {
        // Stock is adjusted through the stock modal
        const { stock_quantity: _stock, ...update } = payload;
        await updateMedicine.mutateAsync({ id: editMedicine.id, data: update });
      } else {
        await createMedicine.mutateAsync(payload);
      }
      setShowMedicineModal(false);
    } catch {
      // handled
    }
  };

  const handleStockSubmit = async (data: StockFormData) => {
    if (!stockMedicine) return;
    try {
      await updateStock.mutateAsync({ id: stockMedicine.id, data });
      setShowStockModal(false);
    } catch {
      // handled
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Medicine',
      sortable: true,
      render: (item: Medicine) => (
        <div>
          <p className="font-medium text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-500">{item.generic_name}</p>
        </div>
      ),
    },
    {
      key: 'category_name',
      label: 'Category',
      render: (item: Medicine) => (
        <span className="text-sm">{item.category_name ?? '--'}</span>
      ),
    },
    {
      key: 'manufacturer',
      label: 'Manufacturer',
      render: (item: Medicine) => (
        <span className="text-sm text-gray-600">{item.manufacturer ?? '--'}</span>
      ),
    },
    {
      key: 'unit_price',
      label: 'Price',
      sortable: true,
      render: (item: Medicine) => (
        <span className="font-medium">{currencySymbol()} {Number(item.unit_price).toFixed(2)}</span>
      ),
    },
    {
      key: 'stock_quantity',
      label: 'Stock',
      sortable: true,
      render: (item: Medicine) => {
        const isLow = item.stock_quantity <= item.reorder_level;
        return (
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>
              {item.stock_quantity}
            </span>
            {isLow && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 rounded-full">
                <AlertTriangle size={10} />
                LOW
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'reorder_level',
      label: 'Reorder Level',
      render: (item: Medicine) => (
        <span className="text-gray-600">{item.reorder_level}</span>
      ),
    },
    {
      key: 'expiry_date',
      label: 'Expiry',
      sortable: true,
      render: (item: Medicine) => {
        if (!item.expiry_date) return <span className="text-gray-400">--</span>;
        const expDate = new Date(item.expiry_date);
        const now = new Date();
        const monthsLeft = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
        const isExpiring = monthsLeft <= 3;
        const isExpired = monthsLeft <= 0;
        return (
          <span className={`text-sm ${isExpired ? 'text-red-600 font-semibold' : isExpiring ? 'text-orange-600' : 'text-gray-600'}`}>
            {expDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            {isExpired && (
              <span className="ml-1 text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-bold">EXPIRED</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (item: Medicine) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openStockModal(item);
            }}
            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Update Stock"
          >
            <PackagePlus size={14} />
          </button>
        </div>
      ),
    },
  ];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: 'All Medicines', count: meta?.total || 0 },
    { key: 'low_stock', label: 'Low Stock', count: lowStockMedicines.length },
    { key: 'expiring', label: 'Expiring Soon', count: expiringMedicines.length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medicine Inventory"
        subtitle="Manage medicines, stock levels, and expiry tracking"
        actions={
          <>
            {canManage && (
              <>
                <Link to="/pharmacy/dispense" className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                  Dispense
                </Link>
                <Link to="/pharmacy/categories" className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                  Categories
                </Link>
              </>
            )}
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            Add Medicine
          </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Medicines"
          value={meta?.total || 0}
          icon={Pill}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          title="Low Stock Items"
          value={lowStockMedicines.length}
          icon={AlertTriangle}
          iconColor="text-red-600"
          iconBg="bg-red-100"
        />
        <StatCard
          title="Expiring Soon"
          value={expiringMedicines.length}
          icon={Clock}
          iconColor="text-orange-600"
          iconBg="bg-orange-100"
        />
        <StatCard
          title="Total Stock Value"
          value={`${currencySymbol()} ${allMedicines.reduce((s, m) => s + m.unit_price * m.stock_quantity, 0).toLocaleString()}`}
          icon={Package}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      tab.key === 'low_stock'
                        ? 'bg-red-100 text-red-700'
                        : tab.key === 'expiring'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeTab === 'all' && (
            <div className="mb-4">
              <SearchInput
                value={search}
                onChange={handleSearch}
                placeholder="Search by name, generic name, or category..."
                className="max-w-md"
              />
            </div>
          )}

          <DataTable
            columns={columns}
            data={displayData}
            totalItems={activeTab === 'all' ? meta?.total || 0 : displayData.length}
            page={activeTab === 'all' ? page : 1}
            limit={20}
            onPageChange={activeTab === 'all' ? setPage : undefined}
            onSort={(key, dir) => {
              setSortKey(key);
              setSortDir(dir);
            }}
            loading={isLoading}
            emptyMessage={
              activeTab === 'low_stock'
                ? 'No low stock items'
                : activeTab === 'expiring'
                  ? 'No medicines expiring soon'
                  : 'No medicines found'
            }
          />
        </div>
      </div>

      {/* Add/Edit Medicine Modal */}
      <Modal
        open={showMedicineModal}
        onClose={() => setShowMedicineModal(false)}
        title={editMedicine ? 'Edit Medicine' : 'Add Medicine'}
        size="xl"
        footer={
          <>
            <button
              onClick={() => setShowMedicineModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={medicineForm.handleSubmit(handleMedicineSubmit)}
              disabled={createMedicine.isPending || updateMedicine.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createMedicine.isPending || updateMedicine.isPending ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Name" required error={medicineForm.formState.errors.name?.message}>
            <Input
              {...medicineForm.register('name')}
              placeholder="Medicine name"
              error={!!medicineForm.formState.errors.name}
            />
          </FormField>
          <FormField label="Generic Name" error={medicineForm.formState.errors.generic_name?.message}>
            <Input
              {...medicineForm.register('generic_name')}
              placeholder="Generic / salt name"
              error={!!medicineForm.formState.errors.generic_name}
            />
          </FormField>
          <FormField label="Category" error={medicineForm.formState.errors.category_id?.message}>
            <Select
              {...medicineForm.register('category_id')}
              options={categories.map((c: any) => ({ value: c.id, label: c.name }))}
              placeholder="Select category"
              error={!!medicineForm.formState.errors.category_id}
            />
          </FormField>
          <FormField label="Manufacturer">
            <Input {...medicineForm.register('manufacturer')} placeholder="Manufacturer name" />
          </FormField>
          <FormField label={`Unit Price (${currencySymbol()})`} required error={medicineForm.formState.errors.unit_price?.message}>
            <Input
              type="number"
              step="0.01"
              {...medicineForm.register('unit_price')}
              placeholder="0.00"
              error={!!medicineForm.formState.errors.unit_price}
            />
          </FormField>
          <FormField label="Stock Quantity" error={medicineForm.formState.errors.stock_quantity?.message}>
            <Input
              type="number"
              {...medicineForm.register('stock_quantity')}
              placeholder="0"
              disabled={!!editMedicine}
            />
          </FormField>
          <FormField label="Reorder Level" error={medicineForm.formState.errors.reorder_level?.message}>
            <Input
              type="number"
              {...medicineForm.register('reorder_level')}
              placeholder="10"
            />
          </FormField>
          <FormField label="Batch Number">
            <Input {...medicineForm.register('batch_number')} placeholder="Batch #" />
          </FormField>
          <FormField label="Expiry Date">
            <Input type="date" {...medicineForm.register('expiry_date')} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
            <input type="checkbox" {...medicineForm.register('requires_prescription')} className="rounded border-gray-300" />
            Requires prescription
          </label>
          <div className="md:col-span-2">
            <FormField label="Description">
              <Textarea {...medicineForm.register('description')} placeholder="Additional details..." />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* Stock Update Modal */}
      <Modal
        open={showStockModal}
        onClose={() => setShowStockModal(false)}
        title={`Update Stock - ${stockMedicine?.name || ''}`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowStockModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={stockForm.handleSubmit(handleStockSubmit)}
              disabled={updateStock.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateStock.isPending ? 'Updating...' : 'Update Stock'}
            </button>
          </>
        }
      >
        {stockMedicine && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Current Stock</p>
              <p className={`text-2xl font-bold ${stockMedicine.stock_quantity <= stockMedicine.reorder_level ? 'text-red-600' : 'text-gray-900'}`}>
                {stockMedicine.stock_quantity}
              </p>
              <p className="text-xs text-gray-500">Reorder Level: {stockMedicine.reorder_level}</p>
            </div>
            <FormField label="Operation" required>
              <Select
                {...stockForm.register('operation')}
                options={[
                  { value: 'add', label: 'Add Stock' },
                  { value: 'subtract', label: 'Remove Stock' },
                ]}
              />
            </FormField>
            <FormField label="Quantity" required error={stockForm.formState.errors.quantity?.message}>
              <Input
                type="number"
                {...stockForm.register('quantity')}
                placeholder="Enter quantity"
                error={!!stockForm.formState.errors.quantity}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
