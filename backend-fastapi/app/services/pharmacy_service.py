from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, BusinessRuleError, ConflictError, NotFoundError
from app.models.pharmacy import (
    Medicine,
    MedicineCategory,
    PharmacyDispensation,
    PharmacyDispensationItem,
)
from app.models.opd import Prescription
from app.repositories.base import BaseRepository
from app.schemas.pharmacy import (
    DispensationCreate,
    MedicineCategoryCreate,
    MedicineCategoryUpdate,
    MedicineCreate,
    MedicineUpdate,
    StockUpdateRequest,
)
from app.services import notification_service
from app.services.opd_service import attach_names
from app.utils.generators import generate_sequential_number


# ---------- Categories ----------

async def _ensure_category_name_free(db: AsyncSession, name: str, exclude_id: UUID | None = None) -> None:
    query = select(MedicineCategory.id).where(func.lower(MedicineCategory.name) == name.strip().lower())
    if exclude_id:
        query = query.where(MedicineCategory.id != exclude_id)
    if (await db.execute(query)).first():
        raise ConflictError("A category with this name already exists")


async def _attach_medicine_counts(db: AsyncSession, categories: list[MedicineCategory]) -> list[MedicineCategory]:
    if not categories:
        return categories
    rows = await db.execute(
        select(Medicine.category_id, func.count(Medicine.id))
        .where(Medicine.category_id.in_([c.id for c in categories]))
        .group_by(Medicine.category_id)
    )
    counts = dict(rows.all())
    for c in categories:
        c.medicine_count = counts.get(c.id, 0)
    return categories


async def create_category(db: AsyncSession, data: MedicineCategoryCreate) -> MedicineCategory:
    await _ensure_category_name_free(db, data.name)
    repo = BaseRepository(MedicineCategory, db)
    category = await repo.create({"name": data.name.strip()})
    return (await _attach_medicine_counts(db, [category]))[0]


async def list_categories(db: AsyncSession, search: str | None = None) -> list[MedicineCategory]:
    query = select(MedicineCategory).order_by(MedicineCategory.name)
    if search:
        query = query.where(MedicineCategory.name.ilike(f"%{search.strip()}%"))
    result = await db.execute(query)
    return await _attach_medicine_counts(db, list(result.scalars().all()))


async def update_category(db: AsyncSession, category_id: UUID, data: MedicineCategoryUpdate) -> MedicineCategory:
    await _ensure_category_name_free(db, data.name, exclude_id=category_id)
    repo = BaseRepository(MedicineCategory, db)
    category = await repo.update(category_id, {"name": data.name.strip()})
    return (await _attach_medicine_counts(db, [category]))[0]


async def delete_category(db: AsyncSession, category_id: UUID) -> None:
    category = (await _attach_medicine_counts(db, [await BaseRepository(MedicineCategory, db).get_by_id(category_id)]))[0]
    if category.medicine_count:
        raise BusinessRuleError(f"Cannot delete: {category.medicine_count} medicine(s) use this category")
    await BaseRepository(MedicineCategory, db).delete(category_id)


# ---------- Medicines ----------

MEDICINE_SORT_COLUMNS = {
    "name": Medicine.name,
    "unit_price": Medicine.unit_price,
    "stock_quantity": Medicine.stock_quantity,
    "expiry_date": Medicine.expiry_date,
}


async def _attach_category_names(db: AsyncSession, medicines: list[Medicine]) -> list[Medicine]:
    category_ids = {m.category_id for m in medicines if m.category_id}
    names: dict[UUID, str] = {}
    if category_ids:
        rows = await db.execute(
            select(MedicineCategory.id, MedicineCategory.name).where(MedicineCategory.id.in_(category_ids))
        )
        names = {r.id: r.name for r in rows}
    for m in medicines:
        m.category_name = names.get(m.category_id)
    return medicines


async def create_medicine(db: AsyncSession, data: MedicineCreate) -> Medicine:
    repo = BaseRepository(Medicine, db)
    medicine = await repo.create(data.model_dump())
    await _attach_category_names(db, [medicine])
    return medicine


async def get_medicine(db: AsyncSession, medicine_id: UUID) -> Medicine:
    repo = BaseRepository(Medicine, db)
    medicine = await repo.get_by_id(medicine_id)
    await _attach_category_names(db, [medicine])
    return medicine


async def list_medicines(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    category_id: UUID | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "asc",
) -> tuple[list[Medicine], int]:
    repo = BaseRepository(Medicine, db)
    filters = []
    if category_id:
        filters.append(Medicine.category_id == category_id)
    if search:
        term = f"%{search}%"
        matching_categories = select(MedicineCategory.id).where(MedicineCategory.name.ilike(term))
        filters.append(
            or_(
                Medicine.name.ilike(term),
                Medicine.generic_name.ilike(term),
                Medicine.category_id.in_(matching_categories),
            )
        )

    order_by = None
    column = MEDICINE_SORT_COLUMNS.get(sort_by or "")
    if column is not None:
        order_by = column.desc() if sort_order == "desc" else column.asc()

    items, total = await repo.get_all(page=page, limit=limit, filters=filters, order_by=order_by)
    await _attach_category_names(db, items)
    return items, total


async def update_medicine(db: AsyncSession, medicine_id: UUID, data: MedicineUpdate) -> Medicine:
    repo = BaseRepository(Medicine, db)
    medicine = await repo.update(medicine_id, data.model_dump(exclude_unset=True))
    await _attach_category_names(db, [medicine])
    return medicine


async def update_stock(db: AsyncSession, medicine_id: UUID, data: StockUpdateRequest) -> Medicine:
    repo = BaseRepository(Medicine, db)
    medicine = await repo.get_by_id(medicine_id)
    was_above_reorder = medicine.stock_quantity > medicine.reorder_level
    if data.operation == "add":
        medicine.stock_quantity += data.quantity
    elif data.operation == "subtract":
        if medicine.stock_quantity < data.quantity:
            raise BadRequestError("Cannot remove more than the current stock")
        medicine.stock_quantity -= data.quantity
    else:
        medicine.stock_quantity = data.quantity
    await db.flush()
    await db.refresh(medicine)
    # Alert only when stock crosses the reorder level, not on every change below it
    if was_above_reorder:
        await notification_service.notify_low_stock(db, medicine)
    await _attach_category_names(db, [medicine])
    return medicine


async def get_low_stock(db: AsyncSession) -> list[Medicine]:
    result = await db.execute(
        select(Medicine).where(Medicine.stock_quantity <= Medicine.reorder_level)
    )
    return await _attach_category_names(db, list(result.scalars().all()))


async def get_expiring_medicines(db: AsyncSession, days: int = 30) -> list[Medicine]:
    threshold = date.today() + timedelta(days=days)
    result = await db.execute(
        select(Medicine).where(
            Medicine.expiry_date != None,  # noqa: E711
            Medicine.expiry_date <= threshold,
        )
    )
    return await _attach_category_names(db, list(result.scalars().all()))


async def _find_medicine(db: AsyncSession, medicine_id: UUID | None, medicine_name: str | None) -> Medicine | None:
    if medicine_id:
        return await BaseRepository(Medicine, db).get_by_id_or_none(medicine_id)
    if medicine_name:
        result = await db.execute(
            select(Medicine).where(func.lower(Medicine.name) == medicine_name.strip().lower()).limit(1)
        )
        return result.scalar_one_or_none()
    return None


# ---------- Dispensations ----------

def _dispensation_query():
    return select(PharmacyDispensation).options(selectinload(PharmacyDispensation.items))


async def _decorate_dispensations(db: AsyncSession, dispensations: list[PharmacyDispensation]) -> list[PharmacyDispensation]:
    prescription_ids = {d.prescription_id for d in dispensations}
    prescriptions: dict[UUID, Prescription] = {}
    if prescription_ids:
        result = await db.execute(select(Prescription).where(Prescription.id.in_(prescription_ids)))
        prescriptions = {p.id: p for p in result.scalars().all()}
    await attach_names(db, list(prescriptions.values()))

    medicine_ids = {i.medicine_id for d in dispensations for i in d.items}
    medicine_names: dict[UUID, str] = {}
    if medicine_ids:
        rows = await db.execute(select(Medicine.id, Medicine.name).where(Medicine.id.in_(medicine_ids)))
        medicine_names = {r.id: r.name for r in rows}

    for d in dispensations:
        rx = prescriptions.get(d.prescription_id)
        d.prescription_number = rx.prescription_number if rx else None
        d.patient_id = rx.patient_id if rx else None
        d.patient_name = rx.patient_name if rx else None
        d.doctor_name = rx.doctor_name if rx else None
        for item in d.items:
            item.medicine_name = medicine_names.get(item.medicine_id)
    return dispensations


async def create_dispensation(db: AsyncSession, data: DispensationCreate, dispensed_by: UUID) -> PharmacyDispensation:
    prescription = await BaseRepository(Prescription, db).get_by_id(data.prescription_id)
    if prescription.status != "active":
        raise BadRequestError(f"Prescription is already {prescription.status}")

    # Resolve medicines and validate stock before writing anything
    lines: list[tuple[Medicine, int]] = []
    for item_data in data.items:
        medicine = await _find_medicine(db, item_data.medicine_id, item_data.medicine_name)
        if not medicine:
            label = item_data.medicine_name or str(item_data.medicine_id)
            raise BadRequestError(f"Medicine '{label}' not found in inventory")
        if medicine.stock_quantity < item_data.quantity:
            raise BadRequestError(f"Insufficient stock for {medicine.name}")
        lines.append((medicine, item_data.quantity))

    disp_number = await generate_sequential_number(db, PharmacyDispensation, "DIS", "dispensation_number")
    total_amount = sum(float(m.unit_price) * qty for m, qty in lines)
    dispensation = PharmacyDispensation(
        dispensation_number=disp_number,
        prescription_id=data.prescription_id,
        dispensed_by=dispensed_by,
        total_amount=total_amount,
        notes=data.notes,
    )
    db.add(dispensation)
    await db.flush()

    crossed_reorder = [m for m, qty in lines if m.stock_quantity > m.reorder_level >= m.stock_quantity - qty]
    for medicine, qty in lines:
        db.add(
            PharmacyDispensationItem(
                dispensation_id=dispensation.id,
                medicine_id=medicine.id,
                quantity=qty,
                unit_price=medicine.unit_price,
                total_price=float(medicine.unit_price) * qty,
            )
        )
        medicine.stock_quantity -= qty

    prescription.status = "dispensed"
    await db.flush()
    for medicine in crossed_reorder:
        await notification_service.notify_low_stock(db, medicine)

    dispensation_id = dispensation.id
    db.expire(dispensation)
    result = await db.execute(_dispensation_query().where(PharmacyDispensation.id == dispensation_id))
    dispensation = result.scalar_one()
    await _decorate_dispensations(db, [dispensation])
    return dispensation


async def list_dispensations(
    db: AsyncSession, page: int = 1, limit: int = 20, prescription_id: UUID | None = None
) -> tuple[list[PharmacyDispensation], int]:
    query = _dispensation_query()
    count_query = select(func.count()).select_from(PharmacyDispensation)
    if prescription_id:
        query = query.where(PharmacyDispensation.prescription_id == prescription_id)
        count_query = count_query.where(PharmacyDispensation.prescription_id == prescription_id)
    query = query.order_by(PharmacyDispensation.created_at.desc()).offset((page - 1) * limit).limit(limit)

    items = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_query)).scalar() or 0
    await _decorate_dispensations(db, items)
    return items, total


async def get_pending_prescriptions(db: AsyncSession) -> list[Prescription]:
    result = await db.execute(
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.status == "active")
        .order_by(Prescription.created_at)
    )
    prescriptions = list(result.scalars().all())
    await attach_names(db, prescriptions)

    # Show the current inventory price for each item so the pharmacist sees the total
    for rx in prescriptions:
        for item in rx.items:
            medicine = await _find_medicine(db, item.medicine_id, item.medicine_name)
            item.unit_price = float(medicine.unit_price) if medicine else None
    return prescriptions
