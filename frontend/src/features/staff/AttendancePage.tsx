import { SubNav, STAFF_NAV } from '../../components/shared/SubNav';
import { useState, useMemo } from 'react';
import { LogIn, LogOut, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { SearchInput } from '../../components/shared/SearchInput';
import { useAttendance, useMarkAttendance, useStaffAttendance, useStaffList } from '../../hooks/useStaff';
import type { AttendanceRecord, StaffMember } from '../../services/staffService';

// One row per staff member for the selected day; `record` is absent until marked
interface DailyRow {
  id: string;
  staff_id: string;
  full_name?: string | null;
  employee_number?: string | null;
  record?: AttendanceRecord;
}

const statusColors: Record<string, string> = {
  present: 'bg-green-500',
  absent: 'bg-red-500',
  half_day: 'bg-orange-400',
  leave: 'bg-yellow-400',
  holiday: 'bg-blue-400',
};

export default function AttendancePage() {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'daily' | 'monthly'>('daily');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const limit = 20;

  const staffParams: Record<string, any> = { page, limit, status: 'active' };
  if (search) staffParams.search = search;
  const { data: dailyStaffResp, isLoading: staffLoading } = useStaffList(staffParams);
  const dailyStaff: StaffMember[] = dailyStaffResp?.data || [];
  const totalItems = dailyStaffResp?.meta?.total || 0;

  const { data: response, isLoading: recordsLoading } = useAttendance({ date: selectedDate, limit: 100 });
  const records: AttendanceRecord[] = response?.data || [];
  const isLoading = staffLoading || recordsLoading;

  const rows: DailyRow[] = dailyStaff.map((s) => ({
    id: s.id,
    staff_id: s.id,
    full_name: s.full_name,
    employee_number: s.employee_number,
    record: records.find((r) => r.staff_id === s.id),
  }));

  const { data: staffResp } = useStaffList({ limit: 100 });
  const staffList: StaffMember[] = staffResp?.data || [];

  const { data: monthlyResp } = useStaffAttendance(
    selectedStaffId,
    monthYear.month,
    monthYear.year
  );
  const monthlyRecords: AttendanceRecord[] = monthlyResp?.data || [];

  const markAttendance = useMarkAttendance();

  const handleCheckIn = (staffId: string) => {
    markAttendance.mutate({
      staff_id: staffId,
      date: selectedDate,
      check_in: new Date().toISOString(),
      status: 'present',
    });
  };

  const handleCheckOut = (staffId: string) => {
    markAttendance.mutate({
      staff_id: staffId,
      date: selectedDate,
      check_out: new Date().toISOString(),
    });
  };

  // Build calendar grid for monthly view
  const calendarDays = useMemo(() => {
    const year = monthYear.year;
    const month = monthYear.month - 1;
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: number | null; record?: AttendanceRecord }[] = [];
    for (let i = 0; i < startOffset; i++) days.push({ date: null });
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = monthlyRecords.find((r) => r.date === dateStr);
      days.push({ date: d, record });
    }
    return days;
  }, [monthYear, monthlyRecords]);

  const prevMonth = () => {
    setMonthYear((prev) => {
      if (prev.month === 1) return { month: 12, year: prev.year - 1 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setMonthYear((prev) => {
      if (prev.month === 12) return { month: 1, year: prev.year + 1 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const monthName = new Date(monthYear.year, monthYear.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const columns = [
    {
      key: 'full_name',
      label: 'Employee',
      render: (item: DailyRow) => (
        <div>
          <p className="font-medium text-gray-900">{item.full_name}</p>
          <p className="text-xs text-gray-500">{item.employee_number}</p>
        </div>
      ),
    },
    {
      key: 'check_in',
      label: 'Check-in',
      render: ({ record }: DailyRow) =>
        record?.check_in ? (
          <span className="text-green-600 font-medium">{new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        ) : (
          <span className="text-gray-400">--:--</span>
        ),
    },
    {
      key: 'check_out',
      label: 'Check-out',
      render: ({ record }: DailyRow) =>
        record?.check_out ? (
          <span className="text-blue-600 font-medium">{new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        ) : (
          <span className="text-gray-400">--:--</span>
        ),
    },
    {
      key: 'hours_worked',
      label: 'Hours',
      render: ({ record }: DailyRow) =>
        record?.hours_worked != null ? (
          <span className="font-medium">{Number(record.hours_worked).toFixed(1)}h</span>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: ({ record }: DailyRow) =>
        record ? <StatusBadge status={record.status} /> : <span className="text-xs text-gray-400">Not marked</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: ({ staff_id: staffId, record }: DailyRow) => (
        <div className="flex items-center gap-2">
          {!record?.check_in && record?.status !== 'leave' && record?.status !== 'holiday' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCheckIn(staffId); }}
              disabled={markAttendance.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50"
            >
              <LogIn size={12} />
              Check In
            </button>
          )}
          {record?.check_in && !record.check_out && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCheckOut(staffId); }}
              disabled={markAttendance.isPending}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
            >
              <LogOut size={12} />
              Check Out
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <SubNav items={STAFF_NAV} />
      <PageHeader
        title="Staff Attendance"
        subtitle="Track and manage daily staff attendance"
      />

      {/* View Toggle */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('daily')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Daily View
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              view === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly View
          </button>
        </div>
      </div>

      {view === 'daily' ? (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
              placeholder="Search employees..."
              className="w-64"
            />
          </div>

          {/* Attendance Summary */}
          {!isLoading && records.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              {['present', 'absent', 'half_day', 'leave', 'holiday'].map((status) => {
                const count = records.filter((r) => r.status === status).length;
                return (
                  <div key={status} className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                    <div>
                      <p className="text-xs text-gray-500 capitalize">{status.replace(/_/g, ' ')}</p>
                      <p className="text-lg font-bold text-gray-900">{count}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DataTable
            columns={columns}
            data={rows}
            totalItems={totalItems}
            page={page}
            limit={limit}
            onPageChange={setPage}
            loading={isLoading}
            emptyMessage="No active staff found"
          />
        </>
      ) : (
        /* Monthly Calendar View */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-64">
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select staff member</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedStaffId ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ChevronLeft size={18} />
                </button>
                <h3 className="text-lg font-semibold text-gray-900">{monthName}</h3>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square p-1 border rounded-lg flex flex-col items-center justify-center text-xs ${
                      day.date ? 'border-gray-200' : 'border-transparent'
                    }`}
                  >
                    {day.date && (
                      <>
                        <span className="text-gray-600 font-medium">{day.date}</span>
                        {day.record && (
                          <div
                            className={`mt-0.5 w-2 h-2 rounded-full ${statusColors[day.record.status] || 'bg-gray-300'}`}
                            title={day.record.status}
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
                {Object.entries(statusColors).map(([status, color]) => (
                  <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>

              {/* Monthly Summary */}
              {monthlyRecords.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Monthly Summary</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {['present', 'absent', 'half_day', 'leave', 'holiday'].map((status) => {
                      const count = monthlyRecords.filter((r) => r.status === status).length;
                      return (
                        <div key={status} className="text-center p-2 bg-gray-50 rounded-lg">
                          <p className="text-lg font-bold text-gray-900">{count}</p>
                          <p className="text-xs text-gray-500 capitalize">{status.replace(/_/g, ' ')}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Calendar size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a staff member</h3>
              <p className="text-gray-500">Choose a staff member to view their monthly attendance calendar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
