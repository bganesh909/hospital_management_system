import { currencySymbol } from '../../lib/currency';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { SearchInput } from '../../components/shared/SearchInput';
import { useCreateAdmission, useWards, useAvailableBeds } from '../../hooks/useIpd';
import api from '../../config/api';
import type { Ward, Bed } from '../../services/ipdService';

const admissionSchema = z.object({
  patient_id: z.string().min(1, 'Patient is required'),
  doctor_id: z.string().min(1, 'Doctor is required'),
  ward_id: z.string().min(1, 'Ward is required'),
  bed_id: z.string().min(1, 'Bed is required'),
  reason: z.string().min(1, 'Reason for admission is required'),
  diagnosis: z.string().optional(),
});

type AdmissionFormData = z.infer<typeof admissionSchema>;

interface PatientOption {
  id: string;
  patient_number?: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

interface DoctorOption {
  id: string;
  full_name?: string;
  user?: { full_name?: string };
  first_name?: string;
  last_name?: string;
  specialization?: string;
}

const patientLabel = (p: PatientOption) => `${p.first_name} ${p.last_name}`;
const doctorLabel = (d: DoctorOption) =>
  d.user?.full_name || d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || d.specialization || 'Doctor';

export default function AdmissionForm() {
  const navigate = useNavigate();
  const createAdmission = useCreateAdmission();

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [allDoctors, setAllDoctors] = useState<DoctorOption[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientOption | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorOption | null>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);
  const [selectedWardId, setSelectedWardId] = useState('');

  const { data: wardsResponse } = useWards();
  const wards: Ward[] = wardsResponse?.data || [];

  const { data: bedsResponse } = useAvailableBeds(
    selectedWardId ? { ward_id: selectedWardId } : undefined
  );
  const availableBeds: Bed[] = bedsResponse?.data || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdmissionFormData>({
    resolver: zodResolver(admissionSchema),
  });

  const wardId = watch('ward_id');

  useEffect(() => {
    if (wardId) {
      setSelectedWardId(wardId);
      setValue('bed_id', '');
    }
  }, [wardId, setValue]);

  // Search patients
  useEffect(() => {
    if (patientSearch.length >= 2) {
      api.get('/patients/search', { params: { q: patientSearch, limit: 10 } })
        .then(res => setPatients(res.data?.data || []))
        .catch(() => setPatients([]));
    }
  }, [patientSearch]);

  // The doctors endpoint has no text search, so load them once and filter locally
  useEffect(() => {
    api.get('/doctors', { params: { limit: 100 } })
      .then(res => setAllDoctors(res.data?.data || []))
      .catch(() => setAllDoctors([]));
  }, []);

  const doctorTerm = doctorSearch.trim().toLowerCase();
  const doctors = doctorTerm.length >= 2
    ? allDoctors
        .filter(d => `${doctorLabel(d)} ${d.specialization ?? ''}`.toLowerCase().includes(doctorTerm))
        .slice(0, 10)
    : [];

  const onSubmit = async (data: AdmissionFormData) => {
    // ward_id only drives the bed picker; the admission itself stores bed_id
    const { ward_id: _wardId, diagnosis, ...rest } = data;
    try {
      await createAdmission.mutateAsync({ ...rest, diagnosis: diagnosis || undefined });
      navigate('/ipd');
    } catch {
      // handled by hook
    }
  };

  const selectedWard = wards.find(w => w.id === wardId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Admission"
        subtitle="Admit a patient to the hospital with ward and bed assignment"
        actions={
          <button
            onClick={() => navigate('/ipd')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient & Doctor */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient & Doctor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Patient" required error={errors.patient_id?.message}>
              <div className="relative">
                {selectedPatient ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="flex-1 text-sm font-medium">{patientLabel(selectedPatient)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatient(null);
                        setValue('patient_id', '');
                        setPatientSearch('');
                      }}
                      className="text-gray-400 hover:text-red-500 text-xs"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <SearchInput
                      value={patientSearch}
                      onChange={(v) => {
                        setPatientSearch(v);
                        setShowPatientDropdown(true);
                      }}
                      placeholder="Search patient..."
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
                            <p className="font-medium text-gray-900">{patientLabel(p)}</p>
                            <p className="text-xs text-gray-500">
                              {[p.patient_number, p.phone].filter(Boolean).join(' · ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </FormField>

            <FormField label="Attending Doctor" required error={errors.doctor_id?.message}>
              <div className="relative">
                {selectedDoctor ? (
                  <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="flex-1 text-sm font-medium">{doctorLabel(selectedDoctor)}</span>
                    {selectedDoctor.specialization && (
                      <span className="text-xs text-gray-500">{selectedDoctor.specialization}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDoctor(null);
                        setValue('doctor_id', '');
                        setDoctorSearch('');
                      }}
                      className="text-gray-400 hover:text-red-500 text-xs"
                    >
                      Change
                    </button>
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
                            <p className="font-medium text-gray-900">{doctorLabel(d)}</p>
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
          </div>
        </div>

        {/* Ward & Bed Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ward & Bed Assignment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Ward" required error={errors.ward_id?.message}>
              <Select
                {...register('ward_id')}
                options={wards.map(w => ({
                  value: w.id,
                  label: `${w.name} (${w.type.replace(/_/g, ' ')}) - ${w.available_beds} beds available`,
                }))}
                placeholder="Select ward"
                error={!!errors.ward_id}
              />
            </FormField>

            <FormField label="Bed" required error={errors.bed_id?.message}>
              <Select
                {...register('bed_id')}
                options={availableBeds.map(b => ({
                  value: b.id,
                  label: `Bed ${b.bed_number}${b.charge_per_day != null ? ` - ${currencySymbol()} ${b.charge_per_day}/day` : ''}`,
                }))}
                placeholder={wardId ? 'Select bed' : 'Select a ward first'}
                error={!!errors.bed_id}
                disabled={!wardId}
              />
            </FormField>
          </div>

          {selectedWard && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700 font-medium">{selectedWard.name}</span>
                <span className="text-blue-600">
                  {selectedWard.occupied_beds}/{selectedWard.total_beds} occupied
                </span>
              </div>
              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${selectedWard.total_beds > 0 ? (selectedWard.occupied_beds / selectedWard.total_beds) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Reason & Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Admission Details</h3>
          <div className="space-y-4">
            <FormField label="Reason for Admission" required error={errors.reason?.message}>
              <Textarea
                {...register('reason')}
                placeholder="Primary reason for admitting the patient..."
                rows={3}
                error={!!errors.reason}
              />
            </FormField>
            <FormField label="Preliminary Diagnosis" error={errors.diagnosis?.message}>
              <Textarea
                {...register('diagnosis')}
                placeholder="Initial diagnosis if available..."
                rows={2}
              />
            </FormField>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/ipd')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {isSubmitting ? 'Admitting...' : 'Admit Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
