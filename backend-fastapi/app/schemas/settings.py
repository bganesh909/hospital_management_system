from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class HospitalSettingsUpdate(BaseModel):
    hospital_name: str | None = Field(default=None, min_length=1, max_length=200)
    tagline: str | None = Field(default=None, max_length=200)
    registration_number: str | None = Field(default=None, max_length=100)
    tax_id: str | None = Field(default=None, max_length=50)
    address_line1: str | None = Field(default=None, max_length=255)
    address_line2: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    zip_code: str | None = Field(default=None, max_length=20)
    country: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    email: EmailStr | None = None
    website: str | None = Field(default=None, max_length=255)
    logo_url: str | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    currency_symbol: str | None = Field(default=None, min_length=1, max_length=5)
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    invoice_footer: str | None = None
    timezone: str | None = Field(default=None, max_length=50)


class HospitalSettingsResponse(BaseModel):
    id: UUID
    hospital_name: str
    tagline: str | None
    registration_number: str | None
    tax_id: str | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    zip_code: str | None
    country: str | None
    phone: str | None
    email: str | None
    website: str | None
    logo_url: str | None
    currency: str
    currency_symbol: str
    tax_rate: float
    invoice_footer: str | None
    timezone: str
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
