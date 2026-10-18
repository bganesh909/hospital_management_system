import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  BedDouble,
  ClipboardList,
  Edit2,
  LogOut,
  Plus,
  Stethoscope,
  User,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input } from '../../components/shared/FormField';
import { DoctorPicker } from '../../components/shared/DoctorPicker';
import {
  useAdmission,
  useAvailableBeds,
  useCreateRound,
  useDischargeAdmission,
  useRounds,
  useTransferBed,
  useUpdateAdmission,
} from '../../hooks/useIpd';
import type { Admission, Bed, DailyRound } from '../../services/ipdService';

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');

const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
  z.number().optional(),
);

const roundSchema = z.object({
  doctor_id: z.string().min(1, 'Doctor is required'),
  vitals_bp: z
    .string()
    .regex(/^(\d{2,3}\/\d{2,3})?$/, 'Use format 120/80')
    .optional(),
  vitals_temp: optionalNumber,
  vitals_pulse: optionalNumber,
  vitals_spo2: optionalNumber,
  notes: z.string().optional(),
  instructions: z.string().optional(),
});
type RoundForm = z.infer<typeof roundSchema>;

const blankToUndefined = (v?: string) => (v && v.trim() ? v : undefined);

export default function AdmissionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAdmission(id);
  const admission: Admission | undefined = data?.data;

  const [showEdit, setShowEdit] = useState(false);
  const [showDischarge, setShowDischarge] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showRound, setShowRound] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" className="min-h-[400px]" />
      </div>
    );
  }

  if (!admission) {
    return (
      <div className="p-6 text-center py-12">
        <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Admission Not Found</h2>
        <button
          onClick={() => navigate('/ipd')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Back to IPD
        </button>
      </div>
    );
  }

  const isAdmitted = admission.status === 'admitted';

  return (
    <div className="p-6">
      <PageHeader
        title={`Admission ${admission.admission_number}`}
        subtitle={admission.patient_name ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/ipd')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            {isAdmitted && (
              <>
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  <ArrowRightLeft size={16} />
                  Transfer Bed
                </button>
                <button
                  onClick={() => setShowDischarge(true)}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  <LogOut size={16} />
                  Discharge
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <InfoCard icon={User} title="Patient">
          <InfoRow label="Name" value={admission.patient_name} />
          <InfoRow label="Patient #" value={admission.patient_number} />
          <button
            onClick={() => navigate(`/patients/${admission.patient_id}`)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            View patient record
          </button>
        </InfoCard>
        <InfoCard icon={Stethoscope} title="Care">
          <InfoRow label="Doctor" value={admission.doctor_name ? `Dr. ${admission.doctor_name}` : null} />
          <InfoRow label="Reason" value={admission.reason} />
          <InfoRow label="Diagnosis" value={admission.diagnosis} />
        </InfoCard>
        <InfoCard icon={BedDouble} title="Stay">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={admission.status} />
          </div>
          <InfoRow label="Ward / Bed" value={[admission.ward_name, admission.bed_number].filter(Boolean).join(' · ') || null} />
          <InfoRow label="Admitted" value={formatDateTime(admission.admission_date)} />
          <InfoRow label="Discharged" value={formatDateTime(admission.discharge_date)} />
        </InfoCard>
      </div>

      {admission.discharge_summary && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">Discharge Summary</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{admission.discharge_summary}</p>
        </div>
      )}

      <RoundsSection
        admissionId={admission.id}
        canAdd={isAdmitted}
        onAdd={() => setShowRound(true)}
      />

      {showEdit && <EditAdmissionModal admission={admission} onClose={() => setShowEdit(false)} />}
      {showTransfer && <TransferBedModal admission={admission} onClose={() => setShowTransfer(false)} />}
      {showDischarge && <DischargeModal admission={admission} onClose={() => setShowDischarge(false)} />}
      {showRound && (
        <AddRoundModal
          admission={admission}
          onClose={() => setShowRound(false)}
        />
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Icon size={18} className="text-gray-400" />
        {title}
      </h3>
      <dl className="space-y-3">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  );
}

/* ---------- Daily Rounds ---------- */
function RoundsSection({
  admissionId,
  canAdd,
  onAdd,
}: {
  admissionId: string;
  canAdd: boolean;
  onAdd: () => void;
}) {
  const { data, isLoading } = useRounds(admissionId);
  const rounds: DailyRound[] = data?.data ?? [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList size={18} className="text-gray-400" />
          Daily Rounds
        </h3>
        {canAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-1.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Add Round
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : rounds.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No rounds recorded yet.</p>
      ) : (
        <ol className="space-y-4">
          {rounds.map((r) => (
            <li key={r.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {r.doctor_name ? `Dr. ${r.doctor_name}` : 'Doctor'}
                </span>
                <span className="text-xs text-gray-500">{formatDateTime(r.round_date)}</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <Vital label="BP" value={r.vitals_bp} />
                <Vital label="Temp" value={r.vitals_temp != null ? `${r.vitals_temp}°` : null} />
                <Vital label="Pulse" value={r.vitals_pulse != null ? `${r.vitals_pulse} bpm` : null} />
                <Vital label="SpO₂" value={r.vitals_spo2 != null ? `${r.vitals_spo2}%` : null} />
              </div>
              {r.notes && <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.notes}</p>}
              {r.instructions && (
                <p className="text-sm text-gray-700 mt-1">
                  <span className="font-medium">Instructions: </span>
                  {r.instructions}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Vital({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-700">
      {label}: <span className="font-medium">{value}</span>
    </span>
  );
}

function ModalFooter({
  onCancel,
  submitLabel,
  loading,
  formId,
  danger,
}: {
  onCancel: () => void;
  submitLabel: string;
  loading: boolean;
  formId: string;
  danger?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
      >
        Cancel
      </button>
      <button
        type="submit"
        form={formId}
        disabled={loading}
        className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

function AddRoundModal({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const createRound = useCreateRound();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RoundForm>({
    resolver: zodResolver(roundSchema) as any,
    defaultValues: { doctor_id: admission.doctor_id, vitals_bp: '' },
  });

  const onSubmit = (values: RoundForm) => {
    createRound.mutate(
      {
        admissionId: admission.id,
        data: {
          doctor_id: values.doctor_id,
          vitals_bp: blankToUndefined(values.vitals_bp),
          vitals_temp: values.vitals_temp,
          vitals_pulse: values.vitals_pulse,
          vitals_spo2: values.vitals_spo2,
          notes: blankToUndefined(values.notes),
          instructions: blankToUndefined(values.instructions),
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Record Daily Round"
      size="lg"
      footer={<ModalFooter onCancel={onClose} submitLabel="Save Round" loading={createRound.isPending} formId="round-form" />}
    >
      <form id="round-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Doctor" required error={errors.doctor_id?.message}>
          <DoctorPicker
            value={watch('doctor_id')}
            onChange={(doctorId) => setValue('doctor_id', doctorId, { shouldValidate: true })}
            error={!!errors.doctor_id}
          />
        </FormField>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label="BP" error={errors.vitals_bp?.message}>
            <Input placeholder="120/80" {...register('vitals_bp')} error={!!errors.vitals_bp} />
          </FormField>
          <FormField label="Temp (°F)" error={errors.vitals_temp?.message}>
            <Input type="number" step="0.1" {...register('vitals_temp')} />
          </FormField>
          <FormField label="Pulse (bpm)" error={errors.vitals_pulse?.message}>
            <Input type="number" {...register('vitals_pulse')} />
          </FormField>
          <FormField label="SpO₂ (%)" error={errors.vitals_spo2?.message}>
            <Input type="number" {...register('vitals_spo2')} />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea
            rows={3}
            {...register('notes')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
        <FormField label="Instructions">
          <textarea
            rows={2}
            {...register('instructions')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      </form>
    </Modal>
  );
}

function EditAdmissionModal({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const updateAdmission = useUpdateAdmission();
  const [doctorId, setDoctorId] = useState(admission.doctor_id);
  const [diagnosis, setDiagnosis] = useState(admission.diagnosis ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateAdmission.mutate(
      { id: admission.id, data: { doctor_id: doctorId, diagnosis: diagnosis.trim() || undefined } },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Admission"
      footer={<ModalFooter onCancel={onClose} submitLabel="Save" loading={updateAdmission.isPending} formId="edit-admission-form" />}
    >
      <form id="edit-admission-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Attending Doctor" required>
          <DoctorPicker value={doctorId} onChange={(id) => setDoctorId(id)} />
        </FormField>
        <FormField label="Diagnosis">
          <textarea
            rows={3}
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      </form>
    </Modal>
  );
}

function TransferBedModal({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const transfer = useTransferBed();
  const { data, isLoading } = useAvailableBeds();
  const beds: Bed[] = data?.data ?? [];
  const [bedId, setBedId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedId) return;
    transfer.mutate({ id: admission.id, bedId }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Transfer to Another Bed"
      footer={<ModalFooter onCancel={onClose} submitLabel="Transfer" loading={transfer.isPending} formId="transfer-form" />}
    >
      <form id="transfer-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Current: {[admission.ward_name, admission.bed_number].filter(Boolean).join(' · ') || 'No bed assigned'}
        </p>
        <FormField label="New Bed" required>
          <select
            value={bedId}
            onChange={(e) => setBedId(e.target.value)}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{isLoading ? 'Loading beds...' : beds.length ? 'Select an available bed' : 'No beds available'}</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.ward_name ?? 'Ward'} · Bed {b.bed_number}
                {b.charge_per_day != null ? ` · ${Number(b.charge_per_day).toLocaleString()}/day` : ''}
              </option>
            ))}
          </select>
        </FormField>
      </form>
    </Modal>
  );
}

function DischargeModal({ admission, onClose }: { admission: Admission; onClose: () => void }) {
  const discharge = useDischargeAdmission();
  const [summary, setSummary] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    discharge.mutate(
      { id: admission.id, dischargeSummary: summary.trim() || undefined },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Discharge ${admission.patient_name ?? 'Patient'}`}
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          submitLabel="Discharge Patient"
          loading={discharge.isPending}
          formId="discharge-form"
          danger
        />
      }
    >
      <form id="discharge-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          The bed will be freed and the admission marked as discharged.
        </p>
        <FormField label="Discharge Summary">
          <textarea
            rows={6}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Condition at discharge, medications, follow-up advice..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FormField>
      </form>
    </Modal>
  );
}
