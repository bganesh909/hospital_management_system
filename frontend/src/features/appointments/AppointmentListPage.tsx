import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, XCircle, ChevronDown } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SearchInput } from '../../components/shared/SearchInput';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Modal } from '../../components/shared/Modal';
import {
  useAppointments,
  useCancelAppointment,
  useUpdateAppointmentStatus,
} from '../../hooks/useAppointments';
import type { Appointment, AppointmentStatus } from '../../services/appointmentService';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

const TRANSITION_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirm' },
  { value: 'in_progress', label: 'Start' },
  { value: 'completed', label: 'Complete' },
  { value: 'no_show', label: 'No Show' },
];

export default function AppointmentListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Cancel flow
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data, isLoading } = useAppointments({
    page,
    limit: 20,
    appointment_date: dateFilter || undefined,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const cancelMutation = useCancelAppointment();
  const statusMutation = useUpdateAppointmentStatus();

  const appointments: Appointment[] = data?.data ?? [];
  const meta = data?.meta;

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const openCancelDialog = (appt: Appointment) => {
    setCancelTarget(appt);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelMutation.mutate(
      { id: cancelTarget.id, reason: cancelReason },
      {
        onSuccess: () => {
          setShowCancelModal(false);
          setCancelTarget(null);
        },
      },
    );
  };

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    statusMutation.mutate({ id, status });
  };

  const columns = [
    {
      key: 'appointment_number',
      label: 'Appt #',
      sortable: true,
      render: (a: Appointment) => (
        <span className="font-medium text-blue-600">
          {a.appointment_number}
        </span>
      ),
    },
    {
      key: 'patient',
      label: 'Patient',
      render: (a: Appointment) => (
        <div>
          <p className="font-medium text-gray-900">
            {a.patient
              ? `${a.patient.first_name} ${a.patient.last_name}`
              : '—'}
          </p>
          {a.patient?.patient_number && (
            <p className="text-xs text-gray-500">{a.patient.patient_number}</p>
          )}
        </div>
      ),
    },
    {
      key: 'doctor',
      label: 'Doctor',
      render: (a: Appointment) => (
        <div>
          <p className="text-gray-900">
            {a.doctor?.user?.full_name
              ? `Dr. ${a.doctor.user.full_name}`
              : '—'}
          </p>
          {a.doctor?.specialization && (
            <p className="text-xs text-gray-500">{a.doctor.specialization}</p>
          )}
        </div>
      ),
    },
    {
      key: 'appointment_date',
      label: 'Date',
      sortable: true,
      render: (a: Appointment) =>
        a.appointment_date
          ? new Date(a.appointment_date).toLocaleDateString()
          : '—',
    },
    {
      key: 'start_time',
      label: 'Time',
      render: (a: Appointment) => a.start_time?.slice(0, 5) || '—',
    },
    {
      key: 'type',
      label: 'Type',
      render: (a: Appointment) => (
        <span className="capitalize text-gray-700">
          {a.type?.replace(/_/g, ' ') || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (a: Appointment) => <StatusBadge status={a.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-44',
      render: (a: Appointment) => (
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {a.status !== 'cancelled' && a.status !== 'completed' && (
            <>
              <div className="relative group">
                <button className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                  Update
                  <ChevronDown size={12} />
                </button>
                <div className="absolute right-0 mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 hidden group-hover:block">
                  {TRANSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(a.id, opt.value)}
                      className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => openCancelDialog(a)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600"
                title="Cancel"
              >
                <XCircle size={16} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <PageHeader
        title="Appointments"
        subtitle="View, schedule, and manage patient appointments"
        actions={
          <button
            onClick={() => navigate('/appointments/book')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Book Appointment
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder="Search by patient or doctor..."
          className="max-w-md"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={appointments}
        totalItems={meta?.total ?? 0}
        page={page}
        limit={20}
        onPageChange={setPage}
        loading={isLoading}
        onRowClick={(a: Appointment) => navigate(`/appointments/${a.id}`)}
        emptyMessage="No appointments found."
      />

      {/* Cancel Modal */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Appointment"
        footer={
          <>
            <button
              onClick={() => setShowCancelModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Keep Appointment
            </button>
            <button
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Appointment'}
            </button>
          </>
        }
      >
        <div>
          <p className="text-sm text-gray-600 mb-4">
            You are about to cancel appointment{' '}
            <span className="font-semibold">
              {cancelTarget?.appointment_number}
            </span>
            . Please provide a reason.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cancellation Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter the reason for cancellation..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </Modal>
    </div>
  );
}
