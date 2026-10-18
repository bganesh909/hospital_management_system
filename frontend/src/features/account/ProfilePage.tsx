import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, UserCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormField, Input } from '../../components/shared/FormField';
import { useAuthStore } from '../../stores/authStore';
import { useMe } from '../../hooks/useAuth';
import { useChangePassword, useUpdateProfile } from '../../hooks/useUsers';

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  phone: z.string().trim().max(20, 'Phone is too long').optional(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .refine((v) => v.new_password !== v.current_password, {
    message: 'New password must be different from the current one',
    path: ['new_password'],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const storedUser = useAuthStore((s) => s.user);
  const { data: me } = useMe();
  const user = me ?? storedUser;

  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const profileForm = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });

  useEffect(() => {
    if (user) {
      profileForm.reset({ first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? '' });
    }
    // Only re-sync when the loaded user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.first_name, user?.last_name, user?.phone]);

  const onSaveProfile = (values: ProfileValues) => {
    updateProfile.mutate({
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone?.trim() || null,
    });
  };

  const onChangePassword = (values: PasswordValues) => {
    changePassword.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      { onSuccess: () => passwordForm.reset({ current_password: '', new_password: '', confirm_password: '' }) },
    );
  };

  const pErrors = profileForm.formState.errors;
  const pwErrors = passwordForm.formState.errors;

  return (
    <div className="max-w-3xl">
      <PageHeader title="My Profile" subtitle="Your account details and password" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
            {user?.full_name?.charAt(0) ?? <UserCircle />}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user?.full_name}</p>
            <p className="text-sm text-gray-500">
              {user?.email} · <span className="capitalize">{user?.role?.replace(/_/g, ' ')}</span>
            </p>
          </div>
        </div>

        <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="First Name" required error={pErrors.first_name?.message}>
            <Input {...profileForm.register('first_name')} error={!!pErrors.first_name} />
          </FormField>
          <FormField label="Last Name" required error={pErrors.last_name?.message}>
            <Input {...profileForm.register('last_name')} error={!!pErrors.last_name} />
          </FormField>
          <FormField label="Email">
            <Input value={user?.email ?? ''} disabled />
          </FormField>
          <FormField label="Phone" error={pErrors.phone?.message}>
            <Input {...profileForm.register('phone')} error={!!pErrors.phone} />
          </FormField>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={updateProfile.isPending || !profileForm.formState.isDirty}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound size={18} className="text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
        </div>
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Current Password" required error={pwErrors.current_password?.message} className="md:col-span-2">
            <Input
              type="password"
              autoComplete="current-password"
              {...passwordForm.register('current_password')}
              error={!!pwErrors.current_password}
            />
          </FormField>
          <FormField label="New Password" required error={pwErrors.new_password?.message}>
            <Input
              type="password"
              autoComplete="new-password"
              {...passwordForm.register('new_password')}
              error={!!pwErrors.new_password}
            />
          </FormField>
          <FormField label="Confirm New Password" required error={pwErrors.confirm_password?.message}>
            <Input
              type="password"
              autoComplete="new-password"
              {...passwordForm.register('confirm_password')}
              error={!!pwErrors.confirm_password}
            />
          </FormField>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {changePassword.isPending ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
