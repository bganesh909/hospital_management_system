from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Select, cast, func, or_, select, update, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.billing import InsuranceClaim, Invoice, InvoiceItem, Payment, PaymentRefund
from app.models.patient import Patient
from app.schemas.billing import (
    InsuranceClaimCreate,
    InsuranceClaimUpdate,
    InvoiceCancelRequest,
    InvoiceCreate,
    InvoiceItemCreate,
    InvoiceUpdate,
    PaymentCreate,
    RefundCreate,
)
from app.utils.generators import generate_sequential_number

INVOICE_OPTIONS = (selectinload(Invoice.items), selectinload(Invoice.patient))
CLAIM_OPTIONS = (selectinload(InsuranceClaim.patient), selectinload(InsuranceClaim.invoice))
REFUND_OPTIONS = (selectinload(PaymentRefund.payment),)


def _money(value: Any) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


async def _paginate(
    db: AsyncSession, query: Select, filters: list[Any], page: int, limit: int
) -> tuple[list, int]:
    for f in filters:
        query = query.where(f)
    count_query = select(func.count()).select_from(query.order_by(None).subquery())
    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    return list(result.scalars().unique().all()), total


async def _get_one(db: AsyncSession, model, obj_id: UUID, options) -> Any:
    result = await db.execute(
        select(model)
        .where(model.id == obj_id)
        .options(*options)
        .execution_options(populate_existing=True)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundError(f"{model.__name__} not found")
    return obj


# ---------- Invoices ----------

INVOICE_SORT_COLUMNS = {
    "invoice_number": Invoice.invoice_number,
    "total_amount": Invoice.total_amount,
    "due_amount": Invoice.due_amount,
    "created_at": Invoice.created_at,
    "patient_name": Patient.first_name,
}


def _build_items(items: list[InvoiceItemCreate]) -> list[InvoiceItem]:
    return [
        InvoiceItem(
            **item.model_dump(exclude={"total_price"}),
            total_price=_money(item.quantity * item.unit_price),
        )
        for item in items
    ]


def _apply_totals(invoice: Invoice, subtotal: Decimal) -> None:
    """Recompute total/due from subtotal, tax, discount and what has been paid."""
    invoice.subtotal = subtotal
    invoice.total_amount = max(subtotal + _money(invoice.tax_amount) - _money(invoice.discount_amount), Decimal("0"))
    invoice.due_amount = max(_money(invoice.total_amount) - _money(invoice.paid_amount), Decimal("0"))


def _refresh_payment_status(invoice: Invoice) -> None:
    if invoice.status in ("draft", "cancelled"):
        return
    paid = _money(invoice.paid_amount)
    if invoice.due_amount == 0 and paid > 0:
        invoice.status = "paid"
    elif paid > 0:
        invoice.status = "partial"
    elif invoice.status in ("partial", "paid"):
        invoice.status = "issued"


async def create_invoice(db: AsyncSession, data: InvoiceCreate, generated_by: UUID) -> Invoice:
    inv_number = await generate_sequential_number(db, Invoice, "INV", "invoice_number")

    # Totals are computed server-side from the line items
    items = _build_items(data.items)
    subtotal = sum((i.total_price for i in items), Decimal("0")) if items else _money(data.subtotal)

    invoice = Invoice(
        invoice_number=inv_number,
        patient_id=data.patient_id,
        ipd_admission_id=data.ipd_admission_id,
        tax_amount=_money(data.tax_amount),
        discount_amount=_money(data.discount_amount),
        paid_amount=Decimal("0"),
        status="issued" if data.issue else "draft",
        due_date=data.due_date,
        notes=data.notes,
        generated_by=generated_by,
        items=items,
    )
    _apply_totals(invoice, subtotal)
    db.add(invoice)
    await db.flush()
    return await get_invoice(db, invoice.id)


async def mark_overdue_invoices(db: AsyncSession) -> None:
    """Flag issued/partially-paid invoices whose due date has passed."""
    await db.execute(
        update(Invoice)
        .where(
            Invoice.status.in_(("issued", "partial")),
            Invoice.due_date.is_not(None),
            Invoice.due_date < date.today(),
        )
        .values(status="overdue")
        .execution_options(synchronize_session=False)
    )


async def get_invoice(db: AsyncSession, invoice_id: UUID) -> Invoice:
    return await _get_one(db, Invoice, invoice_id, INVOICE_OPTIONS)


async def list_invoices(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    patient_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: str | None = None,
    sort_dir: str = "desc",
) -> tuple[list[Invoice], int]:
    await mark_overdue_invoices(db)
    query = select(Invoice).join(Patient, Invoice.patient_id == Patient.id).options(*INVOICE_OPTIONS)
    filters = []
    if patient_id:
        filters.append(Invoice.patient_id == patient_id)
    if status:
        filters.append(Invoice.status == status)
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                Invoice.invoice_number.ilike(term),
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.patient_number.ilike(term),
            )
        )
    if date_from:
        filters.append(cast(Invoice.created_at, Date) >= date_from)
    if date_to:
        filters.append(cast(Invoice.created_at, Date) <= date_to)
    column = INVOICE_SORT_COLUMNS.get(sort_by or "", Invoice.created_at)
    query = query.order_by(column.asc() if sort_dir == "asc" else column.desc())
    return await _paginate(db, query, filters, page, limit)


async def update_invoice(db: AsyncSession, invoice_id: UUID, data: InvoiceUpdate) -> Invoice:
    invoice = await get_invoice(db, invoice_id)
    if invoice.status != "draft":
        raise BadRequestError("Only draft invoices can be edited")
    values = data.model_dump(exclude_unset=True)
    if "tax_amount" in values:
        invoice.tax_amount = _money(values["tax_amount"])
    if "discount_amount" in values:
        invoice.discount_amount = _money(values["discount_amount"])
    if "due_date" in values:
        invoice.due_date = values["due_date"]
    if "notes" in values:
        invoice.notes = values["notes"]
    if data.items is not None:
        # delete-orphan cascade removes the old rows
        invoice.items = _build_items(data.items)
    subtotal = sum((_money(i.total_price) for i in invoice.items), Decimal("0"))
    _apply_totals(invoice, subtotal)
    await db.flush()
    return await get_invoice(db, invoice_id)


async def cancel_invoice(db: AsyncSession, invoice_id: UUID, data: InvoiceCancelRequest) -> Invoice:
    invoice = await get_invoice(db, invoice_id)
    if invoice.status not in ("draft", "issued", "overdue"):
        raise BadRequestError(f"A {invoice.status} invoice cannot be cancelled")
    has_payments = await db.execute(
        select(Payment.id).where(Payment.invoice_id == invoice_id, Payment.status == "completed").limit(1)
    )
    if _money(invoice.paid_amount) > 0 or has_payments.first():
        raise BadRequestError("Invoices with payments cannot be cancelled; refund the payments first")
    open_claims = await db.execute(
        select(InsuranceClaim.id)
        .where(InsuranceClaim.invoice_id == invoice_id, InsuranceClaim.status.not_in(("rejected",)))
        .limit(1)
    )
    if open_claims.first():
        raise BadRequestError("This invoice has an insurance claim; reject the claim before cancelling")
    invoice.status = "cancelled"
    invoice.due_amount = Decimal("0")
    if data.reason:
        invoice.notes = f"{invoice.notes}\n" if invoice.notes else ""
        invoice.notes += f"Cancelled: {data.reason}"
    await db.flush()
    return await get_invoice(db, invoice_id)


async def issue_invoice(db: AsyncSession, invoice_id: UUID) -> Invoice:
    invoice = await get_invoice(db, invoice_id)
    if invoice.status != "draft":
        raise BadRequestError("Only draft invoices can be issued")
    invoice.status = "issued"
    await db.flush()
    return await get_invoice(db, invoice_id)


# ---------- Payments ----------

async def create_payment(db: AsyncSession, data: PaymentCreate, received_by: UUID) -> Payment:
    invoice = await get_invoice(db, data.invoice_id)
    if invoice.status in ("draft", "cancelled", "paid"):
        raise BadRequestError(f"Cannot record a payment on a {invoice.status} invoice")
    amount = _money(data.amount)
    if amount > _money(invoice.due_amount):
        raise BadRequestError("Payment exceeds the outstanding amount")

    pay_number = await generate_sequential_number(db, Payment, "PAY", "payment_number")
    invoice.paid_amount = _money(invoice.paid_amount) + amount
    invoice.due_amount = max(_money(invoice.total_amount) - invoice.paid_amount, Decimal("0"))
    _refresh_payment_status(invoice)

    payment = Payment(
        payment_number=pay_number,
        invoice_id=data.invoice_id,
        amount=amount,
        method=data.method,
        transaction_ref=data.transaction_ref,
        received_by=received_by,
        notes=data.notes,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)
    return payment


async def list_payments(
    db: AsyncSession, page: int = 1, limit: int = 20, invoice_id: UUID | None = None
) -> tuple[list[Payment], int]:
    query = select(Payment).order_by(Payment.payment_date.desc())
    filters = []
    if invoice_id:
        filters.append(Payment.invoice_id == invoice_id)
    return await _paginate(db, query, filters, page, limit)


# ---------- Refunds ----------

async def create_refund(db: AsyncSession, payment_id: UUID, data: RefundCreate, refunded_by: UUID) -> PaymentRefund:
    result = await db.execute(select(Payment).where(Payment.id == payment_id).with_for_update())
    payment = result.scalar_one_or_none()
    if not payment:
        raise NotFoundError("Payment not found")
    if payment.status != "completed":
        raise BadRequestError(f"Cannot refund a {payment.status} payment")
    amount = _money(data.amount)
    refundable = _money(payment.amount) - _money(payment.refunded_amount)
    if amount > refundable:
        raise BadRequestError(f"Refund exceeds the refundable amount ({refundable})")

    invoice = await get_invoice(db, payment.invoice_id)
    refund_number = await generate_sequential_number(db, PaymentRefund, "RFD", "refund_number")

    payment.refunded_amount = _money(payment.refunded_amount) + amount
    if payment.refunded_amount >= _money(payment.amount):
        payment.status = "refunded"

    invoice.paid_amount = max(_money(invoice.paid_amount) - amount, Decimal("0"))
    if data.adjust_invoice:
        # Service not provided: write the refunded amount off the invoice
        invoice.discount_amount = _money(invoice.discount_amount) + amount
    _apply_totals(invoice, _money(invoice.subtotal))
    _refresh_payment_status(invoice)

    refund = PaymentRefund(
        refund_number=refund_number,
        payment_id=payment.id,
        invoice_id=invoice.id,
        amount=amount,
        method=data.method or payment.method,
        reason=data.reason,
        adjusted_invoice=data.adjust_invoice,
        refunded_by=refunded_by,
    )
    db.add(refund)
    await db.flush()
    return await _get_one(db, PaymentRefund, refund.id, REFUND_OPTIONS)


async def list_refunds(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    invoice_id: UUID | None = None,
    payment_id: UUID | None = None,
) -> tuple[list[PaymentRefund], int]:
    query = select(PaymentRefund).options(*REFUND_OPTIONS).order_by(PaymentRefund.refunded_at.desc())
    filters = []
    if invoice_id:
        filters.append(PaymentRefund.invoice_id == invoice_id)
    if payment_id:
        filters.append(PaymentRefund.payment_id == payment_id)
    return await _paginate(db, query, filters, page, limit)


# ---------- Insurance Claims ----------

CLAIM_TRANSITIONS = {
    "submitted": {"under_review", "approved", "rejected"},
    "under_review": {"approved", "rejected"},
    "approved": {"settled"},
    "rejected": set(),
    "settled": set(),
}


async def create_claim(db: AsyncSession, data: InsuranceClaimCreate) -> InsuranceClaim:
    invoice = await get_invoice(db, data.invoice_id)
    if invoice.status in ("draft", "cancelled"):
        raise BadRequestError(f"Cannot claim insurance on a {invoice.status} invoice")
    if data.patient_id and data.patient_id != invoice.patient_id:
        raise BadRequestError("Patient does not match the invoice")
    if _money(data.claimed_amount) > _money(invoice.total_amount):
        raise BadRequestError("Claimed amount exceeds the invoice total")
    active = await db.execute(
        select(InsuranceClaim.id)
        .where(InsuranceClaim.invoice_id == invoice.id, InsuranceClaim.status.not_in(("rejected",)))
        .limit(1)
    )
    if active.first():
        raise BadRequestError("This invoice already has an active insurance claim")

    claim_number = await generate_sequential_number(db, InsuranceClaim, "CLM", "claim_number")
    claim = InsuranceClaim(
        **data.model_dump(exclude={"patient_id", "claimed_amount"}),
        patient_id=invoice.patient_id,
        claimed_amount=_money(data.claimed_amount),
        claim_number=claim_number,
    )
    db.add(claim)
    await db.flush()
    return await _get_one(db, InsuranceClaim, claim.id, CLAIM_OPTIONS)


async def list_claims(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    invoice_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[InsuranceClaim], int]:
    query = select(InsuranceClaim).options(*CLAIM_OPTIONS).order_by(InsuranceClaim.created_at.desc())
    filters = []
    if status:
        filters.append(InsuranceClaim.status == status)
    if invoice_id:
        filters.append(InsuranceClaim.invoice_id == invoice_id)
    if search:
        term = f"%{search}%"
        query = query.join(Patient, InsuranceClaim.patient_id == Patient.id)
        filters.append(
            or_(
                InsuranceClaim.claim_number.ilike(term),
                InsuranceClaim.insurance_provider.ilike(term),
                InsuranceClaim.policy_number.ilike(term),
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
            )
        )
    return await _paginate(db, query, filters, page, limit)


async def update_claim(
    db: AsyncSession, claim_id: UUID, data: InsuranceClaimUpdate, updated_by: UUID | None = None
) -> InsuranceClaim:
    claim = await _get_one(db, InsuranceClaim, claim_id, CLAIM_OPTIONS)
    values = data.model_dump(exclude_unset=True)
    new_status = values.get("status")

    if "approved_amount" in values and values["approved_amount"] is not None:
        if claim.status not in ("submitted", "under_review") and new_status != "approved":
            raise BadRequestError("Approved amount can only be set while approving the claim")
        if _money(values["approved_amount"]) > _money(claim.claimed_amount):
            raise BadRequestError("Approved amount cannot exceed the claimed amount")
        claim.approved_amount = _money(values["approved_amount"])

    if new_status and new_status != claim.status:
        if new_status not in CLAIM_TRANSITIONS.get(claim.status, set()):
            raise BadRequestError(f"Cannot change claim from '{claim.status}' to '{new_status}'")
        if new_status == "approved" and claim.approved_amount is None:
            raise BadRequestError("Approved amount is required to approve a claim")
        if new_status == "rejected":
            claim.approved_amount = None
        if new_status == "settled":
            claim.settled_at = datetime.now(timezone.utc)
            await _record_insurance_payment(db, claim, updated_by)
        claim.status = new_status

    if "remarks" in values:
        claim.remarks = values["remarks"]
    await db.flush()
    return await _get_one(db, InsuranceClaim, claim_id, CLAIM_OPTIONS)


async def _record_insurance_payment(db: AsyncSession, claim: InsuranceClaim, received_by: UUID | None) -> None:
    """On settlement, credit the approved amount to the invoice (capped at what is still due)."""
    invoice = await get_invoice(db, claim.invoice_id)
    if invoice.status in ("draft", "cancelled"):
        return
    amount = min(_money(claim.approved_amount), _money(invoice.due_amount))
    if amount <= 0:
        return
    pay_number = await generate_sequential_number(db, Payment, "PAY", "payment_number")
    invoice.paid_amount = _money(invoice.paid_amount) + amount
    invoice.due_amount = max(_money(invoice.total_amount) - invoice.paid_amount, Decimal("0"))
    _refresh_payment_status(invoice)
    db.add(
        Payment(
            payment_number=pay_number,
            invoice_id=invoice.id,
            amount=amount,
            method="insurance",
            transaction_ref=claim.claim_number,
            received_by=received_by,
            notes=f"Insurance settlement ({claim.insurance_provider})",
        )
    )


# ---------- Revenue ----------

async def get_revenue_stats(
    db: AsyncSession, date_from: date | None = None, date_to: date | None = None
) -> dict:
    filters = [Invoice.status != "cancelled"]
    if date_from:
        filters.append(cast(Invoice.created_at, Date) >= date_from)
    if date_to:
        filters.append(cast(Invoice.created_at, Date) < date_to + timedelta(days=1))

    result = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.total_amount), 0),
            func.coalesce(func.sum(Invoice.paid_amount), 0),
            func.count(),
        ).where(*filters)
    )
    total_invoiced, total_paid, total_invoices = result.one()

    return {
        "total_revenue": float(total_invoiced),
        "total_paid": float(total_paid),
        "total_pending": float(total_invoiced) - float(total_paid),
        "total_invoices": total_invoices or 0,
    }
