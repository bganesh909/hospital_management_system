from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel

from app.models.appointment import AppointmentStatus
from app.schemas.doctor import OrmSafeModel, UserBrief


class AppointmentPatientBrief(OrmSafeModel):
    id: UUID
    first_name: str
    last_name: str
    patient_number: str
    phone: str


class AppointmentDoctorBrief(OrmSafeModel):
    id: UUID
    specialization: str
    user: UserBrief | None = None


class AppointmentCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    appointment_date: date
    start_time: time
    end_time: time | None = None
    type: str = "consultation"
    reason: str | None = None
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    doctor_id: UUID | None = None
    appointment_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    type: str | None = None
    reason: str | None = None
    notes: str | None = None


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus


class AppointmentCancelRequest(BaseModel):
    cancelled_reason: str | None = None


class AppointmentResponse(OrmSafeModel):
    id: UUID
    appointment_number: str
    patient_id: UUID
    doctor_id: UUID
    appointment_date: date
    start_time: time
    end_time: time | None
    status: AppointmentStatus
    type: str
    reason: str | None
    notes: str | None
    cancelled_reason: str | None
    booked_by: UUID | None
    created_at: datetime
    updated_at: datetime
    patient: AppointmentPatientBrief | None = None
    doctor: AppointmentDoctorBrief | None = None


class SlotResponse(BaseModel):
    start_time: time
    end_time: time
    available: bool
