import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, MapPin, Receipt, Globe, Save } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import type { HospitalSettings, HospitalSettingsUpdate } from '../../services/settingsService';

const optionalText = (max: number) => z.string().max(max, `Max ${max} characters`).optional();

const settingsSchema = z.object({
  hospital_name: z.string().trim().min(1, 'Hospital name is required').max(200),
  tagline: optionalText(200),
  registration_number: optionalText(100),
  tax_id: optionalText(50),
  logo_url: z.string().url('Enter a valid URL').or(z.literal('')).optional(),
  address_line1: optionalText(255),
  address_line2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  zip_code: optionalText(20),
  country: optionalText(100),
  phone: optionalText(20),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  website: optionalText(255),
  currency: z.string().trim().length(3, 'Use a 3-letter code, e.g. INR'),
  currency_symbol: z.string().trim().min(1, 'Required').max(5),
  tax_rate: z.coerce.number().min(0, 'Must be 0 or more').max(100, 'Must be 100 or less'),
  invoice_footer: z.string().optional(),
  timezone: z.string().min(1, 'Required'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Kathmandu',
  'Asia/Colombo',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
].map((tz) => ({ value: tz, label: tz }));

const NULLABLE_FIELDS = [
  'tagline',
  'registration_number',
  'tax_id',
  'logo_url',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'zip_code',
  'country',
  'phone',
  'email',
  'website',
  'invoice_footer',
] as const;

function toFormValues(s: HospitalSettings): SettingsFormData {
  const values: Record<string, unknown> = { ...s };
  for (const key of NULLABLE_FIELDS) values[key] = s[key] ?? '';
  values.tax_rate = Number(s.tax_rate ?? 0);
  return values as SettingsFormData;
}

function toPayload(data: SettingsFormData): HospitalSettingsUpdate {
  const payload: Record<string, unknown> = {
    ...data,
    currency: data.currency.toUpperCase(),
  };
  // Blank optional fields are stored as null, not empty strings
  for (const key of NULLABLE_FIELDS) {
    const value = data[key];
    payload[key] = typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  return payload as HospitalSettingsUpdate;
}

function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (settings) reset(toFormValues(settings));
  }, [settings, reset]);

  const onSubmit = (data: SettingsFormData) => {
    updateSettings.mutate(toPayload(data), {
      onSuccess: (res) => reset(toFormValues(res.data)),
    });
  };

  if (isLoading) return <PageLoader />;

  const logoUrl = watch('logo_url');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <PageHeader
        title="Hospital Settings"
        subtitle="Hospital profile, contact details and billing defaults"
        actions={
          <button
            type="submit"
            disabled={!isDirty || updateSettings.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />

      <Section icon={Building2} title="General">
        <FormField label="Hospital Name" required error={errors.hospital_name?.message}>
          <Input {...register('hospital_name')} error={!!errors.hospital_name} />
        </FormField>
        <FormField label="Tagline" error={errors.tagline?.message}>
          <Input {...register('tagline')} placeholder="e.g. Caring for you since 1990" />
        </FormField>
        <FormField label="Registration Number" error={errors.registration_number?.message}>
          <Input {...register('registration_number')} />
        </FormField>
        <FormField label="Tax ID (GSTIN / VAT)" error={errors.tax_id?.message}>
          <Input {...register('tax_id')} />
        </FormField>
        <FormField label="Logo URL" error={errors.logo_url?.message} className="md:col-span-2">
          <div className="flex items-center gap-3">
            <Input {...register('logo_url')} placeholder="https://..." error={!!errors.logo_url} />
            {logoUrl && !errors.logo_url && (
              <img src={logoUrl} alt="Logo preview" className="h-10 w-10 rounded object-contain border border-gray-200" />
            )}
          </div>
        </FormField>
      </Section>

      <Section icon={MapPin} title="Contact & Address">
        <FormField label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} error={!!errors.email} />
        </FormField>
        <FormField label="Website" error={errors.website?.message} className="md:col-span-2">
          <Input {...register('website')} placeholder="https://..." />
        </FormField>
        <FormField label="Address Line 1" error={errors.address_line1?.message}>
          <Input {...register('address_line1')} />
        </FormField>
        <FormField label="Address Line 2" error={errors.address_line2?.message}>
          <Input {...register('address_line2')} />
        </FormField>
        <FormField label="City" error={errors.city?.message}>
          <Input {...register('city')} />
        </FormField>
        <FormField label="State" error={errors.state?.message}>
          <Input {...register('state')} />
        </FormField>
        <FormField label="ZIP / PIN Code" error={errors.zip_code?.message}>
          <Input {...register('zip_code')} />
        </FormField>
        <FormField label="Country" error={errors.country?.message}>
          <Input {...register('country')} />
        </FormField>
      </Section>

      <Section icon={Receipt} title="Billing">
        <FormField label="Currency Code" required error={errors.currency?.message}>
          <Input {...register('currency')} maxLength={3} className="uppercase" error={!!errors.currency} />
        </FormField>
        <FormField label="Currency Symbol" required error={errors.currency_symbol?.message}>
          <Input {...register('currency_symbol')} maxLength={5} error={!!errors.currency_symbol} />
        </FormField>
        <FormField label="Default Tax Rate (%)" required error={errors.tax_rate?.message}>
          <Input type="number" step="0.01" min={0} max={100} {...register('tax_rate')} error={!!errors.tax_rate} />
        </FormField>
        <div />
        <FormField label="Invoice Footer / Terms" error={errors.invoice_footer?.message} className="md:col-span-2">
          <Textarea {...register('invoice_footer')} rows={3} placeholder="Shown at the bottom of every invoice" />
        </FormField>
      </Section>

      <Section icon={Globe} title="Regional">
        <FormField label="Timezone" required error={errors.timezone?.message}>
          <Select
            {...register('timezone')}
            options={
              settings && !TIMEZONES.some((t) => t.value === settings.timezone)
                ? [{ value: settings.timezone, label: settings.timezone }, ...TIMEZONES]
                : TIMEZONES
            }
          />
        </FormField>
      </Section>
    </form>
  );
}
