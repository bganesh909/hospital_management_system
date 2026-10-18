import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Stethoscope,
  CalendarDays,
  ClipboardList,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SearchInput } from '../../components/shared/SearchInput';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useDepartments, useAvailableDoctors } from '../../hooks/useDoctors';
import { useAppointmentSlots, useCreateAppointment } from '../../hooks/useAppointments';
import { useSearchPatients } from '../../hooks/usePatients';
import type { Patient } from '../../services/patientService';
import type { Doctor } from '../../services/doctorService';
import type { AppointmentType, TimeSlot } from '../../services/appointmentService';

const STEPS = [
  { id: 1, label: 'Doctor', icon: Stethoscope },
  { id: 2, label: 'Schedule', icon: CalendarDays },
  { id: 3, label: 'Details', icon: ClipboardList },
  { id: 4, label: 'Confirm', icon: Check },
];

const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'emergency', label: 'Emergency' },
];

export default function BookAppointmentForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  // Step 2
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 3
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('consultation');
  const [reason, setReason] = useState('');

  const { data: deptData } = useDepartments();
  const departments = deptData?.data ?? [];

  const { data: doctorsData, isLoading: loadingDoctors } = useAvailableDoctors(
    selectedDepartment || undefined,
  );
  const availableDoctors: Doctor[] = doctorsData?.data ?? [];

  const { data: slotsData, isLoading: loadingSlots } = useAppointmentSlots(
    selectedDoctor?.id || '',
    selectedDate,
  );
  const slots: TimeSlot[] = slotsData?.data ?? [];

  const { data: patientResults, isLoading: searchingPatients } =
    useSearchPatients(patientSearch);
  const foundPatients: Patient[] = patientResults?.data ?? [];

  const createMutation = useCreateAppointment();

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!selectedDoctor;
      case 2:
        return !!selectedDate && !!selectedSlot;
      case 3:
        return !!selectedPatient && !!appointmentType;
      default:
        return true;
    }
  };

  const handleBook = () => {
    if (!selectedDoctor || !selectedPatient || !selectedDate || !selectedSlot)
      return;

    createMutation.mutate(
      {
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctor.id,
        appointment_date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        type: appointmentType,
        reason: reason || undefined,
      },
      {
        onSuccess: () => navigate('/appointments'),
      },
    );
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Book Appointment"
        subtitle="Schedule a new appointment for a patient"
        actions={
          <button
            onClick={() => navigate('/appointments')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Appointments
          </button>
        }
      />

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`w-8 sm:w-16 h-0.5 mx-1 ${
                      isCompleted ? 'bg-green-400' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Step 1: Select Department + Doctor */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Select Department & Doctor
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => {
                  setSelectedDepartment(e.target.value);
                  setSelectedDoctor(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a Doctor
              </label>
              {loadingDoctors ? (
                <LoadingSpinner size="sm" className="py-8" />
              ) : availableDoctors.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No available doctors found. Try selecting a different department.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {availableDoctors.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDoctor(doc)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selectedDoctor?.id === doc.id
                          ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-semibold text-gray-900">
                        Dr. {doc.user?.full_name || '—'}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {doc.specialization}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {doc.experience_years} yrs exp
                        </span>
                        <span className="text-sm font-medium text-green-700">
                          ${doc.consultation_fee?.toFixed(2)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Date + Slot */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Select Date & Time
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Appointment Date
              </label>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot(null);
                }}
                className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {selectedDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Available Time Slots
                </label>
                {loadingSlots ? (
                  <LoadingSpinner size="sm" className="py-8" />
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No slots available for this date. Try another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.start_time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium text-center transition-all ${
                          selectedSlot?.start_time === slot.start_time
                            ? 'bg-blue-600 text-white ring-1 ring-blue-600'
                            : slot.available
                              ? 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                        }`}
                      >
                        {slot.start_time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Patient + Details */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Patient & Appointment Details
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Patient
              </label>
              <SearchInput
                value={patientSearch}
                onChange={setPatientSearch}
                placeholder="Search by name, phone, or patient number..."
              />
              {searchingPatients && (
                <LoadingSpinner size="sm" className="py-4" />
              )}
              {patientSearch.length >= 2 && foundPatients.length > 0 && !selectedPatient && (
                <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {foundPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientSearch('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {p.first_name} {p.last_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.patient_number} | {p.phone}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </p>
                    <p className="text-xs text-blue-700">
                      {selectedPatient.patient_number} | {selectedPatient.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Appointment Type
                </label>
                <select
                  value={appointmentType}
                  onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason / Notes
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for the appointment..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Confirm Appointment
            </h2>

            <div className="space-y-4">
              <SummaryRow
                icon={<Stethoscope size={18} className="text-blue-500" />}
                label="Doctor"
                value={`Dr. ${selectedDoctor?.user?.full_name || '—'} - ${selectedDoctor?.specialization || ''}`}
              />
              <SummaryRow
                icon={<CalendarDays size={18} className="text-green-500" />}
                label="Date & Time"
                value={`${selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—'} at ${selectedSlot?.start_time || '—'}`}
              />
              <SummaryRow
                icon={<ClipboardList size={18} className="text-purple-500" />}
                label="Patient"
                value={
                  selectedPatient
                    ? `${selectedPatient.first_name} ${selectedPatient.last_name} (${selectedPatient.patient_number})`
                    : '—'
                }
              />
              <SummaryRow
                icon={<Building2 size={18} className="text-amber-500" />}
                label="Type"
                value={
                  APPOINTMENT_TYPES.find((t) => t.value === appointmentType)
                    ?.label || appointmentType
                }
              />
              {reason && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                    Reason
                  </p>
                  <p className="text-sm text-gray-700">{reason}</p>
                </div>
              )}
              {!!selectedDoctor?.consultation_fee && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Consultation Fee
                    </span>
                    <span className="text-lg font-bold text-green-700">
                      ${selectedDoctor.consultation_fee.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={() => (step === 1 ? navigate('/appointments') : setStep(step - 1))}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft size={16} />
            {step === 1 ? 'Cancel' : 'Previous'}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBook}
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Check size={16} />
              {createMutation.isPending ? 'Booking...' : 'Confirm & Book'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}
