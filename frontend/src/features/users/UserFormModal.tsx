import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/shared/Modal';
import { FormField, Input, Select } from '../../components/shared/FormField';
import { useCreateUser, useUpdateUser } from '../../hooks/useUsers';
import type { ManagedUser } from '../../services/userService';
import type { User, UserRole } from '../../types/auth.types';

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'lab_tech', label: 'Lab Technician' },
];

const roleValues = ROLE_OPTIONS.map((r) => r.value) as [UserRole, ...UserRole[]];

const baseSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  phone: z.string().trim().max(20, 'Phone is too long').optional(),
  role: z.enum(roleValues),
  is_active: z.boolean(),
  email: z.string().optional(),
  password: z.string().optional(),
});

const createSchema = baseSchema.extend({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type UserFormValues = z.infer<typeof baseSchema>;

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Present → edit mode */
  user?: ManagedUser | null;
  /** Restrict the selectable roles (e.g. creating a doctor account from the doctor form) */
  allowedRoles?: UserRole[];
  defaultRole?: UserRole;
  onCreated?: (user: User) => void;
}

export function UserFormModal({ open, onClose, user, allowedRoles, defaultRole, onCreated }: UserFormModalProps) {
  const isEdit = !!user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const roleOptions = allowedRoles ? ROLE_OPTIONS.filter((r) => allowedRoles.includes(r.value)) : ROLE_OPTIONS;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? baseSchema : createSchema),
  });

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? {
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone ?? '',
            role: user.role,
            is_active: user.is_active,
            email: user.email,
            password: '',
          }
        : {
            first_name: '',
            last_name: '',
            phone: '',
            role: defaultRole ?? roleOptions[0]?.value ?? 'receptionist',
            is_active: true,
            email: '',
            password: '',
          },
    );
    // roleOptions is derived from allowedRoles; including it would reset on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, defaultRole, reset]);

  const onSubmit = (values: UserFormValues) => {
    const phone = values.phone?.trim() || undefined;
    if (isEdit && user) {
      updateUser.mutate(
        {
          id: user.id,
          data: {
            first_name: values.first_name,
            last_name: values.last_name,
            phone: phone ?? null,
            role: values.role,
            is_active: values.is_active,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      createUser.mutate(
        {
          email: values.email!.trim(),
          password: values.password!,
          first_name: values.first_name,
          last_name: values.last_name,
          phone,
          role: values.role,
          is_active: values.is_active,
        },
        {
          onSuccess: (res) => {
            onCreated?.(res.data);
            onClose();
          },
        },
      );
    }
  };

  const isSaving = createUser.isPending || updateUser.isPending;
  const linkedAsDoctor = user?.linked_as?.includes('doctor');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit User' : 'Create User Account'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="First Name" required error={errors.first_name?.message}>
          <Input {...register('first_name')} error={!!errors.first_name} />
        </FormField>
        <FormField label="Last Name" required error={errors.last_name?.message}>
          <Input {...register('last_name')} error={!!errors.last_name} />
        </FormField>
        <FormField label="Email" required={!isEdit} error={errors.email?.message}>
          <Input
            type="email"
            {...register('email')}
            error={!!errors.email}
            disabled={isEdit}
            placeholder="name@hospital.com"
          />
        </FormField>
        <FormField label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} error={!!errors.phone} placeholder="+91 98765 43210" />
        </FormField>
        <FormField label="Role" required error={errors.role?.message}>
          {roleOptions.length === 1 || linkedAsDoctor ? (
            <>
              {/* Disabled fields are dropped from form values, so keep the role in a hidden input */}
              <input type="hidden" {...register('role')} />
              <Input
                value={ROLE_OPTIONS.find((r) => r.value === (user?.role ?? roleOptions[0]?.value))?.label ?? ''}
                disabled
              />
            </>
          ) : (
            <Select options={roleOptions} {...register('role')} error={!!errors.role} />
          )}
          {linkedAsDoctor && (
            <p className="mt-1 text-xs text-gray-500">Linked to a doctor profile, so the role can't change.</p>
          )}
        </FormField>
        {!isEdit && (
          <FormField label="Temporary Password" required error={errors.password?.message}>
            <Input type="password" {...register('password')} error={!!errors.password} autoComplete="new-password" />
          </FormField>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
          <input type="checkbox" {...register('is_active')} className="h-4 w-4 rounded border-gray-300" />
          Account is active (can log in)
        </label>
      </form>
    </Modal>
  );
}
