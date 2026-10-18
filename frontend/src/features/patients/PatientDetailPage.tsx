import { currencySymbol } from '../../lib/currency';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Heart,
  Shield,
  AlertCircle,
  Calendar,
  FileText,
  Pill,
  TestTube,
  CreditCard,
  BedDouble,
  User,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { DataTable } from '../../components/shared/DataTable';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { usePatient, useDeletePatient } from '../../hooks/usePatients';
import { useAppointments } from '../../hooks/useAppointments';
import { useOpdVisits, usePrescriptions } from '../../hooks/useOpd';
import { useAdmissions } from '../../hooks/useIpd';
import { useLabRequests } from '../../hooks/useLaboratory';
import { useInvoices } from '../../hooks/useBilling';
import type { Appointment } from '../../services/appointmentService';
import type { OpdVisit, Prescription } from '../../services/opdService';
import type { Admission } from '../../services/ipdService';
import type { LabRequest } from '../../services/laboratoryService';
import type { Invoice } from '../../services/billingService';

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

const tabs = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'appointments', label: 'Appointments', icon: Calendar },
  { id: 'opd', label: 'OPD Visits', icon: FileText },
  { id: 'ipd', label: 'IPD Admissions', icon: BedDouble },
  { id: 'lab', label: 'Lab Results', icon: TestTube },
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: patientData, isLoading } = usePatient(id);
  const deleteMutation = useDeletePatient();

  const patient = patientData?.data;

  const handleDelete = () => {
    if (!id) return;
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        navigate('/patients');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" className="min-h-[400px]" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Patient Not Found</h2>
          <p className="text-gray-500 mt-2">The patient you are looking for does not exist.</p>
          <button
            onClick={() => navigate('/patients')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Back to Patients
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title={`${patient.first_name} ${patient.last_name}`}
        subtitle={`Patient # ${patient.patient_number}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/patients')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              onClick={() => navigate(`/patients/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              <Edit2 size={16} />
              Edit
            </button>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        }
      />

      {/* Patient Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Avatar & Basic Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-blue-600">
                {patient.first_name[0]}
                {patient.last_name[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {patient.first_name} {patient.last_name}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={patient.status} />
                <span className="text-sm text-gray-500">
                  {patient.gender && (
                    <span className="capitalize">{patient.gender}</span>
                  )}
                  {patient.date_of_birth && (
                    <span>
                      {patient.gender ? ' | ' : ''}
                      {calculateAge(patient.date_of_birth)} years old
                    </span>
                  )}
                  {patient.blood_group && (
                    <span> | Blood: {patient.blood_group}</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Contact Info */}
          <div className="flex flex-wrap gap-4 lg:ml-auto">
            {patient.phone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={14} className="text-gray-400" />
                {patient.phone}
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400" />
                {patient.email}
              </div>
            )}
            {patient.city && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400" />
                {patient.city}
                {patient.state ? `, ${patient.state}` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab patient={patient} />}
      {activeTab === 'appointments' && <AppointmentsTab patientId={patient.id} />}
      {activeTab === 'opd' && <OpdTab patientId={patient.id} />}
      {activeTab === 'ipd' && <IpdTab patientId={patient.id} />}
      {activeTab === 'lab' && <LabTab patientId={patient.id} />}
      {activeTab === 'prescriptions' && <PrescriptionsTab patientId={patient.id} />}
      {activeTab === 'billing' && <BillingTab patientId={patient.id} />}

      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete Patient"
        message={`Are you sure you want to delete ${patient.first_name} ${patient.last_name}? This action cannot be undone and will remove all associated records.`}
        confirmLabel="Delete Patient"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

/* ---------- Overview Tab ---------- */
function OverviewTab({ patient }: { patient: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Personal Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User size={18} className="text-gray-400" />
          Personal Details
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DetailRow label="Full Name" value={`${patient.first_name} ${patient.last_name}`} />
          <DetailRow label="Date of Birth" value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : '—'} />
          <DetailRow label="Gender" value={patient.gender} capitalize />
          <DetailRow label="Blood Group" value={patient.blood_group || '—'} />
          <DetailRow label="Patient Number" value={patient.patient_number} />
          <DetailRow label="Status" value={patient.status} capitalize />
        </dl>
      </div>

      {/* Contact Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Phone size={18} className="text-gray-400" />
          Contact Information
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DetailRow label="Phone" value={patient.phone || '—'} />
          <DetailRow label="Email" value={patient.email || '—'} />
          <DetailRow label="Address" value={[patient.address_line1, patient.address_line2].filter(Boolean).join(', ') || '—'} />
          <DetailRow label="City" value={patient.city || '—'} />
          <DetailRow label="State" value={patient.state || '—'} />
          <DetailRow label="ZIP Code" value={patient.zip_code || '—'} />
        </dl>
      </div>

      {/* Emergency Contact */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Heart size={18} className="text-gray-400" />
          Emergency Contact
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DetailRow label="Name" value={patient.emergency_contact_name || '—'} />
          <DetailRow label="Phone" value={patient.emergency_contact_phone || '—'} />
        </dl>
      </div>

      {/* Insurance */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield size={18} className="text-gray-400" />
          Insurance
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <DetailRow label="Provider" value={patient.insurance_provider || '—'} />
          <DetailRow label="Policy Number" value={patient.insurance_policy_number || '—'} />
        </dl>
      </div>

      {/* Medical Notes */}
      {patient.allergies && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="text-gray-400" />
            Medical Information
          </h3>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Allergies</p>
            <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
              {patient.allergies}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  capitalize: cap,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm text-gray-900 ${cap ? 'capitalize' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

/* ---------- History Tabs ---------- */
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : '—');
const formatMoney = (value?: number | string | null) =>
  `${currencySymbol()} ${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const HISTORY_LIMIT = 10;

function useTabPage() {
  return useState(1);
}

function AppointmentsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useTabPage();
  const { data, isLoading } = useAppointments({ patient_id: patientId, page, limit: HISTORY_LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'appointment_number', label: 'Appt #' },
        {
          key: 'doctor',
          label: 'Doctor',
          render: (a: Appointment) => (a.doctor?.user?.full_name ? `Dr. ${a.doctor.user.full_name}` : '—'),
        },
        { key: 'appointment_date', label: 'Date', render: (a: Appointment) => formatDate(a.appointment_date) },
        { key: 'start_time', label: 'Time', render: (a: Appointment) => a.start_time?.slice(0, 5) },
        { key: 'type', label: 'Type', render: (a: Appointment) => <span className="capitalize">{a.type.replace(/_/g, ' ')}</span> },
        { key: 'status', label: 'Status', render: (a: Appointment) => <StatusBadge status={a.status} /> },
      ]}
      data={data?.data ?? []}
      totalItems={data?.meta?.total ?? 0}
      page={page}
      limit={HISTORY_LIMIT}
      onPageChange={setPage}
      loading={isLoading}
      onRowClick={(a: Appointment) => navigate(`/appointments/${a.id}`)}
      emptyMessage="No appointments found for this patient."
    />
  );
}

function OpdTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useTabPage();
  const { data, isLoading } = useOpdVisits({ patient_id: patientId, page, limit: HISTORY_LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'visit_number', label: 'Visit #' },
        { key: 'doctor_name', label: 'Doctor', render: (v: OpdVisit) => (v.doctor_name ? `Dr. ${v.doctor_name}` : '—') },
        { key: 'visit_date', label: 'Date', render: (v: OpdVisit) => formatDate(v.visit_date) },
        { key: 'diagnosis', label: 'Diagnosis', render: (v: OpdVisit) => v.diagnosis || '—' },
        { key: 'status', label: 'Status', render: (v: OpdVisit) => <StatusBadge status={v.status} /> },
      ]}
      data={data?.data ?? []}
      totalItems={data?.meta?.total ?? 0}
      page={page}
      limit={HISTORY_LIMIT}
      onPageChange={setPage}
      loading={isLoading}
      onRowClick={(v: OpdVisit) => navigate(`/opd/${v.id}`)}
      emptyMessage="No OPD visits found for this patient."
    />
  );
}

function IpdTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useTabPage();
  const { data, isLoading } = useAdmissions({ patient_id: patientId, page, limit: HISTORY_LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'admission_number', label: 'Admission #' },
        { key: 'ward_name', label: 'Ward', render: (a: Admission) => a.ward_name || '—' },
        { key: 'bed_number', label: 'Bed', render: (a: Admission) => a.bed_number || '—' },
        { key: 'admission_date', label: 'Admitted', render: (a: Admission) => formatDate(a.admission_date) },
        { key: 'discharge_date', label: 'Discharged', render: (a: Admission) => formatDate(a.discharge_date) },
        { key: 'status', label: 'Status', render: (a: Admission) => <StatusBadge status={a.status} /> },
      ]}
      data={data?.data ?? []}
      totalItems={data?.meta?.total ?? 0}
      page={page}
      limit={HISTORY_LIMIT}
      onPageChange={setPage}
      loading={isLoading}
      onRowClick={(a: Admission) => navigate(`/ipd/admissions/${a.id}`)}
      emptyMessage="No IPD admissions found for this patient."
    />
  );
}

function LabTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useTabPage();
  const { data, isLoading } = useLabRequests({ patient_id: patientId, page, limit: HISTORY_LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'request_number', label: 'Request #' },
        {
          key: 'tests',
          label: 'Tests',
          render: (r: LabRequest) => r.items.map((i) => i.test_name || i.test_code).filter(Boolean).join(', ') || '—',
        },
        { key: 'created_at', label: 'Date', render: (r: LabRequest) => formatDate(r.created_at) },
        {
          key: 'results',
          label: 'Results',
          render: (r: LabRequest) => (
            <div className="space-y-0.5">
              {r.items.map((i) => (
                <div key={i.id} className="text-xs">
                  <span className="text-gray-500">{i.test_name || i.test_code}:</span>{' '}
                  {i.result_value ? (
                    <span className={i.result_status === 'normal' ? 'text-gray-900' : 'text-red-600 font-medium'}>
                      {i.result_value} {i.unit ?? ''}
                    </span>
                  ) : (
                    <span className="text-gray-400">pending</span>
                  )}
                </div>
              ))}
            </div>
          ),
        },
        { key: 'status', label: 'Status', render: (r: LabRequest) => <StatusBadge status={r.status} /> },
      ]}
      data={data?.data ?? []}
      totalItems={data?.meta?.total ?? 0}
      page={page}
      limit={HISTORY_LIMIT}
      onPageChange={setPage}
      loading={isLoading}
      emptyMessage="No lab results found for this patient."
    />
  );
}

function PrescriptionsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useTabPage();
  const { data, isLoading } = usePrescriptions({ patient_id: patientId, page, limit: HISTORY_LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'prescription_number', label: 'Rx #' },
        { key: 'doctor_name', label: 'Prescribed By', render: (p: Prescription) => (p.doctor_name ? `Dr. ${p.doctor_name}` : '—') },
        { key: 'created_at', label: 'Date', render: (p: Prescription) => formatDate(p.created_at) },
        {
          key: 'medications',
          label: 'Medications',
          render: (p: Prescription) => (
            <div className="space-y-0.5">
              {p.items.map((i, idx) => (
                <div key={i.id ?? idx} className="text-xs">
                  <span className="font-medium text-gray-900">{i.medicine_name}</span>{' '}
                  <span className="text-gray-500">
                    {i.dosage} · {i.frequency} · {i.duration}
                  </span>
                </div>
              ))}
            </div>
          ),
        },
        { key: 'status', label: 'Status', render: (p: Prescription) => <StatusBadge status={p.status} /> },
      ]}
      data={data?.data ?? []}
      totalItems={data?.meta?.total ?? 0}
      page={page}
      limit={HISTORY_LIMIT}
      onPageChange={setPage}
      loading={isLoading}
      onRowClick={(p: Prescription) => p.opd_visit_id && navigate(`/opd/${p.opd_visit_id}`)}
      emptyMessage="No prescriptions found for this patient."
    />
  );
}

function BillingTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useTabPage();
  const { data, isLoading } = useInvoices({ patient_id: patientId, page, limit: HISTORY_LIMIT });
  return (
    <DataTable
      columns={[
        { key: 'invoice_number', label: 'Invoice #' },
        { key: 'created_at', label: 'Date', render: (i: Invoice) => formatDate(i.created_at) },
        { key: 'total_amount', label: 'Total', render: (i: Invoice) => formatMoney(i.total_amount) },
        { key: 'paid_amount', label: 'Paid', render: (i: Invoice) => <span className="text-green-600">{formatMoney(i.paid_amount)}</span> },
        {
          key: 'due_amount',
          label: 'Balance',
          render: (i: Invoice) => (
            <span className={Number(i.due_amount) > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
              {formatMoney(i.due_amount)}
            </span>
          ),
        },
        { key: 'status', label: 'Status', render: (i: Invoice) => <StatusBadge status={i.status} /> },
      ]}
      data={data?.data ?? []}
      totalItems={data?.meta?.total ?? 0}
      page={page}
      limit={HISTORY_LIMIT}
      onPageChange={setPage}
      loading={isLoading}
      onRowClick={(i: Invoice) => navigate(`/billing/${i.id}`)}
      emptyMessage="No billing records found for this patient."
    />
  );
}
