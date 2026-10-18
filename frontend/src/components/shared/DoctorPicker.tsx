import { useDoctors } from '../../hooks/useDoctors';
import type { Doctor } from '../../services/doctorService';

interface DoctorPickerProps {
  value: string;
  onChange: (doctorId: string, doctor: Doctor | null) => void;
  departmentId?: string;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const doctorDisplayName = (d: Doctor) => {
  const name = d.user?.full_name || 'Doctor';
  const extra = [d.specialization, d.department?.name].filter(Boolean).join(', ');
  return extra ? `Dr. ${name} (${extra})` : `Dr. ${name}`;
};

export function DoctorPicker({
  value,
  onChange,
  departmentId,
  error,
  disabled,
  placeholder = 'Select doctor',
}: DoctorPickerProps) {
  const { data, isLoading } = useDoctors({ limit: 100, department_id: departmentId });
  const doctors: Doctor[] = data?.data ?? [];

  return (
    <select
      value={value}
      disabled={disabled || isLoading}
      onChange={(e) => {
        const doctor = doctors.find((d) => d.id === e.target.value) ?? null;
        onChange(e.target.value, doctor);
      }}
      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
        error ? 'border-red-300 bg-red-50' : 'border-gray-300'
      }`}
    >
      <option value="">{isLoading ? 'Loading doctors...' : placeholder}</option>
      {doctors.map((d) => (
        <option key={d.id} value={d.id}>
          {doctorDisplayName(d)}
        </option>
      ))}
    </select>
  );
}
