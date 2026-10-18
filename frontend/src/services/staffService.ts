import api from '../config/api';

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern';
export type StaffShift = 'day' | 'night' | 'rotating';
export type StaffStatus = 'active' | 'on_leave' | 'terminated' | 'resigned';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave' | 'holiday';

export interface StaffMember {
  id: string;
  user_id: string;
  employee_number: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  designation: string;
  employment_type: EmploymentType;
  shift: StaffShift;
  join_date: string;
  salary?: number | null;
  status: StaffStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateStaffPayload {
  user_id: string;
  department_id?: string;
  designation: string;
  join_date: string;
  salary?: number;
  employment_type: EmploymentType;
  shift: StaffShift;
}

export interface UpdateStaffPayload {
  department_id?: string;
  designation?: string;
  join_date?: string;
  salary?: number;
  employment_type?: EmploymentType;
  shift?: StaffShift;
  status?: StaffStatus;
}

export interface AttendanceRecord {
  id: string;
  staff_id: string;
  employee_number?: string | null;
  full_name?: string | null;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  hours_worked?: number | null;
  status: AttendanceStatus;
  notes?: string | null;
  created_at: string;
}

export interface MarkAttendancePayload {
  staff_id: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status?: AttendanceStatus;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  staff_id: string;
  full_name?: string | null;
  employee_number?: string | null;
  leave_type: 'sick' | 'casual' | 'earned' | 'maternity' | 'paternity' | 'unpaid';
  start_date: string;
  end_date: string;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLeaveRequestPayload {
  staff_id: string;
  leave_type: LeaveRequest['leave_type'];
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface UpdateLeaveRequestPayload {
  status: LeaveRequest['status'];
}

export interface PayrollRecord {
  id: string;
  staff_id: string;
  employee_number?: string | null;
  full_name?: string | null;
  month: number;
  year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: 'pending' | 'processed' | 'paid';
  paid_at?: string | null;
  created_at: string;
}

export interface PayrollSummary {
  month: number;
  year: number;
  total_records: number;
  total_basic: number;
  total_allowances: number;
  total_deductions: number;
  total_net: number;
  paid_count: number;
  paid_amount: number;
  pending_count: number;
  pending_amount: number;
}

export interface UpdatePayrollPayload {
  allowances?: number;
  deductions?: number;
}

export const staffService = {
  getStaff: async (params?: Record<string, any>) => {
    const response = await api.get('/staff', { params });
    return response.data;
  },

  getStaffMember: async (id: string) => {
    const response = await api.get(`/staff/${id}`);
    return response.data;
  },

  createStaff: async (data: CreateStaffPayload) => {
    const response = await api.post('/staff', data);
    return response.data;
  },

  updateStaff: async (id: string, data: UpdateStaffPayload) => {
    const response = await api.put(`/staff/${id}`, data);
    return response.data;
  },

  // Attendance
  getAttendance: async (params?: Record<string, any>) => {
    const response = await api.get('/staff/attendance/list', { params });
    return response.data;
  },

  markAttendance: async (data: MarkAttendancePayload) => {
    const response = await api.post('/staff/attendance', data);
    return response.data;
  },

  getStaffAttendance: async (staffId: string, month: number, year: number) => {
    const response = await api.get('/staff/attendance/list', {
      params: { staff_id: staffId, month, year },
    });
    return response.data;
  },

  // Leave
  getLeaveRequests: async (params?: Record<string, any>) => {
    const response = await api.get('/staff/leave-requests/list', { params });
    return response.data;
  },

  createLeaveRequest: async (data: CreateLeaveRequestPayload) => {
    const response = await api.post('/staff/leave-requests', data);
    return response.data;
  },

  updateLeaveRequest: async (id: string, data: UpdateLeaveRequestPayload) => {
    const response = await api.patch(`/staff/leave-requests/${id}`, data);
    return response.data;
  },

  // Payroll
  getPayroll: async (params: { month: number; year: number; page?: number; limit?: number }) => {
    const response = await api.get('/staff/payroll/list', { params });
    return response.data;
  },

  generatePayroll: async (data: { month: number; year: number }) => {
    const response = await api.post('/staff/payroll/generate', data);
    return response.data;
  },

  getPayrollSummary: async (params: { month: number; year: number }) => {
    const response = await api.get('/staff/payroll/summary', { params });
    return response.data;
  },

  updatePayroll: async (id: string, data: UpdatePayrollPayload) => {
    const response = await api.patch(`/staff/payroll/${id}`, data);
    return response.data;
  },

  markPayrollPaid: async (id: string) => {
    const response = await api.patch(`/staff/payroll/${id}/pay`);
    return response.data;
  },
};
