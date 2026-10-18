from pydantic import BaseModel


class WeeklyVisit(BaseModel):
    day: str
    patients: int


class DashboardStats(BaseModel):
    total_patients: int
    new_patients_this_month: int
    patients_change: float | None
    todays_appointments: int
    appointments_change: float | None
    total_beds: int
    occupied_beds: int
    bed_occupancy_percent: float
    monthly_revenue: float
    revenue_change: float | None
    total_doctors: int
    total_staff: int
    active_admissions: int
    weekly_visits: list[WeeklyVisit]


class TodayAppointment(BaseModel):
    id: str
    time: str | None
    status: str
    patient_name: str
    doctor_name: str
    department: str | None


class RevenueDataPoint(BaseModel):
    month: str
    revenue: float
    expenses: float


class RevenueTotals(BaseModel):
    total_invoiced: float
    total_paid: float
    total_pending: float


class RevenueReport(BaseModel):
    series: list[RevenueDataPoint]
    totals: RevenueTotals


class WardOccupancy(BaseModel):
    ward_id: str
    ward: str
    total_beds: int
    occupied: int
    available: int
    occupancy_percent: float


class DepartmentStat(BaseModel):
    department: str
    patients: int
    doctors: int


class RecentActivity(BaseModel):
    id: str
    type: str
    description: str
    timestamp: str


class PatientTrendPoint(BaseModel):
    month: str
    new_patients: int
    returning: int


class PatientSummary(BaseModel):
    total_patients: int
    new_in_range: int
    new_this_month: int
    returning_in_range: int


class PatientReport(BaseModel):
    series: list[PatientTrendPoint]
    summary: PatientSummary


class AttendanceTrendPoint(BaseModel):
    month: str
    present: float
    absent: float
    leave: float


class AttendanceReport(BaseModel):
    total_staff: int
    on_leave: int
    average_attendance: float
    months: list[AttendanceTrendPoint]
