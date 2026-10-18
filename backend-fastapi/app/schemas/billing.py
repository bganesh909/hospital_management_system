from datetime import date, datetime
from uuid import UUID

from typing import Literal

from pydantic import BaseModel, Field

InvoiceItemType = Literal["consultation", "lab_test", "medicine", "bed_charge", "procedure", "other"]

InvoiceStatus = Literal["draft", "issued", "partial", "paid", "overdue", "cancelled"]
PaymentMethod = Literal["cash", "card", "upi", "bank_transfer", "insurance", "cheque"]
ClaimStatus = Literal["submitted", "under_review", "approved", "rejected", "settled"]


# ---------- Invoice ----------
class InvoiceItemCreate(BaseModel):
    item_type: InvoiceItemType
    item_reference_id: UUID | None = None
    description: str
    quantity: int = Field(1, ge=1)
    unit_price: float = Field(ge=0)
    total_price: float | None = None


class InvoiceCreate(BaseModel):
    patient_id: UUID
    ipd_admission_id: UUID | None = None
    subtotal: float = 0
    tax_amount: float = Field(0, ge=0)
    discount_amount: float = Field(0, ge=0)
    total_amount: float = 0
    due_date: date | None = None
    notes: str | None = None
    items: list[InvoiceItemCreate] = []
    issue: bool = False


class InvoiceUpdate(BaseModel):
    """Draft invoices only. Totals are recomputed server-side; `items` replaces all line items."""
    items: list[InvoiceItemCreate] | None = Field(None, min_length=1)
    tax_amount: float | None = Field(None, ge=0)
    discount_amount: float | None = Field(None, ge=0)
    due_date: date | None = None
    notes: str | None = None


class InvoiceCancelRequest(BaseModel):
    reason: str | None = None


class InvoiceItemResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    item_type: str
    item_reference_id: UUID | None
    description: str
    quantity: int
    unit_price: float
    total_price: float
    created_at: datetime

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_number: str
    patient_id: UUID
    patient_name: str | None = None
    ipd_admission_id: UUID | None
    subtotal: float
    tax_amount: float
    discount_amount: float
    total_amount: float
    paid_amount: float
    due_amount: float
    status: str
    due_date: date | None
    notes: str | None
    generated_by: UUID | None
    items: list[InvoiceItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------- Payment ----------
class PaymentCreate(BaseModel):
    invoice_id: UUID
    amount: float = Field(gt=0)
    method: PaymentMethod
    transaction_ref: str | None = None
    notes: str | None = None


class PaymentResponse(BaseModel):
    id: UUID
    payment_number: str
    invoice_id: UUID
    amount: float = Field(gt=0)
    method: PaymentMethod
    transaction_ref: str | None
    status: str
    refunded_amount: float = 0
    received_by: UUID | None
    payment_date: datetime
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Refund ----------
class RefundCreate(BaseModel):
    amount: float = Field(gt=0)
    reason: str = Field(min_length=1)
    method: PaymentMethod | None = None
    # When true the invoice total is reduced by the refund (service not provided),
    # so the patient doesn't owe the refunded amount again
    adjust_invoice: bool = False


class RefundResponse(BaseModel):
    id: UUID
    refund_number: str
    payment_id: UUID
    payment_number: str | None = None
    invoice_id: UUID
    amount: float
    method: str
    reason: str
    adjusted_invoice: bool
    refunded_by: UUID | None
    refunded_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Insurance Claim ----------
class InsuranceClaimCreate(BaseModel):
    invoice_id: UUID
    # Taken from the invoice when omitted
    patient_id: UUID | None = None
    insurance_provider: str = Field(min_length=1, max_length=200)
    policy_number: str = Field(min_length=1, max_length=100)
    claimed_amount: float = Field(gt=0)


class InsuranceClaimUpdate(BaseModel):
    status: ClaimStatus | None = None
    approved_amount: float | None = Field(None, ge=0)
    remarks: str | None = None


class InsuranceClaimResponse(BaseModel):
    id: UUID
    claim_number: str
    patient_id: UUID
    patient_name: str | None = None
    invoice_id: UUID
    invoice_number: str | None = None
    insurance_provider: str
    policy_number: str
    claimed_amount: float
    approved_amount: float | None
    status: str
    submitted_at: datetime
    settled_at: datetime | None
    remarks: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RevenueResponse(BaseModel):
    total_revenue: float
    total_paid: float
    total_pending: float
    total_invoices: int
