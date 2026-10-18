import { SubNav, STAFF_NAV } from '../../components/shared/SubNav';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarOff, Check, Plus, X, Ban } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DataTable } from '../../components/shared/DataTable';
import { SearchInput } from '../../components/shared/SearchInput';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Modal } from '../../components/shared/Modal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { FormField, Input, Select, Textarea } from '../../components/shared/FormField';
import {
  useLeaveRequests,
  useCreateLeaveRequest,
  useUpdateLeaveRequest,
  useStaffList,
} from '../../hooks/useStaff';
import type { LeaveRequest, StaffMember } from '../../services/staffService';

type LeaveStatus = LeaveRequest['status'];

const leaveTypes = [
  { value: 'sick', label: 'Sick' },
  { value: 'casual', label: 'Casual' },
  { value: 'earned', label: 'Earned' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'paternity', label: 'Paternity' },
  { value: 'unpaid', label: 'Unpaid' },
];

const statusTabs: { value: '' | LeaveStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: '', label: 'All' },
];

const dayCount = (start: string, end: string) =>
  Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const actionCopy: Record<'approved' | 'rejected' | 'cancelled', { title: string; label: string; variant: 'info' | 'danger' | 'warning' }> = {
  approved: { title: 'Approve leave', label: 'Approve', variant: 'info' },
  rejected: { title: 'Reject leave', label: 'Reject', variant: 'danger' },
  cancelled: { title: 'Cancel leave', label: 'Cancel Leave', variant: 'warning' },
};

export default function LeavePage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | LeaveStatus>('pending');
  const [leaveType, setLeaveType] = useState('');
  const [staffId, setStaffId] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ leave: LeaveRequest; status: 'approved' | 'rejected' | 'cancelled' } | null>(null);

  const { data, isLoading } = useLeaveRequests({
    page,
    limit: 20,
    status: status || undefined,
    leave_type: leaveType || undefined,
    staff_id: staffId || undefined,
    search: search || undefined,
  });
  const leaves: LeaveRequest[] = data?.data ?? [];

  const { data: staffResp } = useStaffList({ limit: 100, sort_by: 'full_name' });
  const staffOptions = (staffResp?.data ?? []).map((s: StaffMember) => ({
    value: s.id,
    label: `${s.full_name ?? 'Unnamed'} (${s.employee_number})`,
  }));

  const updateLeave = useUpdateLeaveRequest();

  const handleAction = () => {
    if (!pendingAction) return;
    updateLeave.mutate(
      { id: pendingAction.leave.id, data: { status: pendingAction.status } },
      { onSuccess: () => setPendingAction(null) }
    );
  };

  const resetPage = () => setPage(1);

  const columns = [
    {
      key: 'full_name',
      label: 'Employee',
      render: (l: LeaveRequest) => (
        <div>
          <p className="font-medium text-gray-900">{l.full_name ?? '-'}</p>
          <p className="text-xs text-gray-500">{l.employee_number}</p>
        </div>
      ),
    },
    { key: 'leave_type', label: 'Type', render: (l: LeaveRequest) => <span className="capitalize">{l.leave_type}</span> },
    {
      key: 'dates',
      label: 'Dates',
      render: (l: LeaveRequest) => (
        <div>
          <p className="text-gray-900">
            {formatDate(l.start_date)}
            {l.end_date !== l.start_date && <> – {formatDate(l.end_date)}</>}
          </p>
          <p className="text-xs text-gray-500">
            {dayCount(l.start_date, l.end_date)} day{dayCount(l.start_date, l.end_date) === 1 ? '' : 's'}
          </p>
        </div>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (l: LeaveRequest) => <span className="text-gray-600 line-clamp-2 max-w-xs">{l.reason || '-'}</span>,
    },
    { key: 'status', label: 'Status', render: (l: LeaveRequest) => <StatusBadge status={l.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (l: LeaveRequest) => (
        <div className="flex items-center gap-1.5">
          {l.status === 'pending' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingAction({ leave: l, status: 'approved' }); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
              >
                <Check size={12} />
                Approve
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setPendingAction({ leave: l, status: 'rejected' }); }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100"
              >
                <X size={12} />
                Reject
              </button>
            </>
          )}
          {(l.status === 'pending' || l.status === 'approved') && (
            <button
              onClick={(e) => { e.stopPropagation(); setPendingAction({ leave: l, status: 'cancelled' }); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Ban size={12} />
              Cancel
            </button>
          )}
        </div>
      ),
    },
  ];

  const actionMessage = (() => {
    if (!pendingAction) return '';
    const { leave, status: next } = pendingAction;
    const who = leave.full_name ?? 'this employee';
    const range = `${formatDate(leave.start_date)} – ${formatDate(leave.end_date)}`;
    if (next === 'approved') return `Approve ${leave.leave_type} leave for ${who} (${range})? Attendance for these days will be marked as leave.`;
    if (next === 'rejected') return `Reject the leave request from ${who} for ${range}?`;
    return leave.status === 'approved'
      ? `Cancel the approved leave for ${who} (${range})? Leave entries in attendance for these days will be removed.`
      : `Cancel the leave request from ${who} for ${range}?`;
  })();

  return (
    <div>
      <SubNav items={STAFF_NAV} />
      <PageHeader
        title="Leave Management"
        subtitle="Review and record staff leave"
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            New Leave Request
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.value || 'all'}
              onClick={() => { setStatus(tab.value); resetPage(); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                status === tab.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SearchInput
            value={search}
            onChange={(value) => { setSearch(value); resetPage(); }}
            placeholder="Search name, employee # or reason..."
          />
          <Select
            placeholder="All leave types"
            options={leaveTypes}
            value={leaveType}
            onChange={(e) => { setLeaveType(e.target.value); resetPage(); }}
          />
          <Select
            placeholder="All staff"
            options={staffOptions}
            value={staffId}
            onChange={(e) => { setStaffId(e.target.value); resetPage(); }}
          />
        </div>
      </div>

      {!isLoading && leaves.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CalendarOff size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No leave requests</h3>
          <p className="text-gray-500">Nothing matches the current filters.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={leaves}
          totalItems={data?.meta?.total ?? 0}
          page={page}
          limit={20}
          onPageChange={setPage}
          loading={isLoading}
          emptyMessage="No leave requests found"
        />
      )}

      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction ? actionCopy[pendingAction.status].title : ''}
        message={actionMessage}
        confirmLabel={pendingAction ? actionCopy[pendingAction.status].label : 'Confirm'}
        cancelLabel="Back"
        variant={pendingAction ? actionCopy[pendingAction.status].variant : 'info'}
        loading={updateLeave.isPending}
        onConfirm={handleAction}
        onCancel={() => setPendingAction(null)}
      />

      <CreateLeaveModal open={createOpen} onClose={() => setCreateOpen(false)} staffOptions={staffOptions} />
    </div>
  );
}

const leaveSchema = z
  .object({
    staff_id: z.string().min(1, 'Select a staff member'),
    leave_type: z.enum(['sick', 'casual', 'earned', 'maternity', 'paternity', 'unpaid']),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    reason: z.string().max(1000).optional(),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    message: 'End date cannot be before start date',
    path: ['end_date'],
  });

type LeaveFormValues = z.infer<typeof leaveSchema>;

function CreateLeaveModal({
  open,
  onClose,
  staffOptions,
}: {
  open: boolean;
  onClose: () => void;
  staffOptions: { value: string; label: string }[];
}) {
  const createLeave = useCreateLeaveRequest();
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { staff_id: '', leave_type: 'casual', start_date: today, end_date: today, reason: '' },
  });

  const start = watch('start_date');
  const end = watch('end_date');
  const days = start && end && end >= start ? dayCount(start, end) : 0;

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = (values: LeaveFormValues) => {
    createLeave.mutate(
      { ...values, reason: values.reason?.trim() || undefined },
      { onSuccess: close }
    );
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New Leave Request"
      size="md"
      footer={
        <>
          <button onClick={close} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={createLeave.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createLeave.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Staff Member" required error={errors.staff_id?.message}>
          <Select placeholder="Select staff member" options={staffOptions} error={!!errors.staff_id} {...register('staff_id')} />
        </FormField>
        <FormField label="Leave Type" required error={errors.leave_type?.message}>
          <Select options={leaveTypes} {...register('leave_type')} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date" required error={errors.start_date?.message}>
            <Input type="date" error={!!errors.start_date} {...register('start_date')} />
          </FormField>
          <FormField label="End Date" required error={errors.end_date?.message}>
            <Input type="date" min={start} error={!!errors.end_date} {...register('end_date')} />
          </FormField>
        </div>
        {days > 0 && <p className="text-sm text-gray-500">{days} day{days === 1 ? '' : 's'} of leave</p>}
        <FormField label="Reason" error={errors.reason?.message}>
          <Textarea {...register('reason')} placeholder="Optional" />
        </FormField>
      </form>
    </Modal>
  );
}
