import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  ClipboardList,
  BedDouble,
  Pill,
  FlaskConical,
  Receipt,
  UserCog,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Activity,
  KeyRound,
  Building2,
  History,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { useSidebarStore } from '../../stores/sidebarStore';
import { useSettings } from '../../hooks/useSettings';
import type { UserRole } from '../../types/auth.types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Patients', path: '/patients', icon: Users },
  { label: 'Doctors', path: '/doctors', icon: Stethoscope },
  { label: 'Appointments', path: '/appointments', icon: CalendarDays },
  {
    label: 'OPD',
    path: '/opd',
    icon: ClipboardList,
    roles: ['admin', 'doctor', 'nurse', 'receptionist'],
  },
  {
    label: 'IPD',
    path: '/ipd',
    icon: BedDouble,
    roles: ['admin', 'doctor', 'nurse'],
  },
  {
    label: 'Pharmacy',
    path: '/pharmacy',
    icon: Pill,
    roles: ['admin', 'pharmacist', 'doctor'],
  },
  {
    label: 'Laboratory',
    path: '/laboratory',
    icon: FlaskConical,
    roles: ['admin', 'lab_tech', 'doctor'],
  },
  {
    label: 'Billing',
    path: '/billing',
    icon: Receipt,
    roles: ['admin', 'receptionist'],
  },
  {
    label: 'Staff',
    path: '/staff',
    icon: UserCog,
    roles: ['admin'],
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    roles: ['admin'],
  },
  {
    label: 'Departments',
    path: '/departments',
    icon: Building2,
    roles: ['admin'],
  },
  {
    label: 'Users',
    path: '/users',
    icon: KeyRound,
    roles: ['admin'],
  },
  {
    label: 'Audit Log',
    path: '/audit-logs',
    icon: History,
    roles: ['admin'],
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
    roles: ['admin'],
  },
  { label: 'Notifications', path: '/notifications', icon: Bell },
];

export default function Sidebar() {
  const { user } = useAuthStore();
  const { isCollapsed, toggle } = useSidebarStore();
  const { data: settings } = useSettings();

  const filteredItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col bg-slate-900 text-white transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-700 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-600">
          <Activity className="h-5 w-5 text-white" />
        </div>
        {!isCollapsed && (
          <div className="overflow-hidden">
            <h1 className="truncate text-sm font-bold leading-tight tracking-wide">
              {settings?.hospital_name || 'MedCare HMS'}
            </h1>
            <p className="text-[10px] text-slate-400">Hospital Management</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {filteredItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                    isCollapsed && 'justify-center px-2',
                  )
                }
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={toggle}
        className="flex h-12 items-center justify-center border-t border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      >
        {isCollapsed ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <ChevronLeft className="h-5 w-5" />
        )}
      </button>
    </aside>
  );
}
