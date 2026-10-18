from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ---------- Category ----------
class MedicineCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class MedicineCategoryUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class MedicineCategoryResponse(BaseModel):
    id: UUID
    name: str
    medicine_count: int = 0

    model_config = {"from_attributes": True}


# ---------- Medicine ----------
class MedicineCreate(BaseModel):
    name: str
    generic_name: str | None = None
    category_id: UUID | None = None
    manufacturer: str | None = None
    unit_price: float
    stock_quantity: int = 0
    reorder_level: int = 10
    expiry_date: date | None = None
    batch_number: str | None = None
    requires_prescription: bool = True
    description: str | None = None


class MedicineUpdate(BaseModel):
    name: str | None = None
    generic_name: str | None = None
    category_id: UUID | None = None
    manufacturer: str | None = None
    unit_price: float | None = None
    reorder_level: int | None = None
    expiry_date: date | None = None
    batch_number: str | None = None
    requires_prescription: bool | None = None
    description: str | None = None


class StockUpdateRequest(BaseModel):
    quantity: int = Field(ge=0)
    operation: Literal["add", "subtract", "set"] = "add"


class MedicineResponse(BaseModel):
    id: UUID
    name: str
    generic_name: str | None
    category_id: UUID | None
    manufacturer: str | None
    unit_price: float
    stock_quantity: int
    reorder_level: int
    expiry_date: date | None
    batch_number: str | None
    requires_prescription: bool
    description: str | None
    category_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Dispensation ----------
class DispensationItemCreate(BaseModel):
    # Prescription items may be free text; when medicine_id is missing the
    # medicine is matched by name. Prices are taken from the medicine record.
    medicine_id: UUID | None = None
    medicine_name: str | None = None
    quantity: int = Field(gt=0)


class DispensationCreate(BaseModel):
    prescription_id: UUID
    notes: str | None = None
    items: list[DispensationItemCreate] = Field(min_length=1)


class DispensationItemResponse(BaseModel):
    id: UUID
    dispensation_id: UUID
    medicine_id: UUID
    medicine_name: str | None = None
    quantity: int
    unit_price: float
    total_price: float
    created_at: datetime

    model_config = {"from_attributes": True}


class DispensationResponse(BaseModel):
    id: UUID
    dispensation_number: str
    prescription_id: UUID
    prescription_number: str | None = None
    patient_id: UUID | None = None
    patient_name: str | None = None
    doctor_name: str | None = None
    dispensed_by: UUID
    total_amount: float
    status: str
    notes: str | None
    items: list[DispensationItemResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}
