import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Heart,
  Thermometer,
  Activity,
  Wind,
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { SearchInput } from '../../components/shared/SearchInput';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { useOpdVisit, useCreateVisit, useUpdateVisit, useCompleteVisit, useCreatePrescription } from '../../hooks/useOpd';
import api from '../../config/api';
import { useAppointments } from '../../hooks/useAppointments';
import type { Appointment } from '../../services/appointmentService';

const prescriptionItemSchema = z.object({
  medicine_name: z.string().min(1, 'Medicine name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  duration: z.string().min(1, 'Duration is required'),
  instructions: z.string().optional(),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
});

// Empty number inputs submit '' — treat them as "not entered" instead of 0
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional(),
);

const visitSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  doctor_id: z.string().min(1, 'Doctor is required'),
  appointment_id: z.string().optional(),
  bp_systolic: optionalNumber,
  bp_diastolic: optionalNumber,
  vitals_temp: optionalNumber,
  vitals_pulse: optionalNumber,
  vitals_weight: optionalNumber,
  vitals_height: optionalNumber,
  vitals_spo2: optionalNumber,
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  treatment_plan: z.string().optional(),
  follow_up_date: z.string().optional(),
  prescriptions: z.array(prescriptionItemSchema).optional(),
});

type VisitFormData = z.infer<typeof visitSchema>;

interface PatientOption {
  id: string;
  full_name: string;
  phone?: string;
}

interface DoctorOption {
  id: string;
  full_name: string;
  specialization?: string;
}

const blankToUndefined = (v?: string) => (v && v.trim() ? v : undefined);

function toPatientOption(p: any): PatientOption {
  return { id: p.id, full_name: `${p.first_name} ${p.last_name}`, phone: p.phone };
}

function toDoctorOption(d: any): DoctorOption {
  const name =
    d.user?.full_name ??
    d.full_name ??
    d.doctor_name ??
    ([d.first_name, d.last_name].filter(Boolean).join(' ') || d.specialization);
  return { id: d.id, full_name: name, specialization: d.specialization };
}

function parseBp(bp?: string | null): { bp_systolic?: number; bp_diastolic?: number } {
  const match = bp?.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  return match ? { bp_systolic: Number(match[1]), bp_diastolic: Number(match[2]) } : {};
}

export default function OpdVisitForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: visitResponse, isLoading: visitLoading } = useOpdVisit(id || '');
  const visit = visitResponse?.data;

  const createVisit = useCreateVisit();
  const updateVisit = useUpdateVisit();
  const completeVisit = useCompleteVisit();
  const createPrescription = useCreatePrescription();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  const { data: patientAppointments } = useAppointments(
    { patient_id: selectedPatient?.id, limit: 50 },
  );
  const appointmentOptions = selectedPatient
    ? (patientAppointments?.data ?? [])
        .filter((a: Appointment) => a.status !== 'cancelled' && a.status !== 'no_show')
        .map((a: Appointment) => ({
          value: a.id,
          label: `${a.appointment_number} · ${a.appointment_date} ${a.start_time?.slice(0, 5) ?? ''}`,
        }))
    : [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormData>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      prescriptions: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'prescriptions',
  });

  // Load existing visit data
  useEffect(() => {
    if (visit && isEditing) {
      reset({
        patient_id: visit.patient_id,
        doctor_id: visit.doctor_id,
        appointment_id: visit.appointment_id || '',
        ...parseBp(visit.vitals_bp),
        vitals_temp: visit.vitals_temp ?? undefined,
        vitals_pulse: visit.vitals_pulse ?? undefined,
        vitals_weight: visit.vitals_weight ?? undefined,
        vitals_height: visit.vitals_height ?? undefined,
        vitals_spo2: visit.vitals_spo2 ?? undefined,
        symptoms: visit.symptoms || '',
        diagnosis: visit.diagnosis || '',
        treatment_plan: visit.treatment_plan || '',
        follow_up_date: visit.follow_up_date || '',
        prescriptions: [],
      });
      setSelectedPatient({ id: visit.patient_id, full_name: visit.patient_name ?? 'Patient' });
      setSelectedDoctor({ id: visit.doctor_id, full_name: visit.doctor_name ?? 'Doctor' });
    }
  }, [visit, isEditing, reset]);

  // Search patients
  useEffect(() => {
    if (patientSearch.length >= 2) {
      api.get('/patients/search', { params: { q: patientSearch, limit: 10 } })
        .then(res => setPatients((res.data?.data || []).map(toPatientOption)))
        .catch(() => setPatients([]));
    }
  }, [patientSearch]);

  // Load doctors once and filter locally
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  useEffect(() => {
    api.get('/doctors', { params: { limit: 100 } })
      .then(res => setAllDoctors((res.data?.data || []).map(toDoctorOption)))
      .catch(() => setAllDoctors([]));
  }, []);

  useEffect(() => {
    const term = doctorSearch.trim().toLowerCase();
    setDoctors(
      term.length >= 2
        ? allDoctors.filter(
            (d) =>
              d.full_name?.toLowerCase().includes(term) ||
              d.specialization?.toLowerCase().includes(term),
          )
        : [],
    );
  }, [doctorSearch, allDoctors]);

  const onSubmit = async (data: VisitFormData, complete = false) => {
    try {
      const { prescriptions, bp_systolic, bp_diastolic, patient_id, doctor_id, appointment_id, ...rest } = data;
      const clinical = {
        symptoms: blankToUndefined(rest.symptoms),
        diagnosis: blankToUndefined(rest.diagnosis),
        treatment_plan: blankToUndefined(rest.treatment_plan),
        follow_up_date: blankToUndefined(rest.follow_up_date),
        vitals_bp: bp_systolic != null && bp_diastolic != null ? `${bp_systolic}/${bp_diastolic}` : undefined,
        vitals_temp: rest.vitals_temp,
        vitals_pulse: rest.vitals_pulse,
        vitals_weight: rest.vitals_weight,
        vitals_height: rest.vitals_height,
        vitals_spo2: rest.vitals_spo2,
      };
      let visitId = id;

      if (isEditing) {
        await updateVisit.mutateAsync({ id: id!, data: clinical });
      } else {
        const result = await createVisit.mutateAsync({
          ...clinical,
          patient_id,
          doctor_id,
          appointment_id: blankToUndefined(appointment_id),
        });
        visitId = result?.data?.id;
      }

      // Create prescription if items exist
      if (prescriptions && prescriptions.length > 0 && visitId) {
        await createPrescription.mutateAsync({
          opd_visit_id: visitId,
          patient_id,
          doctor_id,
          items: prescriptions.map((item) => ({
            ...item,
            instructions: blankToUndefined(item.instructions),
          })),
        });
      }

      if (complete && visitId) {
        await completeVisit.mutateAsync(visitId);
      }

      navigate('/opd');
    } catch {
      // errors handled by mutation hooks
    }
  };

  if (isEditing && visitLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isCompleted = visit?.status === 'completed';

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditing ? `Edit Visit ${visit?.visit_number || ''}` : 'New OPD Visit'}
        subtitle={isEditing ? 'Update visit details and add prescriptions' : 'Record a new outpatient visit'}
        actions={
          <button
            onClick={() => navigate('/opd')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />

      <form onSubmit={handleSubmit((data) => onSubmit(data, false))} className="space-y-6">
        {/* Patient & Doctor Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Visit Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Patient Selector */}
            <FormField label="Patient" required error={errors.patient_id?.message}>
              <div className="relative">
                {selectedPatient ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="flex-1 text-sm font-medium">{selectedPatient.full_name}</span>
                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatient(null);
                          setValue('patient_id', '');
                          setPatientSearch('');
                        }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <SearchInput
                      value={patientSearch}
                      onChange={(v) => {
                        setPatientSearch(v);
                        setShowPatientDropdown(true);
                      }}
                      placeholder="Search patient by name or ID..."
                      debounceMs={400}
                    />
                    {showPatientDropdown && patients.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {patients.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                            onClick={() => {
                              setSelectedPatient(p);
                              setValue('patient_id', p.id);
                              setShowPatientDropdown(false);
                            }}
                          >
                            <p className="font-medium text-gray-900">{p.full_name}</p>
                            {p.phone && <p className="text-xs text-gray-500">{p.phone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </FormField>

            {/* Doctor Selector */}
            <FormField label="Doctor" required error={errors.doctor_id?.message}>
              <div className="relative">
                {selectedDoctor ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="flex-1 text-sm font-medium">{selectedDoctor.full_name}</span>
                    {selectedDoctor.specialization && (
                      <span className="text-xs text-gray-500">{selectedDoctor.specialization}</span>
                    )}
                    {!isCompleted && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDoctor(null);
                          setValue('doctor_id', '');
                          setDoctorSearch('');
                        }}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <SearchInput
                      value={doctorSearch}
                      onChange={(v) => {
                        setDoctorSearch(v);
                        setShowDoctorDropdown(true);
                      }}
                      placeholder="Search doctor..."
                      debounceMs={400}
                    />
                    {showDoctorDropdown && doctors.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {doctors.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                            onClick={() => {
                              setSelectedDoctor(d);
                              setValue('doctor_id', d.id);
                              setShowDoctorDropdown(false);
                            }}
                          >
                            <p className="font-medium text-gray-900">{d.full_name}</p>
                            {d.specialization && (
                              <p className="text-xs text-gray-500">{d.specialization}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </FormField>

            {/* Appointment Link */}
            <FormField label="Linked Appointment (optional)">
              <Select
                {...register('appointment_id')}
                options={appointmentOptions}
                placeholder={selectedPatient ? 'No linked appointment' : 'Select a patient first'}
                disabled={isCompleted || !selectedPatient}
              />
            </FormField>
          </div>
        </div>

        {/* Vitals Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Heart size={20} className="text-red-500" />
            Vitals
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <FormField label="BP Systolic (mmHg)">
              <div className="relative">
                <Activity size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
                <Input
                  type="number"
                  {...register('bp_systolic')}
                  placeholder="120"
                  className="pl-9"
                  disabled={isCompleted}
                />
              </div>
            </FormField>
            <FormField label="BP Diastolic (mmHg)">
              <div className="relative">
                <Activity size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400" />
                <Input
                  type="number"
                  {...register('bp_diastolic')}
                  placeholder="80"
                  className="pl-9"
                  disabled={isCompleted}
                />
              </div>
            </FormField>
            <FormField label="Temperature (F)">
              <div className="relative">
                <Thermometer size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                <Input
                  type="number"
                  step="0.1"
                  {...register('vitals_temp')}
                  placeholder="98.6"
                  className="pl-9"
                  disabled={isCompleted}
                />
              </div>
            </FormField>
            <FormField label="Pulse (bpm)">
              <div className="relative">
                <Heart size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400" />
                <Input
                  type="number"
                  {...register('vitals_pulse')}
                  placeholder="72"
                  className="pl-9"
                  disabled={isCompleted}
                />
              </div>
            </FormField>
            <FormField label="Weight (kg)">
              <Input
                type="number"
                step="0.1"
                {...register('vitals_weight')}
                placeholder="70"
                disabled={isCompleted}
              />
            </FormField>
            <FormField label="Height (cm)">
              <Input
                type="number"
                step="0.1"
                {...register('vitals_height')}
                placeholder="170"
                disabled={isCompleted}
              />
            </FormField>
            <FormField label="SpO2 (%)">
              <div className="relative">
                <Wind size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" />
                <Input
                  type="number"
                  {...register('vitals_spo2')}
                  placeholder="98"
                  className="pl-9"
                  disabled={isCompleted}
                />
              </div>
            </FormField>
          </div>
        </div>

        {/* Clinical Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Details</h3>
          <div className="space-y-4">
            <FormField label="Symptoms / Chief Complaints">
              <Textarea
                {...register('symptoms')}
                placeholder="Describe symptoms reported by the patient..."
                rows={3}
                disabled={isCompleted}
              />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Diagnosis">
                <Textarea
                  {...register('diagnosis')}
                  placeholder="Clinical diagnosis..."
                  rows={2}
                  disabled={isCompleted}
                />
              </FormField>
              <FormField label="Treatment Plan">
                <Textarea
                  {...register('treatment_plan')}
                  placeholder="Recommended treatment..."
                  rows={2}
                  disabled={isCompleted}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Follow-up Date">
                <Input
                  type="date"
                  {...register('follow_up_date')}
                  disabled={isCompleted}
                />
              </FormField>
            </div>
          </div>
        </div>

        {/* Prescription Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Prescription</h3>
            {!isCompleted && (
              <button
                type="button"
                onClick={() =>
                  append({
                    medicine_name: '',
                    dosage: '',
                    frequency: '',
                    duration: '',
                    instructions: '',
                    quantity: 1,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus size={14} />
                Add Medicine
              </button>
            )}
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No medicines added yet.</p>
              {!isCompleted && (
                <p className="text-xs mt-1">Click "Add Medicine" to start a prescription.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="col-span-12 sm:col-span-3">
                    <FormField
                      label="Medicine"
                      required
                      error={errors.prescriptions?.[index]?.medicine_name?.message}
                    >
                      <Input
                        {...register(`prescriptions.${index}.medicine_name`)}
                        placeholder="Medicine name"
                        error={!!errors.prescriptions?.[index]?.medicine_name}
                        disabled={isCompleted}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <FormField
                      label="Dosage"
                      required
                      error={errors.prescriptions?.[index]?.dosage?.message}
                    >
                      <Input
                        {...register(`prescriptions.${index}.dosage`)}
                        placeholder="e.g. 500mg"
                        error={!!errors.prescriptions?.[index]?.dosage}
                        disabled={isCompleted}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <FormField
                      label="Frequency"
                      required
                      error={errors.prescriptions?.[index]?.frequency?.message}
                    >
                      <Select
                        {...register(`prescriptions.${index}.frequency`)}
                        options={[
                          { value: 'OD', label: 'Once daily' },
                          { value: 'BD', label: 'Twice daily' },
                          { value: 'TDS', label: 'Thrice daily' },
                          { value: 'QID', label: 'Four times daily' },
                          { value: 'SOS', label: 'As needed' },
                          { value: 'HS', label: 'At bedtime' },
                          { value: 'STAT', label: 'Immediately' },
                        ]}
                        placeholder="Select"
                        error={!!errors.prescriptions?.[index]?.frequency}
                        disabled={isCompleted}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <FormField
                      label="Duration"
                      required
                      error={errors.prescriptions?.[index]?.duration?.message}
                    >
                      <Input
                        {...register(`prescriptions.${index}.duration`)}
                        placeholder="5 days"
                        error={!!errors.prescriptions?.[index]?.duration}
                        disabled={isCompleted}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <FormField
                      label="Qty"
                      required
                      error={errors.prescriptions?.[index]?.quantity?.message}
                    >
                      <Input
                        type="number"
                        {...register(`prescriptions.${index}.quantity`)}
                        placeholder="10"
                        error={!!errors.prescriptions?.[index]?.quantity}
                        disabled={isCompleted}
                      />
                    </FormField>
                  </div>
                  <div className="col-span-12 sm:col-span-2">
                    <FormField label="Instructions">
                      <Input
                        {...register(`prescriptions.${index}.instructions`)}
                        placeholder="After food"
                        disabled={isCompleted}
                      />
                    </FormField>
                  </div>
                  {!isCompleted && (
                    <div className="col-span-12 sm:col-span-1 flex items-end pb-1">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove medicine"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!isCompleted && (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/opd')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {isSubmitting ? 'Saving...' : 'Save as In-Progress'}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit((data) => onSubmit(data, true))}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={16} />
              {isSubmitting ? 'Completing...' : 'Save & Complete'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
