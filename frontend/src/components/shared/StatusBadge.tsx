const statusStyles: Record<string, string> = {
  // General
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',

  // Appointments
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-purple-100 text-purple-700',
  no_show: 'bg-orange-100 text-orange-700',

  // Patient
  discharged: 'bg-gray-100 text-gray-600',
  deceased: 'bg-red-100 text-red-600',

  // IPD
  admitted: 'bg-blue-100 text-blue-700',
  transferred: 'bg-yellow-100 text-yellow-700',

  // Pharmacy
  dispensed: 'bg-green-100 text-green-700',
  returned: 'bg-orange-100 text-orange-700',
  partial: 'bg-yellow-100 text-yellow-700',

  // Lab
  requested: 'bg-blue-100 text-blue-700',
  sample_collected: 'bg-indigo-100 text-indigo-700',
  processing: 'bg-purple-100 text-purple-700',
  normal: 'bg-green-100 text-green-700',
  abnormal: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',

  // Billing
  draft: 'bg-gray-100 text-gray-600',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',

  // Insurance
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  settled: 'bg-green-100 text-green-700',

  // Staff
  on_leave: 'bg-yellow-100 text-yellow-700',
  terminated: 'bg-red-100 text-red-600',
  resigned: 'bg-gray-100 text-gray-600',
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  half_day: 'bg-orange-100 text-orange-700',
  leave: 'bg-yellow-100 text-yellow-700',
  holiday: 'bg-blue-100 text-blue-700',

  // Payroll
  processed: 'bg-blue-100 text-blue-700',

  // Payments
  refunded: 'bg-purple-100 text-purple-700',
  failed: 'bg-red-100 text-red-700',

  // Leave
  sick: 'bg-red-100 text-red-600',
  casual: 'bg-blue-100 text-blue-600',
  earned: 'bg-green-100 text-green-600',

  // Priority
  urgent: 'bg-orange-100 text-orange-700',
  stat: 'bg-red-100 text-red-700',

  // Bed
  available: 'bg-green-100 text-green-700',
  occupied: 'bg-red-100 text-red-700',
  maintenance: 'bg-yellow-100 text-yellow-700',
  reserved: 'bg-purple-100 text-purple-700',

  // Referred
  referred: 'bg-indigo-100 text-indigo-700',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-100 text-gray-600';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${style} ${className}`}>
      {label}
    </span>
  );
}
