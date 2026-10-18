import { currencySymbol } from '../../lib/currency';
import {
  Users,
  CalendarDays,
  BedDouble,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import {
  useDashboardStats,
  useDashboardRevenue,
  useDepartmentStats,
  useRecentActivity,
  useTodayAppointments,
} from '../../hooks/useDashboard';
import type { ActivityItem } from '../../services/dashboardService';
import { StatusBadge } from '../../components/shared/StatusBadge';

const PIE_COLORS = ['#0891b2', '#14b8a6', '#f59e0b', '#6366f1', '#94a3b8'];

const ACTIVITY_COLORS: Record<ActivityItem['type'], string> = {
  patient: 'bg-blue-500',
  appointment: 'bg-teal-500',
  admission: 'bg-purple-500',
  discharge: 'bg-amber-500',
  billing: 'bg-emerald-500',
};

function formatChange(change: number | null) {
  if (change === null) return { text: '—', trend: 'flat' as const };
  return {
    text: `${change > 0 ? '+' : ''}${change}%`,
    trend: change > 0 ? ('up' as const) : change < 0 ? ('down' as const) : ('flat' as const),
  };
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      {message}
    </div>
  );
}

export default function DashboardPage() {
  const { data: statsRes, isLoading: statsLoading } = useDashboardStats();
  const { data: revenueRes } = useDashboardRevenue({ period: '6months' });
  const { data: deptRes } = useDepartmentStats();
  const { data: activityRes } = useRecentActivity(8);
  const { data: todayRes } = useTodayAppointments();

  const s = statsRes?.data;
  const monthlyRevenue = revenueRes?.data.series ?? [];
  const activities = activityRes?.data ?? [];
  const todayAppointments = todayRes?.data ?? [];

  // Top 4 departments by patients; the rest grouped as "Other"
  const deptStats = (deptRes?.data ?? []).filter((d) => d.patients > 0);
  const departmentData = [
    ...deptStats.slice(0, 4).map((d) => ({ name: d.department, value: d.patients })),
    ...(deptStats.length > 4
      ? [{ name: 'Other', value: deptStats.slice(4).reduce((sum, d) => sum + d.patients, 0) }]
      : []),
  ];

  const stats = [
    {
      label: 'Total Patients',
      value: s ? s.total_patients.toLocaleString() : '—',
      change: formatChange(s?.patients_change ?? null),
      changeLabel: 'new vs last month',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: "Today's Appointments",
      value: s ? s.todays_appointments.toLocaleString() : '—',
      change: formatChange(s?.appointments_change ?? null),
      changeLabel: 'vs same day last week',
      icon: CalendarDays,
      color: 'bg-teal-500',
    },
    {
      label: 'Bed Occupancy',
      value: s ? `${s.bed_occupancy_percent}%` : '—',
      change: null,
      changeLabel: s ? `${s.occupied_beds} of ${s.total_beds} beds occupied` : '',
      icon: BedDouble,
      color: 'bg-amber-500',
    },
    {
      label: 'Revenue (Monthly)',
      value: s ? `${currencySymbol()} ${s.monthly_revenue.toLocaleString()}` : '—',
      change: formatChange(s?.revenue_change ?? null),
      changeLabel: 'vs last month',
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {statsLoading ? '…' : stat.value}
                </p>
              </div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color} text-white`}
              >
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              {stat.change && (
                <>
                  {stat.change.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                  ) : stat.change.trend === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  ) : (
                    <Minus className="h-3 w-3 text-slate-400" />
                  )}
                  <span
                    className={
                      stat.change.trend === 'up'
                        ? 'text-emerald-600'
                        : stat.change.trend === 'down'
                          ? 'text-red-600'
                          : 'text-slate-500'
                    }
                  >
                    {stat.change.text}
                  </span>
                </>
              )}
              <span className="text-slate-400">{stat.changeLabel}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Weekly Patient Visits */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Appointments (Last 7 Days)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s?.weekly_visits ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="patients" fill="#0891b2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Monthly Revenue
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" fontSize={12} stroke="#94a3b8" />
                <YAxis fontSize={12} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value: number) =>
                    `${currencySymbol()} ${value.toLocaleString()}`
                  }
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Department Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Patients by Department
          </h3>
          <div className="h-52">
            {departmentData.length === 0 ? (
              <EmptyState message="No appointment data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={departmentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {departmentData.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {departmentData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-1 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">
            Recent Activity
          </h3>
          <div className="space-y-3">
            {activities.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No recent activity</p>
            )}
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 p-3"
              >
                <div className={`h-2 w-2 rounded-full ${ACTIVITY_COLORS[activity.type] ?? 'bg-slate-400'}`} />
                <p className="flex-1 text-sm text-slate-600">{activity.description}</p>
                <span className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Today's Appointments */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-700">
          Today&apos;s Appointments
        </h3>
        {todayAppointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No appointments scheduled today</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Doctor</th>
                  <th className="py-2 pr-4">Department</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 pr-4 text-slate-600">{a.time ?? '—'}</td>
                    <td className="py-2 pr-4 font-medium text-slate-700">{a.patient_name}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.doctor_name}</td>
                    <td className="py-2 pr-4 text-slate-600">{a.department ?? '—'}</td>
                    <td className="py-2"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
