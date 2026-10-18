from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, Field

WardType = Literal["general", "semi_private", "private", "icu", "nicu", "emergency"]
BedStatus = Literal["available", "occupied", "maintenance", "reserved"]


# ---------- Ward ----------
class WardCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    type: WardType
    floor: int | None = None
    charge_per_day: float = Field(ge=0)
    # Beds to create along with the ward, numbered bed_prefix + 1..total_beds
    total_beds: int = Field(0, ge=0, le=100)
    bed_prefix: str = Field("", max_length=10)


class WardUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    type: WardType | None = None
    floor: int | None = None
    charge_per_day: float | None = Field(None, ge=0)


class WardResponse(BaseModel):
    id: UUID
    name: str
    type: str
    floor: int | None
    total_beds: int
    charge_per_day: float
    occupied_beds: int = 0
    available_beds: int = 0
    maintenance_beds: int = 0
    reserved_beds: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Bed ----------
# "occupied" is only ever set by admission/transfer/discharge, never by hand
ManualBedStatus = Literal["available", "maintenance", "reserved"]


class BedCreate(BaseModel):
    ward_id: UUID
    bed_number: str = Field(min_length=1, max_length=20)
    status: ManualBedStatus = "available"


class BedBulkCreate(BaseModel):
    ward_id: UUID
    prefix: str = Field("", max_length=10)
    start: int = Field(1, ge=0)
    count: int = Field(ge=1, le=100)


class BedUpdate(BaseModel):
    bed_number: str | None = Field(None, min_length=1, max_length=20)
    status: ManualBedStatus | None = None


class BedResponse(BaseModel):
    id: UUID
    ward_id: UUID
    bed_number: str
    is_occupied: bool
    status: str
    created_at: datetime
    ward_name: str | None = None
    ward_type: str | None = None
    charge_per_day: float | None = None
    admission_id: UUID | None = None
    patient_id: UUID | None = None
    patient_name: str | None = None

    model_config = {"from_attributes": True}


# ---------- IPD Admission ----------
class IpdAdmissionCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    bed_id: UUID | None = None
    reason: str
    diagnosis: str | None = None


class IpdAdmissionUpdate(BaseModel):
    doctor_id: UUID | None = None
    bed_id: UUID | None = None
    diagnosis: str | None = None


class IpdDischargeRequest(BaseModel):
    discharge_summary: str | None = None


class IpdTransferRequest(BaseModel):
    bed_id: UUID


class IpdAdmissionResponse(BaseModel):
    id: UUID
    admission_number: str
    patient_id: UUID
    doctor_id: UUID
    bed_id: UUID | None
    admission_date: datetime
    discharge_date: datetime | None
    reason: str
    diagnosis: str | None
    discharge_summary: str | None
    status: str
    admitted_by: UUID | None
    created_at: datetime
    updated_at: datetime
    patient_name: str | None = None
    patient_number: str | None = None
    doctor_name: str | None = None
    ward_id: UUID | None = None
    ward_name: str | None = None
    bed_number: str | None = None

    model_config = {"from_attributes": True}


# ---------- Daily Round ----------
class IpdDailyRoundCreate(BaseModel):
    admission_id: UUID
    doctor_id: UUID
    notes: str | None = None
    vitals_bp: str | None = None
    vitals_temp: float | None = None
    vitals_pulse: int | None = None
    vitals_spo2: int | None = None
    instructions: str | None = None


class IpdDailyRoundResponse(BaseModel):
    id: UUID
    admission_id: UUID
    doctor_id: UUID
    round_date: datetime
    notes: str | None
    vitals_bp: str | None
    vitals_temp: float | None
    vitals_pulse: int | None
    vitals_spo2: int | None
    instructions: str | None
    created_at: datetime
    doctor_name: str | None = None

    model_config = {"from_attributes": True}
