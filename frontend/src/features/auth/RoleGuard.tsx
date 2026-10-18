import { Link, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { UserRole } from '../../types/auth.types';

interface RoleGuardProps {
  roles: UserRole[];
}

export default function RoleGuard({ roles }: RoleGuardProps) {
  const { user } = useAuthStore();

  if (user && roles.includes(user.role)) {
    return <Outlet />;
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <ShieldAlert className="h-8 w-8 text-red-600" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-slate-800">Access denied</h2>
      <p className="mt-2 text-sm text-slate-500">
        Your role doesn't have permission to view this page.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
