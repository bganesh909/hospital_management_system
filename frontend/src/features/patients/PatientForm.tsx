import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  usePatient,
  useCreatePatient,
  useUpdatePatient,
} from '../../hooks/usePatients';

const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.string().min(1, 'Gender is required'),
  blood_group: z.string().optional(),
  phone: z.string().min(1, 'Phone number is required').max(20),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip_code: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_policy_number: z.string().optional(),
  allergies: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

const bloodGroupOptions = [
  { value: '', label: 'Unknown' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
];

export default function PatientForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: patientData, isLoading: loadingPatient } = usePatient(id);
  const createMutation = useCreatePatient();
  const updateMutation = useUpdatePatient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: '',
      blood_group: '',
      phone: '',
      email: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      zip_code: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      insurance_provider: '',
      insurance_policy_number: '',
      allergies: '',
    },
  });

  useEffect(() => {
    if (patientData?.data) {
      const p = patientData.data;
      reset({
        first_name: p.first_name || '',
        last_name: p.last_name || '',
        date_of_birth: p.date_of_birth || '',
        gender: p.gender || '',
        blood_group: p.blood_group || '',
        phone: p.phone || '',
        email: p.email || '',
        address_line1: p.address_line1 || '',
        address_line2: p.address_line2 || '',
        city: p.city || '',
        state: p.state || '',
        zip_code: p.zip_code || '',
        emergency_contact_name: p.emergency_contact_name || '',
        emergency_contact_phone: p.emergency_contact_phone || '',
        insurance_provider: p.insurance_provider || '',
        insurance_policy_number: p.insurance_policy_number || '',
        allergies: p.allergies || '',
      });
    }
  }, [patientData, reset]);

  const onSubmit = (values: PatientFormValues) => {
    const cleaned = {
      ...values,
      email: values.email || undefined,
      blood_group: values.blood_group || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(
        { id, data: cleaned },
        { onSuccess: () => navigate('/patients') },
      );
    } else {
      createMutation.mutate(cleaned, {
        onSuccess: () => navigate('/patients'),
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (isEdit && loadingPatient) {
    return (
      <div className="p-6">
        <LoadingSpinner size="lg" className="min-h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title={isEdit ? 'Edit Patient' : 'Register New Patient'}
        subtitle={
          isEdit
            ? 'Update patient information'
            : 'Fill in the details to register a new patient'
        }
        actions={
          <button
            onClick={() => navigate('/patients')}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to List
          </button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
        {/* Personal Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="First Name" required error={errors.first_name?.message}>
              <Input
                {...register('first_name')}
                error={!!errors.first_name}
                placeholder="Enter first name"
              />
            </FormField>

            <FormField label="Last Name" required error={errors.last_name?.message}>
              <Input
                {...register('last_name')}
                error={!!errors.last_name}
                placeholder="Enter last name"
              />
            </FormField>

            <FormField label="Date of Birth" required error={errors.date_of_birth?.message}>
              <Input
                type="date"
                {...register('date_of_birth')}
                error={!!errors.date_of_birth}
              />
            </FormField>

            <FormField label="Gender" required error={errors.gender?.message}>
              <Select
                {...register('gender')}
                error={!!errors.gender}
                options={genderOptions}
                placeholder="Select gender"
              />
            </FormField>

            <FormField label="Blood Group" error={errors.blood_group?.message}>
              <Select
                {...register('blood_group')}
                error={!!errors.blood_group}
                options={bloodGroupOptions}
                placeholder="Select blood group"
              />
            </FormField>
          </div>
        </div>

        {/* Contact Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contact Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label="Phone" required error={errors.phone?.message}>
              <Input
                {...register('phone')}
                error={!!errors.phone}
                placeholder="+1 (555) 000-0000"
              />
            </FormField>

            <FormField label="Email" error={errors.email?.message}>
              <Input
                type="email"
                {...register('email')}
                error={!!errors.email}
                placeholder="patient@email.com"
              />
            </FormField>

            <FormField label="Address Line 1" error={errors.address_line1?.message}>
              <Input
                {...register('address_line1')}
                error={!!errors.address_line1}
                placeholder="Street address"
              />
            </FormField>

            <FormField label="Address Line 2" error={errors.address_line2?.message}>
              <Input
                {...register('address_line2')}
                error={!!errors.address_line2}
                placeholder="Apt, suite, unit, etc."
              />
            </FormField>

            <FormField label="City" error={errors.city?.message}>
              <Input
                {...register('city')}
                error={!!errors.city}
                placeholder="City"
              />
            </FormField>

            <FormField label="State" error={errors.state?.message}>
              <Input
                {...register('state')}
                error={!!errors.state}
                placeholder="State"
              />
            </FormField>

            <FormField label="ZIP Code" error={errors.zip_code?.message}>
              <Input
                {...register('zip_code')}
                error={!!errors.zip_code}
                placeholder="ZIP Code"
              />
            </FormField>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Emergency Contact
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Contact Name" error={errors.emergency_contact_name?.message}>
              <Input
                {...register('emergency_contact_name')}
                error={!!errors.emergency_contact_name}
                placeholder="Full name"
              />
            </FormField>

            <FormField label="Contact Phone" error={errors.emergency_contact_phone?.message}>
              <Input
                {...register('emergency_contact_phone')}
                error={!!errors.emergency_contact_phone}
                placeholder="Phone number"
              />
            </FormField>
          </div>
        </div>

        {/* Insurance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Insurance Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Insurance Provider" error={errors.insurance_provider?.message}>
              <Input
                {...register('insurance_provider')}
                error={!!errors.insurance_provider}
                placeholder="Provider name"
              />
            </FormField>

            <FormField label="Policy Number" error={errors.insurance_policy_number?.message}>
              <Input
                {...register('insurance_policy_number')}
                error={!!errors.insurance_policy_number}
                placeholder="Policy number"
              />
            </FormField>
          </div>
        </div>

        {/* Medical Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Medical Information
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <FormField label="Allergies" error={errors.allergies?.message}>
              <Textarea
                {...register('allergies')}
                error={!!errors.allergies}
                placeholder="List any known allergies (drugs, food, environmental)..."
              />
            </FormField>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/patients')}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving...' : isEdit ? 'Update Patient' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
