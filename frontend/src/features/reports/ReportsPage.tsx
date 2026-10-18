import { currencySymbol } from '../../lib/currency';
import { useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FileText, DollarSign, BedDouble, Users, TrendingUp, Download } from 'lucide-react';
import { format, startOfYear } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import {
  useAttendanceTrends,
  useBedOccupancy,
  useDashboardRevenue,
  usePatientTrends,
} from '../../hooks/useDashboard';

function formatMoney(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${currencySymbol()} ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${currencySymbol()} ${(value / 1_000).toFixed(1)}K`;
  return `${currencySymbol()} ${value.toLocaleString()}`;
}

function downloadCsv<T extends object>(filename: string, data: T[]) {
  if (data.length === 0) return;
  const rows = data as unknown as Record<string, string | number>[];
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

type ReportType = 'revenue' | 'patients' | 'occupancy' | 'staff';

export default function ReportsPage() {
  const [active, setActive] = useState<ReportType>('revenue');
  const [dateRange, setDateRange] = useState(() => ({
    from: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  }));
  const range = { date_from: dateRange.from, date_to: dateRange.to };

  const { data: revenueRes } = useDashboardRevenue(range);
  const { data: patientRes } = usePatientTrends(range);
  const { data: occupancyRes } = useBedOccupancy();
  const { data: attendanceRes } = useAttendanceTrends(range);

  const revenueData = revenueRes?.data.series ?? [];
  const totalRevenue = revenueData.reduce((sum, m) => sum + m.revenue, 0);
  const totalExpenses = revenueData.reduce((sum, m) => sum + m.expenses, 0);
  const avgMonthly = revenueData.length ? totalRevenue / revenueData.length : 0;

  const patientData = patientRes?.data.series ?? [];
  const patientSummary = patientRes?.data.summary;

  const occupancyData = occupancyRes?.data ?? [];
  const totalBeds = occupancyData.reduce((sum, w) => sum + w.total_beds, 0);
  const occupiedBeds = occupancyData.reduce((sum, w) => sum + w.occupied, 0);
  const occupancyPct = totalBeds ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : '0';

  const attendance = attendanceRes?.data;
  const attendanceData = attendance?.months ?? [];

  const handleExport = () => {
    const suffix = `${dateRange.from}_to_${dateRange.to}`;
    if (active === 'revenue') downloadCsv(`revenue_${suffix}.csv`, revenueData);
    if (active === 'patients') downloadCsv(`patients_${suffix}.csv`, patientData);
    if (active === 'occupancy')
      downloadCsv('occupancy.csv', occupancyData.map(({ ward, total_beds, occupied, available, occupancy_percent }) => ({ ward, total_beds, occupied, available, occupancy_percent })));
    if (active === 'staff') downloadCsv(`attendance_${suffix}.csv`, attendanceData);
  };

  const reports: { key: ReportType; title: string; icon: any; color: string; bg: string; desc: string }[] = [
    { key: 'revenue', title: 'Revenue', icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100', desc: 'Income & expenses' },
    { key: 'patients', title: 'Patients', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', desc: 'Registrations & visits' },
    { key: 'occupancy', title: 'Occupancy', icon: BedDouble, color: 'text-purple-600', bg: 'bg-purple-100', desc: 'Bed utilization' },
    { key: 'staff', title: 'Staff', icon: FileText, color: 'text-orange-600', bg: 'bg-orange-100', desc: 'Attendance metrics' },
  ];

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="View detailed reports" />

      <div className="grid grid-cols-4 gap-4 mb-6">
        {reports.map((r) => (
          <button key={r.key} onClick={() => setActive(r.key)}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${active === r.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className={`p-2 rounded-lg ${r.bg}`}><r.icon size={20} className={r.color} /></div>
            <div><p className="text-sm font-semibold">{r.title}</p><p className="text-xs text-gray-500">{r.desc}</p></div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">From:</label>
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
          <label className="text-sm text-gray-600">To:</label>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"><Download size={16} /> Export</button>
      </div>

      {active === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={formatMoney(totalRevenue)} icon={DollarSign} iconColor="text-green-600" iconBg="bg-green-100" />
            <StatCard title="Expenses (Payroll)" value={formatMoney(totalExpenses)} icon={TrendingUp} iconColor="text-red-600" iconBg="bg-red-100" />
            <StatCard title="Net Profit" value={formatMoney(totalRevenue - totalExpenses)} changeType={totalRevenue - totalExpenses >= 0 ? 'positive' : 'negative'} icon={DollarSign} iconColor="text-blue-600" iconBg="bg-blue-100" />
            <StatCard title="Avg Monthly" value={formatMoney(avgMonthly)} icon={FileText} iconColor="text-purple-600" iconBg="bg-purple-100" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Revenue vs Expenses</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={revenueData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `${currencySymbol()} ${v / 1000}k`} /><Tooltip formatter={(v: number) => `${currencySymbol()} ${v.toLocaleString()}`} /><Legend /><Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {active === 'patients' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Total Patients" value={(patientSummary?.total_patients ?? 0).toLocaleString()} change={`+${patientSummary?.new_this_month ?? 0} this month`} changeType="positive" icon={Users} iconColor="text-blue-600" iconBg="bg-blue-100" />
            <StatCard title="New in Range" value={(patientSummary?.new_in_range ?? 0).toLocaleString()} icon={Users} iconColor="text-green-600" iconBg="bg-green-100" />
            <StatCard title="Returning in Range" value={(patientSummary?.returning_in_range ?? 0).toLocaleString()} icon={Users} iconColor="text-purple-600" iconBg="bg-purple-100" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Patient Registrations</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={patientData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="new_patients" stroke="#3b82f6" strokeWidth={2} name="New" /><Line type="monotone" dataKey="returning" stroke="#10b981" strokeWidth={2} name="Returning" /></LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {active === 'occupancy' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Total Beds" value={totalBeds} icon={BedDouble} iconColor="text-blue-600" iconBg="bg-blue-100" />
            <StatCard title="Occupied" value={occupiedBeds} change={`${occupancyPct}%`} changeType="neutral" icon={BedDouble} iconColor="text-red-600" iconBg="bg-red-100" />
            <StatCard title="Available" value={totalBeds - occupiedBeds} icon={BedDouble} iconColor="text-green-600" iconBg="bg-green-100" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Ward-wise Occupancy</h3>
            <div className="space-y-4">
              {occupancyData.length === 0 && <p className="text-sm text-gray-500">No wards configured</p>}
              {occupancyData.map((w) => {
                const pct = w.total_beds ? Math.round((w.occupied / w.total_beds) * 100) : 0;
                const clr = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500';
                return (
                  <div key={w.ward_id} className="flex items-center gap-4">
                    <span className="w-28 text-sm font-medium">{w.ward}</span>
                    <div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden relative">
                      <div className={`h-full ${clr} rounded-full`} style={{ width: `${pct}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{w.occupied}/{w.total_beds} ({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {active === 'staff' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard title="Total Staff" value={attendance?.total_staff ?? 0} icon={Users} iconColor="text-blue-600" iconBg="bg-blue-100" />
            <StatCard title="Avg Attendance" value={`${attendance?.average_attendance ?? 0}%`} icon={FileText} iconColor="text-green-600" iconBg="bg-green-100" />
            <StatCard title="On Leave Today" value={attendance?.on_leave ?? 0} icon={Users} iconColor="text-yellow-600" iconBg="bg-yellow-100" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Attendance Trends (%)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={attendanceData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="present" fill="#10b981" stackId="a" /><Bar dataKey="leave" fill="#f59e0b" stackId="a" /><Bar dataKey="absent" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
