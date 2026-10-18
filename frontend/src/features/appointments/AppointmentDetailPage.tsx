import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, ArrowLeft, CalendarClock, Stethoscope, User, XCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input } from '../../components/shared/FormField';
import {
  useAppointment,
  useAppointmentSlots,
  useCancelAppointment,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
} from '../../hooks/useAppointments';
import type { Appointment, AppointmentStatus, TimeSlot } from '../../services/appointmentService';

// Allowed next statuses from each state (cancel is handled separately)
const NEXT_STATUSES: Partial<Record<AppointmentStatus, { value: AppointmentStatus; label: string }[]>> = {
  scheduled: [
    { value: 'confirmed', label: 'Confirm' },
    { value: 'in_progress', label: 'Check In' },
    { value: 'no_show', label: 'No Show' },
  ],
  confirmed: [
    { value: 'in_progress', label: 'Check In' },
    { value: 'no_show', label: 'No Show' },
  ],
  in_progress: [{ value: 'completed', label: 'Complete' }],
};

const isOpen = (status: AppointmentStatus) => status === 'scheduled' || status === 'confirmed';

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAppointment(id);
  const appointment: Appointment | undefined = data?.data;
  const updateStatus = useUpdateAppointmentStatus();

  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" className="min-h-[400px]" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-6 text-center py-12">
        <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Appointment Not Found</h2>
        <button
          onClick={() => navigate('/appointments')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Back to Appointments
        </button>
      </div>
    );
  }

  const patientName = appointment.patient
    ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
    : '—';
  const doctorName = appointment.doctor?.user?.full_name ? `Dr. ${appointment.doctor.user.full_name}` : '—';
  const transitions = NEXT_STATUSES[appointment.status] ?? [];

  return (
    <div className="p-6">
      <PageHeader
        title={`Appointment ${appointment.appointment_number}`}
        subtitle={`${format(new Date(`${appointment.appointment_date}T00:00:00`), 'EEEE, d MMM yyyy')} at ${appointment.start_time.slice(0, 5)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/appointments')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            {transitions.map((t) => (
              <button
                key={t.value}
                disabled={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: appointment.id, status: t.value })}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {t.label}
              </button>
            ))}
            {isOpen(appointment.status) && (
              <>
                <button
                  onClick={() => setShowReschedule(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  <CalendarClock size={16} />
                  Reschedule
                </button>
                <button
                  onClick={() => setShowCancel(true)}
                  className="flex items-center gap-2 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  <XCircle size={16} />
                  Cancel
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card icon={User} title="Patient">
          <Row label="Name" value={patientName} />
          <Row label="Patient #" value={appointment.patient?.patient_number} />
          <Row label="Phone" value={appointment.patient?.phone} />
          <button
            onClick={() => navigate(`/patients/${appointment.patient_id}`)}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            View patient record
          </button>
        </Card>
        <Card icon={Stethoscope} title="Doctor">
          <Row label="Name" value={doctorName} />
          <Row label="Specialization" value={appointment.doctor?.specialization} />
        </Card>
        <Card icon={CalendarClock} title="Appointment">
          <div className="mb-2">
            <StatusBadge status={appointment.status} />
          </div>
          <Row
            label="Time"
            value={`${appointment.start_time.slice(0, 5)}${appointment.end_time ? ` – ${appointment.end_time.slice(0, 5)}` : ''}`}
          />
          <Row label="Type" value={appointment.type.replace(/_/g, ' ')} />
          <Row label="Reason" value={appointment.reason} />
          <Row label="Notes" value={appointment.notes} />
          {appointment.status === 'cancelled' && (
            <Row label="Cancellation Reason" value={appointment.cancelled_reason} />
          )}
        </Card>
      </div>

      {showCancel && <CancelModal appointment={appointment} onClose={() => setShowCancel(false)} />}
      {showReschedule && (
        <RescheduleModal appointment={appointment} onClose={() => setShowReschedule(false)} />
      )}
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
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

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function CancelModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const cancel = useCancelAppointment();
  const [reason, setReason] = useState('');

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancel Appointment"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Keep Appointment
          </button>
          <button
            disabled={!reason.trim() || cancel.isPending}
            onClick={() => cancel.mutate({ id: appointment.id, reason: reason.trim() }, { onSuccess: onClose })}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {cancel.isPending ? 'Cancelling...' : 'Cancel Appointment'}
          </button>
        </div>
      }
    >
      <FormField label="Reason" required>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </FormField>
    </Modal>
  );
}

function RescheduleModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const update = useUpdateAppointment();
  const [date, setDate] = useState(appointment.appointment_date);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const { data, isLoading } = useAppointmentSlots(appointment.doctor_id, date);
  const slots: TimeSlot[] = data?.data ?? [];
  const today = format(new Date(), 'yyyy-MM-dd');

  const isCurrentSlot = (s: TimeSlot) =>
    date === appointment.appointment_date && s.start_time === appointment.start_time.slice(0, 5);

  const handleSave = () => {
    if (!slot) return;
    update.mutate(
      {
        id: appointment.id,
        data: { appointment_date: date, start_time: slot.start_time, end_time: slot.end_time },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Reschedule Appointment"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
          <button
            disabled={!slot || update.isPending}
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {update.isPending ? 'Saving...' : 'Reschedule'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="New Date" required>
          <Input
            type="date"
            min={today}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot(null);
            }}
          />
        </FormField>
        <FormField label="Available Slots" required>
          {isLoading ? (
            <LoadingSpinner />
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500">The doctor has no schedule on this day.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => {
                const disabled = !s.available || isCurrentSlot(s);
                const selected = slot?.start_time === s.start_time;
                return (
                  <button
                    key={s.start_time}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSlot(s)}
                    className={`px-2 py-2 text-sm rounded-lg border ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : disabled
                          ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {s.start_time}
                  </button>
                );
              })}
            </div>
          )}
        </FormField>
      </div>
    </Modal>
  );
}
