import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';

export interface SubNavItem {
  label: string;
  path: string;
}

export const STAFF_NAV: SubNavItem[] = [
  { label: 'Staff', path: '/staff' },
  { label: 'Attendance', path: '/staff/attendance' },
  { label: 'Leave', path: '/staff/leave' },
  { label: 'Payroll', path: '/staff/payroll' },
];

export const BILLING_NAV: SubNavItem[] = [
  { label: 'Invoices', path: '/billing' },
  { label: 'Insurance Claims', path: '/billing/claims' },
];

export function SubNav({ items }: { items: SubNavItem[] }) {
  return (
    <nav className="mb-4 flex gap-1 border-b border-gray-200">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          className={({ isActive }) =>
            cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
