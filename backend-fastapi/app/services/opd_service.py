from datetime import date
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.doctor import Doctor
from app.models.opd import OpdVisit, Prescription, PrescriptionItem
from app.models.patient import Patient
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.opd import OpdVisitCreate, OpdVisitUpdate, PrescriptionCreate, PrescriptionUpdate
from app.utils.generators import generate_sequential_number


# ---------- Display names ----------

async def attach_names(db: AsyncSession, items: list) -> list:
    """Set patient_name / doctor_name on objects that have patient_id / doctor_id."""
    patient_ids = {i.patient_id for i in items if getattr(i, "patient_id", None)}
    doctor_ids = {i.doctor_id for i in items if getattr(i, "doctor_id", None)}

    patient_names: dict[UUID, str] = {}
    if patient_ids:
        rows = await db.execute(
            select(Patient.id, Patient.first_name, Patient.last_name).where(Patient.id.in_(patient_ids))
        )
        patient_names = {r.id: f"{r.first_name} {r.last_name}" for r in rows}

    doctor_names: dict[UUID, str] = {}
    if doctor_ids:
        rows = await db.execute(
            select(Doctor.id, User.first_name, User.last_name)
            .join(User, Doctor.user_id == User.id)
            .where(Doctor.id.in_(doctor_ids))
        )
        doctor_names = {r.id: f"Dr. {r.first_name} {r.last_name}" for r in rows}

    for i in items:
        i.patient_name = patient_names.get(getattr(i, "patient_id", None))
        i.doctor_name = doctor_names.get(getattr(i, "doctor_id", None))
    return items


# ---------- OPD Visits ----------

VISIT_SORT_COLUMNS = {
    "visit_number": OpdVisit.visit_number,
    "visit_date": OpdVisit.visit_date,
    "status": OpdVisit.status,
}


async def create_visit(db: AsyncSession, data: OpdVisitCreate) -> OpdVisit:
    repo = BaseRepository(OpdVisit, db)
    visit_number = await generate_sequential_number(db, OpdVisit, "OPD", "visit_number")
    visit_data = data.model_dump()
    visit_data["visit_number"] = visit_number
    visit = await repo.create(visit_data)
    await attach_names(db, [visit])
    return visit


async def get_visit(db: AsyncSession, visit_id: UUID) -> OpdVisit:
    repo = BaseRepository(OpdVisit, db)
    visit = await repo.get_by_id(visit_id)
    await attach_names(db, [visit])
    return visit


async def list_visits(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    patient_id: UUID | None = None,
    doctor_id: UUID | None = None,
    status: str | None = None,
    visit_date: date | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
) -> tuple[list[OpdVisit], int]:
    repo = BaseRepository(OpdVisit, db)
    filters = []
    if patient_id:
        filters.append(OpdVisit.patient_id == patient_id)
    if doctor_id:
        filters.append(OpdVisit.doctor_id == doctor_id)
    if status:
        filters.append(OpdVisit.status == status)
    if visit_date:
        filters.append(func.date(OpdVisit.visit_date) == visit_date)
    if search:
        term = f"%{search}%"
        matching_patients = select(Patient.id).where(
            or_(
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                (Patient.first_name + " " + Patient.last_name).ilike(term),
            )
        )
        filters.append(or_(OpdVisit.visit_number.ilike(term), OpdVisit.patient_id.in_(matching_patients)))

    order_by = None
    column = VISIT_SORT_COLUMNS.get(sort_by or "")
    if column is not None:
        order_by = column.asc() if sort_order == "asc" else column.desc()

    items, total = await repo.get_all(page=page, limit=limit, filters=filters, order_by=order_by)
    await attach_names(db, items)
    return items, total


async def update_visit(db: AsyncSession, visit_id: UUID, data: OpdVisitUpdate) -> OpdVisit:
    repo = BaseRepository(OpdVisit, db)
    visit = await repo.update(visit_id, data.model_dump(exclude_unset=True))
    await attach_names(db, [visit])
    return visit


async def complete_visit(db: AsyncSession, visit_id: UUID) -> OpdVisit:
    repo = BaseRepository(OpdVisit, db)
    visit = await repo.get_by_id(visit_id)
    if visit.status == "completed":
        raise BadRequestError("Visit is already completed")
    visit.status = "completed"
    await db.flush()
    await db.refresh(visit)
    await attach_names(db, [visit])
    return visit


# ---------- Prescriptions ----------

def _prescription_query():
    return select(Prescription).options(selectinload(Prescription.items))


async def get_prescription(db: AsyncSession, prescription_id: UUID) -> Prescription:
    result = await db.execute(_prescription_query().where(Prescription.id == prescription_id))
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise NotFoundError("Prescription not found")
    await attach_names(db, [prescription])
    return prescription


async def create_prescription(db: AsyncSession, data: PrescriptionCreate) -> Prescription:
    rx_number = await generate_sequential_number(db, Prescription, "RX", "prescription_number")
    prescription = Prescription(
        prescription_number=rx_number,
        opd_visit_id=data.opd_visit_id,
        ipd_admission_id=data.ipd_admission_id,
        patient_id=data.patient_id,
        doctor_id=data.doctor_id,
        notes=data.notes,
    )
    db.add(prescription)
    await db.flush()

    for item_data in data.items:
        db.add(PrescriptionItem(prescription_id=prescription.id, **item_data.model_dump()))
    await db.flush()

    # Expire so the items relationship is re-read by the eager-loading query.
    # Grab the id first: reading attributes of an expired object triggers a lazy load.
    prescription_id = prescription.id
    db.expire(prescription)
    return await get_prescription(db, prescription_id)


async def list_prescriptions(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    patient_id: UUID | None = None,
    opd_visit_id: UUID | None = None,
    status: str | None = None,
) -> tuple[list[Prescription], int]:
    filters = []
    if patient_id:
        filters.append(Prescription.patient_id == patient_id)
    if opd_visit_id:
        filters.append(Prescription.opd_visit_id == opd_visit_id)
    if status:
        filters.append(Prescription.status == status)

    query = _prescription_query()
    count_query = select(func.count()).select_from(Prescription)
    for f in filters:
        query = query.where(f)
        count_query = count_query.where(f)
    query = query.order_by(Prescription.created_at.desc()).offset((page - 1) * limit).limit(limit)

    items = list((await db.execute(query)).scalars().all())
    total = (await db.execute(count_query)).scalar() or 0
    await attach_names(db, items)
    return items, total


async def update_prescription(db: AsyncSession, prescription_id: UUID, data: PrescriptionUpdate) -> Prescription:
    repo = BaseRepository(Prescription, db)
    await repo.update(prescription_id, data.model_dump(exclude_unset=True))
    return await get_prescription(db, prescription_id)
