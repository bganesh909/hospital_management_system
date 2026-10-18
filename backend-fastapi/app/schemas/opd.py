from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel


# ---------- OPD Visit ----------
class OpdVisitCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    appointment_id: UUID | None = None
    symptoms: str | None = None
    diagnosis: str | None = None
    treatment_plan: str | None = None
    follow_up_date: date | None = None
    vitals_bp: str | None = None
    vitals_temp: float | None = None
    vitals_pulse: int | None = None
    vitals_weight: float | None = None
    vitals_height: float | None = None
    vitals_spo2: int | None = None


class OpdVisitUpdate(BaseModel):
    symptoms: str | None = None
    diagnosis: str | None = None
    treatment_plan: str | None = None
    follow_up_date: date | None = None
    vitals_bp: str | None = None
    vitals_temp: float | None = None
    vitals_pulse: int | None = None
    vitals_weight: float | None = None
    vitals_height: float | None = None
    vitals_spo2: int | None = None


class OpdVisitResponse(BaseModel):
    id: UUID
    visit_number: str
    patient_id: UUID
    doctor_id: UUID
    appointment_id: UUID | None
    visit_date: datetime
    symptoms: str | None
    diagnosis: str | None
    treatment_plan: str | None
    follow_up_date: date | None
    vitals_bp: str | None
    vitals_temp: float | None
    vitals_pulse: int | None
    vitals_weight: float | None
    vitals_height: float | None
    vitals_spo2: int | None
    status: str
    patient_name: str | None = None
    doctor_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Prescription ----------
class PrescriptionItemCreate(BaseModel):
    medicine_id: UUID | None = None
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str | None = None
    quantity: int = 1


class PrescriptionItemResponse(BaseModel):
    id: UUID
    prescription_id: UUID
    medicine_id: UUID | None
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str | None
    quantity: int
    unit_price: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PrescriptionCreate(BaseModel):
    opd_visit_id: UUID | None = None
    ipd_admission_id: UUID | None = None
    patient_id: UUID
    doctor_id: UUID
    notes: str | None = None
    items: list[PrescriptionItemCreate] = []


class PrescriptionUpdate(BaseModel):
    notes: str | None = None
    status: Literal["active", "dispensed", "cancelled"] | None = None


class PrescriptionResponse(BaseModel):
    id: UUID
    prescription_number: str
    opd_visit_id: UUID | None
    ipd_admission_id: UUID | None
    patient_id: UUID
    doctor_id: UUID
    notes: str | None
    status: str
    patient_name: str | None = None
    doctor_name: str | None = None
    items: list[PrescriptionItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
