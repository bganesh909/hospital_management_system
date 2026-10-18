import { currencySymbol } from '../../lib/currency';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BedDouble, ChevronDown, ChevronUp, User, Plus, Wrench, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { FormField, Input, Select } from '../../components/shared/FormField';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  useWards,
  useWardBeds,
  useCreateWard,
  useUpdateWard,
  useDeleteWard,
  useCreateBed,
  useCreateBedsBulk,
  useUpdateBedStatus,
  useUpdateBedNumber,
  useDeleteBed,
} from '../../hooks/useIpd';
import type { Ward, Bed, WardType, ManualBedStatus } from '../../services/ipdService';
import { useAuthStore } from '../../stores/authStore';

const WARD_TYPES: { value: WardType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'semi_private', label: 'Semi Private' },
  { value: 'private', label: 'Private' },
  { value: 'icu', label: 'ICU' },
  { value: 'nicu', label: 'NICU' },
  { value: 'emergency', label: 'Emergency' },
];

const MANUAL_BED_STATUSES: { value: ManualBedStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'reserved', label: 'Reserved' },
];

function BedStatusColor(status: Bed['status']) {
  switch (status) {
    case 'available':
      return 'bg-green-100 border-green-300 hover:bg-green-200';
    case 'occupied':
      return 'bg-red-100 border-red-300 hover:bg-red-200';
    case 'maintenance':
      return 'bg-yellow-100 border-yellow-300 hover:bg-yellow-200';
    case 'reserved':
      return 'bg-purple-100 border-purple-300 hover:bg-purple-200';
    default:
      return 'bg-gray-100 border-gray-300';
  }
}

function BedIcon({ status }: { status: Bed['status'] }) {
  switch (status) {
    case 'occupied':
      return <User size={16} className="text-red-600" />;
    case 'maintenance':
      return <Wrench size={16} className="text-yellow-600" />;
    default:
      return <BedDouble size={16} className="text-green-600" />;
  }
}

// ---------- Ward form ----------

const optionalInt = z
  .string()
  .optional()
  .refine((v) => !v || /^-?\d+$/.test(v), 'Must be a whole number');

const wardSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: z.enum(['general', 'semi_private', 'private', 'icu', 'nicu', 'emergency']),
  floor: optionalInt,
  charge_per_day: z
    .string()
    .min(1, 'Daily charge is required')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Must be 0 or more'),
  total_beds: z
    .string()
    .optional()
    .refine((v) => !v || (/^\d+$/.test(v) && Number(v) <= 100), 'Between 0 and 100'),
  bed_prefix: z.string().max(10).optional(),
});

type WardFormValues = z.infer<typeof wardSchema>;

function WardFormModal({ open, ward, onClose }: { open: boolean; ward: Ward | null; onClose: () => void }) {
  const createWard = useCreateWard();
  const updateWard = useUpdateWard();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WardFormValues>({
    resolver: zodResolver(wardSchema),
    values: ward
      ? {
          name: ward.name,
          type: ward.type,
          floor: ward.floor != null ? String(ward.floor) : '',
          charge_per_day: String(ward.charge_per_day),
          total_beds: '',
          bed_prefix: '',
        }
      : { name: '', type: 'general', floor: '', charge_per_day: '', total_beds: '10', bed_prefix: '' },
  });

  const onSubmit = (values: WardFormValues) => {
    const base = {
      name: values.name.trim(),
      type: values.type,
      floor: values.floor ? Number(values.floor) : null,
      charge_per_day: Number(values.charge_per_day),
    };
    if (ward) {
      updateWard.mutate({ id: ward.id, data: base }, { onSuccess: onClose });
    } else {
      createWard.mutate(
        { ...base, total_beds: Number(values.total_beds || 0), bed_prefix: values.bed_prefix?.trim() ?? '' },
        { onSuccess: onClose },
      );
    }
  };

  const saving = createWard.isPending || updateWard.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ward ? `Edit ${ward.name}` : 'Add Ward'}
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : ward ? 'Update' : 'Create Ward'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
        <FormField label="Ward Name" required error={errors.name?.message} className="col-span-2">
          <Input {...register('name')} error={!!errors.name} placeholder="e.g. General Ward A" maxLength={100} />
        </FormField>
        <FormField label="Type" required error={errors.type?.message}>
          <Select {...register('type')} options={WARD_TYPES} />
        </FormField>
        <FormField label="Floor" error={errors.floor?.message}>
          <Input {...register('floor')} error={!!errors.floor} type="number" placeholder="e.g. 2" />
        </FormField>
        <FormField label={`Charge per Day (${currencySymbol()})`} required error={errors.charge_per_day?.message} className="col-span-2">
          <Input {...register('charge_per_day')} error={!!errors.charge_per_day} type="number" step="0.01" min="0" />
        </FormField>
        {!ward && (
          <>
            <FormField label="Number of Beds" error={errors.total_beds?.message}>
              <Input {...register('total_beds')} error={!!errors.total_beds} type="number" min="0" max="100" />
            </FormField>
            <FormField label="Bed Number Prefix" error={errors.bed_prefix?.message}>
              <Input {...register('bed_prefix')} placeholder="e.g. GA-" maxLength={10} />
            </FormField>
            <p className="col-span-2 text-xs text-gray-500">
              Beds are numbered prefix + 1, 2, 3… You can add more beds to the ward later.
            </p>
          </>
        )}
      </form>
    </Modal>
  );
}

// ---------- Add beds ----------

function AddBedsModal({ ward, onClose }: { ward: Ward | null; onClose: () => void }) {
  const createBed = useCreateBed();
  const createBulk = useCreateBedsBulk();
  const [mode, setMode] = useState<'single' | 'bulk'>('bulk');
  const [bedNumber, setBedNumber] = useState('');
  const [prefix, setPrefix] = useState('');
  const [start, setStart] = useState('');
  const [count, setCount] = useState('5');
  const [error, setError] = useState('');

  if (!ward) return null;

  const defaultStart = String((ward.total_beds ?? 0) + 1);

  const submit = () => {
    setError('');
    if (mode === 'single') {
      if (!bedNumber.trim()) return setError('Bed number is required');
      createBed.mutate({ ward_id: ward.id, bed_number: bedNumber.trim() }, { onSuccess: onClose });
    } else {
      const n = Number(count);
      const s = Number(start || defaultStart);
      if (!Number.isInteger(n) || n < 1 || n > 100) return setError('Count must be between 1 and 100');
      if (!Number.isInteger(s) || s < 0) return setError('Start must be a whole number');
      createBulk.mutate({ ward_id: ward.id, prefix: prefix.trim(), start: s, count: n }, { onSuccess: onClose });
    }
  };

  const s = Number(start || defaultStart);
  const n = Number(count) || 0;
  const preview = n > 0 ? `${prefix}${s} … ${prefix}${s + n - 1}` : '';
  const saving = createBed.isPending || createBulk.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add Beds to ${ward.name}`}
      size="sm"
      footer={
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex rounded-lg border border-gray-200 p-1 text-sm">
          {(['bulk', 'single'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md py-1.5 font-medium ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {m === 'bulk' ? 'Several beds' : 'One bed'}
            </button>
          ))}
        </div>
        {mode === 'single' ? (
          <FormField label="Bed Number" required>
            <Input value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} placeholder="e.g. GA-12" maxLength={20} />
          </FormField>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Prefix">
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="GA-" maxLength={10} />
            </FormField>
            <FormField label="Start at">
              <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder={defaultStart} type="number" min="0" />
            </FormField>
            <FormField label="Count" required>
              <Input value={count} onChange={(e) => setCount(e.target.value)} type="number" min="1" max="100" />
            </FormField>
            {preview && <p className="col-span-3 text-xs text-gray-500">Creates beds {preview}</p>}
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}

// ---------- Bed detail ----------

function BedDetailModal({ bed, canManage, canChangeStatus, onClose }: {
  bed: Bed | null;
  canManage: boolean;
  canChangeStatus: boolean;
  onClose: () => void;
}) {
  const updateStatus = useUpdateBedStatus();
  const renameBed = useUpdateBedNumber();
  const deleteBed = useDeleteBed();
  const [newNumber, setNewNumber] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!bed) return null;
  const occupied = bed.status === 'occupied';

  return (
    <>
      <Modal open onClose={onClose} title={`Bed ${bed.bed_number}`} size="sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <StatusBadge status={bed.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Ward</span>
            <span className="text-sm font-medium text-gray-900">
              {bed.ward_name}
              {bed.ward_type ? ` (${bed.ward_type.replace(/_/g, ' ')})` : ''}
            </span>
          </div>
          {bed.charge_per_day != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Daily Rate</span>
              <span className="text-sm font-medium text-gray-900">{currencySymbol()} {bed.charge_per_day}</span>
            </div>
          )}
          {occupied && bed.patient_name && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-100">
              <p className="text-xs font-medium text-red-600 mb-1">Occupied By</p>
              <p className="text-sm font-semibold text-gray-900">{bed.patient_name}</p>
              <p className="text-xs text-gray-500 mt-1">Discharge or transfer the patient to free this bed.</p>
            </div>
          )}

          {!occupied && canChangeStatus && (
            <FormField label="Change Status">
              <div className="flex gap-2">
                {MANUAL_BED_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    disabled={bed.status === s.value || updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ id: bed.id, status: s.value }, { onSuccess: onClose })}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border ${
                      bed.status === s.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    } disabled:cursor-not-allowed`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          {canManage && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <FormField label="Rename Bed">
                <div className="flex gap-2">
                  <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder={bed.bed_number} maxLength={20} />
                  <button
                    disabled={!newNumber.trim() || newNumber.trim() === bed.bed_number || renameBed.isPending}
                    onClick={() => renameBed.mutate({ id: bed.id, bedNumber: newNumber.trim() }, { onSuccess: onClose })}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </FormField>
              {!occupied && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                >
                  <Trash2 size={14} /> Delete bed
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        title="Delete Bed"
        message={`Delete bed ${bed.bed_number}? Beds with admission history can't be deleted — set them to maintenance instead.`}
        confirmLabel="Delete"
        loading={deleteBed.isPending}
        onConfirm={() =>
          deleteBed.mutate(bed.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              onClose();
            },
          })
        }
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ---------- Ward card ----------

function WardBedGrid({ wardId, canManage, canChangeStatus }: { wardId: string; canManage: boolean; canChangeStatus: boolean }) {
  const { data: bedsResponse, isLoading } = useWardBeds(wardId);
  const beds: Bed[] = bedsResponse?.data || [];
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const selectedBed = beds.find((b) => b.id === selectedBedId) ?? null;

  if (isLoading) {
    return (
      <div className="py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (beds.length === 0) {
    return (
      <div className="py-6 text-center text-gray-500 text-sm">
        No beds configured for this ward.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-4">
        {beds.map((bed) => (
          <button
            key={bed.id}
            onClick={() => setSelectedBedId(bed.id)}
            className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${BedStatusColor(bed.status)}`}
            title={`Bed ${bed.bed_number} - ${bed.status}${bed.patient_name ? ` - ${bed.patient_name}` : ''}`}
          >
            <BedIcon status={bed.status} />
            <span className="text-xs font-semibold text-gray-800">{bed.bed_number}</span>
            <span className="text-[10px] capitalize text-gray-600">{bed.status}</span>
          </button>
        ))}
      </div>
      <BedDetailModal
        key={selectedBed?.id ?? 'none'}
        bed={selectedBed}
        canManage={canManage}
        canChangeStatus={canChangeStatus}
        onClose={() => setSelectedBedId(null)}
      />
    </>
  );
}

function WardCard({ ward, canManage, canChangeStatus, onEdit, onAddBeds, onDelete }: {
  ward: Ward;
  canManage: boolean;
  canChangeStatus: boolean;
  onEdit: () => void;
  onAddBeds: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const occupancyPct = ward.total_beds > 0 ? (ward.occupied_beds / ward.total_beds) * 100 : 0;

  const barColor =
    occupancyPct >= 90
      ? 'bg-red-500'
      : occupancyPct >= 70
        ? 'bg-yellow-500'
        : 'bg-green-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded(!expanded)}
        className="w-full p-5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BedDouble size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{ward.name}</h3>
              <p className="text-xs text-gray-500 capitalize">
                {ward.type.replace(/_/g, ' ')}
                {ward.floor != null ? ` - Floor ${ward.floor}` : ''}
                {` - ${currencySymbol()} ${ward.charge_per_day}/day`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canManage && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={onAddBeds} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 rounded hover:bg-blue-50" title="Add beds">
                  <Plus size={14} /> Beds
                </button>
                <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Edit ward">
                  <Edit size={15} />
                </button>
                <button
                  onClick={onDelete}
                  disabled={ward.occupied_beds > 0}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                  title={ward.occupied_beds > 0 ? 'Ward has occupied beds' : 'Delete ward'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {ward.occupied_beds}/{ward.total_beds}
              </p>
              <p className="text-xs text-gray-500">beds occupied</p>
            </div>
            {expanded ? (
              <ChevronUp size={18} className="text-gray-400" />
            ) : (
              <ChevronDown size={18} className="text-gray-400" />
            )}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${barColor}`}
            style={{ width: `${occupancyPct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {ward.available_beds} Available
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {ward.occupied_beds} Occupied
          </span>
          {ward.maintenance_beds > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
              {ward.maintenance_beds} Maintenance
            </span>
          )}
          {ward.reserved_beds > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              {ward.reserved_beds} Reserved
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200">
          <WardBedGrid wardId={ward.id} canManage={canManage} canChangeStatus={canChangeStatus} />
        </div>
      )}
    </div>
  );
}

export default function WardOverview() {
  const { user } = useAuthStore();
  const canManage = user?.role === 'admin';
  const canChangeStatus = user?.role === 'admin' || user?.role === 'nurse';

  const { data: wardsResponse, isLoading } = useWards();
  const wards: Ward[] = wardsResponse?.data || [];
  const deleteWard = useDeleteWard();

  const [wardModal, setWardModal] = useState<{ open: boolean; ward: Ward | null }>({ open: false, ward: null });
  const [bedsFor, setBedsFor] = useState<Ward | null>(null);
  const [deleting, setDeleting] = useState<Ward | null>(null);

  const totalBeds = wards.reduce((sum, w) => sum + w.total_beds, 0);
  const occupiedBeds = wards.reduce((sum, w) => sum + w.occupied_beds, 0);
  const availableBeds = wards.reduce((sum, w) => sum + w.available_beds, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ward Overview"
        subtitle="Visual overview of all wards and bed occupancy"
        actions={
          canManage && (
            <button
              onClick={() => setWardModal({ open: true, ward: null })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              Add Ward
            </button>
          )
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Wards</p>
          <p className="text-2xl font-bold text-gray-900">{wards.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Beds</p>
          <p className="text-2xl font-bold text-gray-900">{totalBeds}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Occupied</p>
          <p className="text-2xl font-bold text-red-600">{occupiedBeds}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Available</p>
          <p className="text-2xl font-bold text-green-600">{availableBeds}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-1 text-xs text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-green-200 border border-green-400" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-200 border border-red-400" />
          Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400" />
          Maintenance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-purple-200 border border-purple-400" />
          Reserved
        </span>
      </div>

      {/* Ward Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : wards.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <BedDouble size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No wards configured yet.</p>
          {canManage && (
            <button
              onClick={() => setWardModal({ open: true, ward: null })}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={16} /> Add your first ward
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {wards.map((ward) => (
            <WardCard
              key={ward.id}
              ward={ward}
              canManage={canManage}
              canChangeStatus={canChangeStatus}
              onEdit={() => setWardModal({ open: true, ward })}
              onAddBeds={() => setBedsFor(ward)}
              onDelete={() => setDeleting(ward)}
            />
          ))}
        </div>
      )}

      {wardModal.open && (
        <WardFormModal open ward={wardModal.ward} onClose={() => setWardModal({ open: false, ward: null })} />
      )}
      {bedsFor && <AddBedsModal key={bedsFor.id} ward={bedsFor} onClose={() => setBedsFor(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Delete Ward"
        message={`Delete "${deleting?.name}" and all its beds? Wards with admission history can't be deleted.`}
        confirmLabel="Delete"
        loading={deleteWard.isPending}
        onConfirm={() => deleting && deleteWard.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
