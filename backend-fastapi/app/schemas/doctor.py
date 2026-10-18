from datetime import datetime, time
from typing import Any
from uuid import UUID

from pydantic import BaseModel, model_validator
from sqlalchemy import inspect as sa_inspect


class OrmSafeModel(BaseModel):
    """Reads ORM objects but skips relationships that weren't eagerly loaded,
    since lazy loading isn't possible under async SQLAlchemy."""

    model_config = {"from_attributes": True}

    @model_validator(mode="before")
    @classmethod
    def _skip_unloaded(cls, data: Any) -> Any:
        state = sa_inspect(data, raiseerr=False)
        if state is None or not hasattr(state, "unloaded"):
            return data
        unloaded = state.unloaded
        return {
            name: getattr(data, name)
            for name in cls.model_fields
            if name not in unloaded and hasattr(data, name)
        }


class UserBrief(OrmSafeModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: str | None = None


class DepartmentBrief(OrmSafeModel):
    id: UUID
    name: str


# ---------- Department ----------
class DepartmentCreate(BaseModel):
    name: str
    description: str | None = None
    head_id: UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    head_id: UUID | None = None


class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    head_id: UUID | None
    head_name: str | None = None
    doctor_count: int = 0
    staff_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Doctor ----------
class DoctorCreate(BaseModel):
    user_id: UUID
    department_id: UUID | None = None
    specialization: str
    qualification: str
    license_number: str
    experience_years: int | None = None
    consultation_fee: float = 0
    bio: str | None = None
    is_available: bool = True


class DoctorUpdate(BaseModel):
    department_id: UUID | None = None
    specialization: str | None = None
    qualification: str | None = None
    experience_years: int | None = None
    consultation_fee: float | None = None
    bio: str | None = None
    is_available: bool | None = None


class DoctorResponse(OrmSafeModel):
    id: UUID
    user_id: UUID
    department_id: UUID | None
    specialization: str
    qualification: str
    license_number: str
    experience_years: int | None
    consultation_fee: float
    bio: str | None
    is_available: bool
    created_at: datetime
    updated_at: datetime
    user: UserBrief | None = None
    department: DepartmentBrief | None = None


# ---------- Schedule ----------
class DoctorScheduleCreate(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time
    max_patients: int = 20
    is_active: bool = True


class DoctorScheduleUpdate(BaseModel):
    day_of_week: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    max_patients: int | None = None
    is_active: bool | None = None


class DoctorScheduleResponse(BaseModel):
    id: UUID
    doctor_id: UUID
    day_of_week: int
    start_time: time
    end_time: time
    max_patients: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
