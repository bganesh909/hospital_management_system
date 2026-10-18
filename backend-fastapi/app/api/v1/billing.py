from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.billing import (
    InsuranceClaimCreate,
    InsuranceClaimResponse,
    InsuranceClaimUpdate,
    InvoiceCancelRequest,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceUpdate,
    PaymentCreate,
    PaymentResponse,
    RefundCreate,
    RefundResponse,
    RevenueResponse,
)
from app.services import billing_service

router = APIRouter(prefix="/billing", tags=["Billing"])


# ---------- Invoices ----------

@router.get("/invoices")
async def list_invoices(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "desc",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await billing_service.list_invoices(
        db,
        page=page,
        limit=limit,
        patient_id=patient_id,
        status=status,
        search=search,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return {
        "success": True,
        "data": [InvoiceResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/invoices", status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    invoice = await billing_service.create_invoice(db, data, generated_by=user.id)
    return {"success": True, "data": InvoiceResponse.model_validate(invoice)}


@router.get("/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    invoice = await billing_service.get_invoice(db, invoice_id)
    return {"success": True, "data": InvoiceResponse.model_validate(invoice)}


@router.put("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: UUID,
    data: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    invoice = await billing_service.update_invoice(db, invoice_id, data)
    return {"success": True, "data": InvoiceResponse.model_validate(invoice)}


@router.patch("/invoices/{invoice_id}/issue")
async def issue_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    invoice = await billing_service.issue_invoice(db, invoice_id)
    return {"success": True, "data": InvoiceResponse.model_validate(invoice)}


@router.patch("/invoices/{invoice_id}/cancel")
async def cancel_invoice(
    invoice_id: UUID,
    data: InvoiceCancelRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    invoice = await billing_service.cancel_invoice(db, invoice_id, data or InvoiceCancelRequest())
    return {"success": True, "data": InvoiceResponse.model_validate(invoice)}


# ---------- Payments ----------

@router.get("/payments")
async def list_payments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    invoice_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await billing_service.list_payments(db, page=page, limit=limit, invoice_id=invoice_id)
    return {
        "success": True,
        "data": [PaymentResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/payments", status_code=201)
async def create_payment(
    data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    payment = await billing_service.create_payment(db, data, received_by=user.id)
    return {"success": True, "data": PaymentResponse.model_validate(payment)}


# ---------- Refunds ----------

@router.post("/payments/{payment_id}/refund", status_code=201)
async def refund_payment(
    payment_id: UUID,
    data: RefundCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    refund = await billing_service.create_refund(db, payment_id, data, refunded_by=user.id)
    return {"success": True, "data": RefundResponse.model_validate(refund)}


@router.get("/refunds")
async def list_refunds(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    invoice_id: UUID | None = None,
    payment_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await billing_service.list_refunds(
        db, page=page, limit=limit, invoice_id=invoice_id, payment_id=payment_id
    )
    return {
        "success": True,
        "data": [RefundResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


# ---------- Insurance Claims ----------

@router.get("/insurance-claims")
async def list_claims(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    invoice_id: UUID | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await billing_service.list_claims(
        db, page=page, limit=limit, status=status, invoice_id=invoice_id, search=search
    )
    return {
        "success": True,
        "data": [InsuranceClaimResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/insurance-claims", status_code=201)
async def create_claim(
    data: InsuranceClaimCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.receptionist)),
):
    claim = await billing_service.create_claim(db, data)
    return {"success": True, "data": InsuranceClaimResponse.model_validate(claim)}


@router.patch("/insurance-claims/{claim_id}")
async def update_claim(
    claim_id: UUID,
    data: InsuranceClaimUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    claim = await billing_service.update_claim(db, claim_id, data, updated_by=user.id)
    return {"success": True, "data": InsuranceClaimResponse.model_validate(claim)}


# ---------- Revenue ----------

@router.get("/revenue")
async def get_revenue(
    date_from: date | None = Query(None, alias="from"),
    date_to: date | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    stats = await billing_service.get_revenue_stats(db, date_from=date_from, date_to=date_to)
    return {"success": True, "data": stats}
