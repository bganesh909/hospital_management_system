from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    blood_group: str | None = None
    phone: str
    email: EmailStr | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    insurance_provider: str | None = None
    insurance_policy_number: str | None = None
    allergies: str | None = None


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    blood_group: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    zip_code: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    insurance_provider: str | None = None
    insurance_policy_number: str | None = None
    allergies: str | None = None
    status: str | None = None


class PatientResponse(BaseModel):
    id: UUID
    patient_number: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    blood_group: str | None
    phone: str
    email: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    insurance_provider: str | None
    insurance_policy_number: str | None
    allergies: str | None
    status: str
    registered_by: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
