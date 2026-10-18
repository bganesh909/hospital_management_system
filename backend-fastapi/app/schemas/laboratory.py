from datetime import datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, Field

LabPriority = Literal["normal", "urgent", "stat"]
LabRequestStatus = Literal["requested", "sample_collected", "processing", "completed", "cancelled"]
LabResultStatus = Literal["normal", "abnormal", "critical"]


# ---------- Catalog ----------
class LabTestCatalogCreate(BaseModel):
    test_code: str = Field(min_length=1, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    description: str | None = None
    normal_range: str | None = None
    unit: str | None = None
    price: float = Field(ge=0)
    turnaround_hours: int = Field(24, ge=1)
    is_active: bool = True


class LabTestCatalogUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    category: str | None = None
    description: str | None = None
    normal_range: str | None = None
    unit: str | None = None
    price: float | None = Field(None, ge=0)
    turnaround_hours: int | None = Field(None, ge=1)
    is_active: bool | None = None


class LabTestCatalogResponse(BaseModel):
    id: UUID
    test_code: str
    name: str
    category: str | None
    description: str | None
    normal_range: str | None
    unit: str | None
    price: float
    turnaround_hours: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Lab Request ----------
class LabRequestItemCreate(BaseModel):
    test_id: UUID


class LabRequestCreate(BaseModel):
    patient_id: UUID
    doctor_id: UUID
    opd_visit_id: UUID | None = None
    ipd_admission_id: UUID | None = None
    priority: LabPriority = "normal"
    notes: str | None = None
    items: list[LabRequestItemCreate] = Field(min_length=1)


class LabRequestItemResponse(BaseModel):
    id: UUID
    request_id: UUID
    test_id: UUID
    result_value: str | None
    result_status: str
    performed_by: UUID | None
    performed_at: datetime | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime
    test_name: str | None = None
    test_code: str | None = None
    normal_range: str | None = None
    unit: str | None = None

    model_config = {"from_attributes": True}


class LabRequestResponse(BaseModel):
    id: UUID
    request_number: str
    patient_id: UUID
    doctor_id: UUID
    opd_visit_id: UUID | None
    ipd_admission_id: UUID | None
    priority: str
    status: str
    notes: str | None
    items: list[LabRequestItemResponse] = []
    created_at: datetime
    updated_at: datetime
    patient_name: str | None = None
    patient_number: str | None = None
    doctor_name: str | None = None

    model_config = {"from_attributes": True}


class LabStatusUpdate(BaseModel):
    status: LabRequestStatus


class LabResultEntry(BaseModel):
    result_value: str
    result_status: LabResultStatus = "normal"
    remarks: str | None = None
