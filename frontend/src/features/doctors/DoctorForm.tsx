import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { UserPicker } from '../../components/shared/UserPicker';
import { UserFormModal } from '../users/UserFormModal';
import type { User } from '../../types/auth.types';
import {
  useDoctor,
  useCreateDoctor,
  useUpdateDoctor,
  useDepartments,
  useDoctorSchedule,
  useUpdateDoctorSchedule,
} from '../../hooks/useDoctors';
import type { DoctorSchedule } from '../../services/doctorService';

const doctorSchema = z.object({
  user_id: z.string().min(1, 'User is required'),
  department_id: z.string().min(1, 'Department is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  qualification: z.string().min(1, 'Qualification is required'),
  license_number: z.string().min(1, 'License number is required'),
  experience_years: z.coerce.number().min(0, 'Must be 0 or more'),
  consultation_fee: z.coerce.number().min(0, 'Must be 0 or more'),
  bio: z.string().optional(),
});

type DoctorFormValues = z.infer<typeof doctorSchema>;

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

interface ScheduleRow {
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients: number;
  is_active: boolean;
}

const defaultScheduleRow = (): ScheduleRow => ({
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
  max_patients: 20,
  is_active: true,
});

export default function DoctorForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: doctorData, isLoading: loadingDoctor } = useDoctor(id);
  const { data: scheduleData } = useDoctorSchedule(id);
  const { data: deptData } = useDepartments();
  const createMutation = useCreateDoctor();
  const updateMutation = useUpdateDoctor();
  const scheduleMutation = useUpdateDoctorSchedule();

  const departments = deptData?.data ?? [];

  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [pickedUser, setPickedUser] = useState<User | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DoctorFormValues>({
    resolver: zodResolver(doctorSchema),
    defaultValues: {
      user_id: '',
      department_id: '',
      specialization: '',
      qualification: '',
      license_number: '',
      experience_years: 0,
      consultation_fee: 0,
      bio: '',
    },
  });

  useEffect(() => {
    if (doctorData?.data) {
      const d = doctorData.data;
      reset({
        user_id: d.user_id || '',
        department_id: d.department_id || '',
        specialization: d.specialization || '',
        qualification: d.qualification || '',
        license_number: d.license_number || '',
        experience_years: d.experience_years ?? 0,
        consultation_fee: d.consultation_fee || 0,
        bio: d.bio || '',
      });
    }
  }, [doctorData, reset]);

  useEffect(() => {
    if (scheduleData?.data && Array.isArray(scheduleData.data)) {
      setSchedule(
        scheduleData.data.map((s: any) => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time?.slice(0, 5),
          end_time: s.end_time?.slice(0, 5),
          max_patients: s.max_patients,
          is_active: s.is_active,
        })),
      );
    }
  }, [scheduleData]);

  const addScheduleRow = () => {
    setSchedule((prev) => [...prev, defaultScheduleRow()]);
  };

  const removeScheduleRow = (index: number) => {
    setSchedule((prev) => prev.filter((_, i) => i !== index));
  };

  const updateScheduleRow = (
    index: number,
    field: keyof ScheduleRow,
    value: any,
  ) => {
    setSchedule((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  };

  const onSubmit = (values: DoctorFormValues) => {
    const onSuccess = (data: any) => {
      const doctorId = isEdit ? id : data?.data?.id;
      if (doctorId && schedule.length > 0) {
        const schedulePayload: DoctorSchedule[] = schedule.map((s) => ({
          doctor_id: doctorId,
          ...s,
        }));
        scheduleMutation.mutate(
          { id: doctorId, schedule: schedulePayload },
          { onSuccess: () => navigate('/doctors') },
        );
      } else {
        navigate('/doctors');
      }
    };

    if (isEdit) {
      const { user_id: _userId, license_number: _license, ...updateData } = values;
      updateMutation.mutate({ id, data: updateData }, { onSuccess });
    } else {
      createMutation.mutate(values, { onSuccess });
    }
  };

  const saving =
    createMutation.isPending ||
    updateMutation.isPending ||
    scheduleMutation.isPending;

  if (isEdit && loadingDoctor) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" className="min-h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title={isEdit ? 'Edit Doctor' : 'Add New Doctor'}
        subtitle={
          isEdit
            ? 'Update doctor profile and schedule'
            : 'Register a new doctor in the system'
        }
        actions={
          <button
            onClick={() => navigate('/doctors')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to List
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
        {/* Doctor Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Doctor Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="User Account" required error={errors.user_id?.message}>
              <UserPicker
                link="doctor"
                roles={['doctor']}
                value={watch('user_id')}
                onChange={(userId) => setValue('user_id', userId, { shouldValidate: true, shouldDirty: true })}
                error={!!errors.user_id}
                disabled={isEdit}
                selectedLabel={
                  doctorData?.data?.user
                    ? `${doctorData.data.user.full_name} (${doctorData.data.user.email})`
                    : undefined
                }
                selectedUser={pickedUser}
                onCreateNew={() => setCreateUserOpen(true)}
                placeholder="Search doctor accounts..."
              />
            </FormField>

            <FormField label="Department" required error={errors.department_id?.message}>
              <Select
                {...register('department_id')}
                error={!!errors.department_id}
                options={departments.map((d: any) => ({
                  value: d.id,
                  label: d.name,
                }))}
                placeholder="Select department"
              />
            </FormField>

            <FormField label="Specialization" required error={errors.specialization?.message}>
              <Input
                {...register('specialization')}
                error={!!errors.specialization}
                placeholder="e.g., Cardiology, Neurology"
              />
            </FormField>

            <FormField label="Qualification" required error={errors.qualification?.message}>
              <Input
                {...register('qualification')}
                error={!!errors.qualification}
                placeholder="e.g., MBBS, MD"
              />
            </FormField>

            <FormField label="License Number" required error={errors.license_number?.message}>
              <Input
                {...register('license_number')}
                error={!!errors.license_number}
                disabled={isEdit}
                placeholder="Medical license number"
              />
            </FormField>

            <FormField label="Experience (Years)" required error={errors.experience_years?.message}>
              <Input
                type="number"
                min="0"
                {...register('experience_years')}
                error={!!errors.experience_years}
                placeholder="Years of experience"
              />
            </FormField>

            <FormField label="Consultation Fee ($)" required error={errors.consultation_fee?.message}>
              <Input
                type="number"
                min="0"
                step="0.01"
                {...register('consultation_fee')}
                error={!!errors.consultation_fee}
                placeholder="0.00"
              />
            </FormField>
          </div>

          <div className="mt-4">
            <FormField label="Bio" error={errors.bio?.message}>
              <Textarea
                {...register('bio')}
                error={!!errors.bio}
                placeholder="Brief professional biography..."
              />
            </FormField>
          </div>
        </div>

        {/* Schedule Editor */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Weekly Schedule
            </h2>
            <button
              type="button"
              onClick={addScheduleRow}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus size={14} />
              Add Slot
            </button>
          </div>

          {schedule.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              No schedule configured. Click "Add Slot" to define availability.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider px-1">
                <div className="col-span-3">Day</div>
                <div className="col-span-2">Start</div>
                <div className="col-span-2">End</div>
                <div className="col-span-2">Max Patients</div>
                <div className="col-span-2">Active</div>
                <div className="col-span-1"></div>
              </div>
              {schedule.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2"
                >
                  <div className="col-span-3">
                    <select
                      value={row.day_of_week}
                      onChange={(e) =>
                        updateScheduleRow(idx, 'day_of_week', Number(e.target.value))
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {DAYS_OF_WEEK.map((day, i) => (
                        <option key={i} value={i}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) =>
                        updateScheduleRow(idx, 'start_time', e.target.value)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="time"
                      value={row.end_time}
                      onChange={(e) =>
                        updateScheduleRow(idx, 'end_time', e.target.value)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={row.max_patients}
                      onChange={(e) =>
                        updateScheduleRow(
                          idx,
                          'max_patients',
                          Number(e.target.value),
                        )
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.is_active}
                        onChange={(e) =>
                          updateScheduleRow(idx, 'is_active', e.target.checked)
                        }
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                    </label>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={() => removeScheduleRow(idx)}
                      className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/doctors')}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Update Doctor' : 'Add Doctor'}
          </button>
        </div>
      </form>

      <UserFormModal
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        allowedRoles={['doctor']}
        defaultRole="doctor"
        onCreated={(user) => {
          setPickedUser(user);
          setValue('user_id', user.id, { shouldValidate: true, shouldDirty: true });
        }}
      />
    </div>
  );
}
