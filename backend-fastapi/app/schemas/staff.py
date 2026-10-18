from datetime import date, datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, Field, model_validator

EmploymentType = Literal["full_time", "part_time", "contract", "intern"]
Shift = Literal["day", "night", "rotating"]
StaffStatus = Literal["active", "on_leave", "terminated", "resigned"]
AttendanceStatus = Literal["present", "absent", "half_day", "leave", "holiday"]
LeaveType = Literal["sick", "casual", "earned", "maternity", "paternity", "unpaid"]
LeaveStatus = Literal["pending", "approved", "rejected", "cancelled"]


# ---------- Staff ----------
class StaffCreate(BaseModel):
    user_id: UUID
    department_id: UUID | None = None
    designation: str
    join_date: date
    salary: float | None = None
    employment_type: EmploymentType = "full_time"
    shift: Shift = "day"


class StaffUpdate(BaseModel):
    department_id: UUID | None = None
    designation: str | None = None
    join_date: date | None = None
    salary: float | None = None
    employment_type: EmploymentType | None = None
    shift: Shift | None = None
    status: StaffStatus | None = None


class StaffResponse(BaseModel):
    id: UUID
    user_id: UUID
    employee_number: str
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    department_id: UUID | None
    department_name: str | None = None
    designation: str
    join_date: date
    salary: float | None
    employment_type: str
    shift: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Attendance ----------
class AttendanceCreate(BaseModel):
    staff_id: UUID
    date: date
    check_in: datetime | None = None
    check_out: datetime | None = None
    status: AttendanceStatus = "present"
    hours_worked: float | None = None
    notes: str | None = None


class AttendanceResponse(BaseModel):
    id: UUID
    staff_id: UUID
    full_name: str | None = None
    employee_number: str | None = None
    date: date
    check_in: datetime | None
    check_out: datetime | None
    status: str
    hours_worked: float | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Leave Request ----------
class LeaveRequestCreate(BaseModel):
    staff_id: UUID
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str | None = None

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class LeaveRequestUpdate(BaseModel):
    status: LeaveStatus | None = None
    approved_by: UUID | None = None


class LeaveRequestResponse(BaseModel):
    id: UUID
    staff_id: UUID
    full_name: str | None = None
    employee_number: str | None = None
    leave_type: str
    start_date: date
    end_date: date
    reason: str | None
    status: str
    approved_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Payroll ----------
class PayrollCreate(BaseModel):
    staff_id: UUID
    month: int = Field(ge=1, le=12)
    year: int
    basic_salary: float
    allowances: float = 0
    deductions: float = 0
    net_salary: float


class PayrollUpdate(BaseModel):
    allowances: float | None = Field(None, ge=0)
    deductions: float | None = Field(None, ge=0)


class PayrollSummary(BaseModel):
    month: int
    year: int
    total_records: int
    total_basic: float
    total_allowances: float
    total_deductions: float
    total_net: float
    paid_count: int
    paid_amount: float
    pending_count: int
    pending_amount: float


class PayrollGenerateRequest(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)


class PayrollGenerateResponse(BaseModel):
    created: int


class PayrollResponse(BaseModel):
    id: UUID
    staff_id: UUID
    full_name: str | None = None
    employee_number: str | None = None
    month: int
    year: int
    basic_salary: float
    allowances: float
    deductions: float
    net_salary: float
    status: str
    paid_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
