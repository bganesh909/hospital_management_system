from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, BusinessRuleError, ConflictError, NotFoundError
from app.models.doctor import Doctor
from app.models.ipd import Bed, IpdAdmission, IpdDailyRound, Ward
from app.models.patient import Patient
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.ipd import (
    BedBulkCreate,
    BedCreate,
    BedUpdate,
    IpdAdmissionCreate,
    IpdAdmissionUpdate,
    IpdDailyRoundCreate,
    IpdDischargeRequest,
    WardCreate,
    WardUpdate,
)
from app.services import notification_service
from app.utils.generators import generate_sequential_number

# Display-only values (names, counts) are attached as plain attributes on the
# ORM instances so the Pydantic response models can read them via from_attributes.

_patient_name = (Patient.first_name + " " + Patient.last_name).label("patient_name")
_doctor_name = (User.first_name + " " + User.last_name).label("doctor_name")


# ---------- Wards ----------

async def _attach_bed_counts(db: AsyncSession, wards: list[Ward]) -> list[Ward]:
    if not wards:
        return wards
    result = await db.execute(
        select(
            Bed.ward_id,
            func.count().filter(Bed.status == "occupied").label("occupied"),
            func.count().filter(Bed.status == "available").label("available"),
            func.count().filter(Bed.status == "maintenance").label("maintenance"),
            func.count().filter(Bed.status == "reserved").label("reserved"),
        )
        .where(Bed.ward_id.in_([w.id for w in wards]))
        .group_by(Bed.ward_id)
    )
    counts = {row.ward_id: row for row in result}
    for ward in wards:
        row = counts.get(ward.id)
        ward.occupied_beds = row.occupied if row else 0
        ward.available_beds = row.available if row else 0
        ward.maintenance_beds = row.maintenance if row else 0
        ward.reserved_beds = row.reserved if row else 0
    return wards


async def _sync_ward_total(db: AsyncSession, ward_id: UUID) -> None:
    """Keep wards.total_beds equal to the number of bed rows in the ward."""
    count = (await db.execute(select(func.count()).select_from(Bed).where(Bed.ward_id == ward_id))).scalar() or 0
    await db.execute(update(Ward).where(Ward.id == ward_id).values(total_beds=count))
    await db.flush()


async def _ensure_ward_name_free(db: AsyncSession, name: str, exclude_id: UUID | None = None) -> None:
    query = select(Ward.id).where(func.lower(Ward.name) == name.strip().lower())
    if exclude_id:
        query = query.where(Ward.id != exclude_id)
    if (await db.execute(query)).first():
        raise ConflictError("A ward with this name already exists")


async def get_ward(db: AsyncSession, ward_id: UUID) -> Ward:
    ward = await BaseRepository(Ward, db).get_by_id(ward_id)
    await db.refresh(ward)
    return (await _attach_bed_counts(db, [ward]))[0]


async def create_ward(db: AsyncSession, data: WardCreate) -> Ward:
    await _ensure_ward_name_free(db, data.name)
    repo = BaseRepository(Ward, db)
    ward = await repo.create(data.model_dump(exclude={"total_beds", "bed_prefix"}) | {"total_beds": 0})
    if data.total_beds:
        await _insert_beds(db, ward.id, [f"{data.bed_prefix}{i}" for i in range(1, data.total_beds + 1)])
    return await get_ward(db, ward.id)


async def list_wards(db: AsyncSession, page: int = 1, limit: int = 50) -> tuple[list[Ward], int]:
    repo = BaseRepository(Ward, db)
    wards, total = await repo.get_all(page=page, limit=limit, order_by=Ward.name)
    return await _attach_bed_counts(db, wards), total


async def update_ward(db: AsyncSession, ward_id: UUID, data: WardUpdate) -> Ward:
    changes = data.model_dump(exclude_unset=True)
    for field in ("name", "type", "charge_per_day"):
        if field in changes and changes[field] is None:
            raise BadRequestError(f"{field} cannot be empty")
    if changes.get("name"):
        await _ensure_ward_name_free(db, changes["name"], exclude_id=ward_id)
    repo = BaseRepository(Ward, db)
    ward = await repo.update(ward_id, changes)
    return (await _attach_bed_counts(db, [ward]))[0]


async def delete_ward(db: AsyncSession, ward_id: UUID) -> None:
    await BaseRepository(Ward, db).get_by_id(ward_id)
    used = await db.execute(
        select(IpdAdmission.id).join(Bed, Bed.id == IpdAdmission.bed_id).where(Bed.ward_id == ward_id).limit(1)
    )
    if used.first():
        raise BusinessRuleError("Cannot delete a ward whose beds have admission history")
    # Core deletes avoid the ORM cascade, which would lazy-load ward.beds
    await db.execute(delete(Bed).where(Bed.ward_id == ward_id))
    await db.execute(delete(Ward).where(Ward.id == ward_id))
    await db.flush()


# ---------- Beds ----------

async def _attach_bed_details(db: AsyncSession, beds: list[Bed]) -> list[Bed]:
    if not beds:
        return beds
    bed_ids = [b.id for b in beds]
    ward_rows = await db.execute(
        select(Bed.id, Ward.name, Ward.type, Ward.charge_per_day)
        .join(Ward, Ward.id == Bed.ward_id)
        .where(Bed.id.in_(bed_ids))
    )
    wards = {row[0]: row[1:] for row in ward_rows}
    admission_rows = await db.execute(
        select(IpdAdmission.bed_id, IpdAdmission.id, IpdAdmission.patient_id, _patient_name)
        .join(Patient, Patient.id == IpdAdmission.patient_id)
        .where(IpdAdmission.bed_id.in_(bed_ids), IpdAdmission.status == "admitted")
    )
    admissions = {row[0]: row[1:] for row in admission_rows}
    for bed in beds:
        bed.ward_name, bed.ward_type, bed.charge_per_day = wards.get(bed.id, (None, None, None))
        bed.admission_id, bed.patient_id, bed.patient_name = admissions.get(bed.id, (None, None, None))
    return beds


async def _insert_beds(db: AsyncSession, ward_id: UUID, numbers: list[str], status: str = "available") -> list[Bed]:
    if len(set(numbers)) != len(numbers):
        raise BadRequestError("Bed numbers must be unique")
    taken = await db.execute(select(Bed.bed_number).where(Bed.ward_id == ward_id, Bed.bed_number.in_(numbers)))
    clashes = sorted(r[0] for r in taken)
    if clashes:
        raise ConflictError(f"Bed number(s) already exist in this ward: {', '.join(clashes)}")
    beds = [Bed(ward_id=ward_id, bed_number=n, status=status, is_occupied=False) for n in numbers]
    db.add_all(beds)
    await db.flush()
    await _sync_ward_total(db, ward_id)
    return beds


async def create_bed(db: AsyncSession, data: BedCreate) -> Bed:
    await BaseRepository(Ward, db).get_by_id(data.ward_id)
    beds = await _insert_beds(db, data.ward_id, [data.bed_number.strip()], status=data.status)
    await db.refresh(beds[0])
    return (await _attach_bed_details(db, beds))[0]


async def create_beds_bulk(db: AsyncSession, data: BedBulkCreate) -> list[Bed]:
    await BaseRepository(Ward, db).get_by_id(data.ward_id)
    numbers = [f"{data.prefix}{i}" for i in range(data.start, data.start + data.count)]
    beds = await _insert_beds(db, data.ward_id, numbers)
    for bed in beds:
        await db.refresh(bed)
    return await _attach_bed_details(db, beds)


async def delete_bed(db: AsyncSession, bed_id: UUID) -> None:
    bed = await BaseRepository(Bed, db).get_by_id(bed_id)
    if bed.status == "occupied" or bed.is_occupied:
        raise BusinessRuleError("Cannot delete an occupied bed")
    used = await db.execute(select(IpdAdmission.id).where(IpdAdmission.bed_id == bed_id).limit(1))
    if used.first():
        raise BusinessRuleError("Cannot delete a bed with admission history; set it to maintenance instead")
    ward_id = bed.ward_id
    await db.execute(delete(Bed).where(Bed.id == bed_id))
    await db.flush()
    await _sync_ward_total(db, ward_id)


async def list_beds(
    db: AsyncSession,
    ward_id: UUID | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
) -> tuple[list[Bed], int]:
    repo = BaseRepository(Bed, db)
    filters = []
    if ward_id:
        filters.append(Bed.ward_id == ward_id)
    if status:
        filters.append(Bed.status == status)
    beds, total = await repo.get_all(page=page, limit=limit, filters=filters, order_by=Bed.bed_number)
    return await _attach_bed_details(db, beds), total


async def update_bed(db: AsyncSession, bed_id: UUID, data: BedUpdate) -> Bed:
    repo = BaseRepository(Bed, db)
    current = await repo.get_by_id(bed_id)
    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        if update_data["status"] is None:
            raise BadRequestError("status cannot be empty")
        if current.status == "occupied" or current.is_occupied:
            raise BusinessRuleError("Bed is occupied; discharge or transfer the patient first")
        update_data["is_occupied"] = False
    if "bed_number" in update_data:
        number = (update_data["bed_number"] or "").strip()
        if not number:
            raise BadRequestError("bed_number cannot be empty")
        taken = await db.execute(
            select(Bed.id).where(Bed.ward_id == current.ward_id, Bed.bed_number == number, Bed.id != bed_id)
        )
        if taken.first():
            raise ConflictError(f"Bed number {number} already exists in this ward")
        update_data["bed_number"] = number
    bed = await repo.update(bed_id, update_data)
    return (await _attach_bed_details(db, [bed]))[0]


# ---------- Admissions ----------

def _admission_query():
    return (
        select(
            IpdAdmission,
            _patient_name,
            Patient.patient_number,
            _doctor_name,
            Bed.ward_id,
            Ward.name.label("ward_name"),
            Bed.bed_number,
        )
        .join(Patient, Patient.id == IpdAdmission.patient_id)
        .join(Doctor, Doctor.id == IpdAdmission.doctor_id)
        .join(User, User.id == Doctor.user_id)
        .outerjoin(Bed, Bed.id == IpdAdmission.bed_id)
        .outerjoin(Ward, Ward.id == Bed.ward_id)
    )


def _admission_from_row(row) -> IpdAdmission:
    admission = row[0]
    (
        admission.patient_name,
        admission.patient_number,
        admission.doctor_name,
        admission.ward_id,
        admission.ward_name,
        admission.bed_number,
    ) = row[1:]
    return admission


async def create_admission(db: AsyncSession, data: IpdAdmissionCreate, admitted_by: UUID) -> IpdAdmission:
    if data.bed_id:
        bed = await BaseRepository(Bed, db).get_by_id(data.bed_id)
        if bed.status != "available":
            raise BadRequestError("Selected bed is not available")

    repo = BaseRepository(IpdAdmission, db)
    admission_number = await generate_sequential_number(db, IpdAdmission, "ADM", "admission_number")
    admission_data = data.model_dump()
    admission_data["admission_number"] = admission_number
    admission_data["admitted_by"] = admitted_by

    admission = await repo.create(admission_data)

    # Mark bed as occupied if assigned
    if data.bed_id:
        bed.is_occupied = True
        bed.status = "occupied"
        await db.flush()

    admission = await get_admission(db, admission.id)
    await _notify_admission(db, admission, "Patient admitted", "admitted", exclude_user_id=admitted_by)
    return admission


async def _notify_admission(
    db: AsyncSession, admission: IpdAdmission, title: str, verb: str, exclude_user_id: UUID | None = None
) -> None:
    patient = getattr(admission, "patient_name", None) or "A patient"
    place = " / ".join(filter(None, [getattr(admission, "ward_name", None), getattr(admission, "bed_number", None)]))
    await notification_service.notify_doctor(
        db,
        admission.doctor_id,
        "admission",
        title,
        f"{admission.admission_number}: {patient} was {verb}{f' ({place})' if place else ''}.",
        reference_type="ipd_admission",
        reference_id=admission.id,
        exclude_user_id=exclude_user_id,
    )


async def get_admission(db: AsyncSession, admission_id: UUID) -> IpdAdmission:
    result = await db.execute(_admission_query().where(IpdAdmission.id == admission_id))
    row = result.first()
    if not row:
        raise NotFoundError("IpdAdmission not found")
    return _admission_from_row(row)


_ADMISSION_SORT_COLUMNS = {
    "admission_number": IpdAdmission.admission_number,
    "admission_date": IpdAdmission.admission_date,
    "status": IpdAdmission.status,
    "patient_name": _patient_name,
    "doctor_name": _doctor_name,
}


async def list_admissions(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = "desc",
    patient_id: UUID | None = None,
) -> tuple[list[IpdAdmission], int]:
    query = _admission_query()
    if status:
        query = query.where(IpdAdmission.status == status)
    if patient_id:
        query = query.where(IpdAdmission.patient_id == patient_id)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                IpdAdmission.admission_number.ilike(term),
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.patient_number.ilike(term),
                User.first_name.ilike(term),
                User.last_name.ilike(term),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    sort_column = _ADMISSION_SORT_COLUMNS.get(sort_by or "", IpdAdmission.created_at)
    query = query.order_by(sort_column.asc() if sort_order == "asc" else sort_column.desc())
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    return [_admission_from_row(row) for row in result], total


async def update_admission(db: AsyncSession, admission_id: UUID, data: IpdAdmissionUpdate) -> IpdAdmission:
    repo = BaseRepository(IpdAdmission, db)
    changes = data.model_dump(exclude_unset=True)
    # Bed changes must go through the transfer logic so bed statuses stay consistent
    new_bed_id = changes.pop("bed_id", None)
    if changes:
        await repo.update(admission_id, changes)
    if new_bed_id:
        return await transfer_bed(db, admission_id, new_bed_id)
    return await get_admission(db, admission_id)


async def transfer_bed(db: AsyncSession, admission_id: UUID, bed_id: UUID) -> IpdAdmission:
    admission = await BaseRepository(IpdAdmission, db).get_by_id(admission_id)
    if admission.status != "admitted":
        raise BadRequestError("Only admitted patients can be transferred")
    if admission.bed_id == bed_id:
        raise BadRequestError("Patient is already in this bed")

    bed_repo = BaseRepository(Bed, db)
    new_bed = await bed_repo.get_by_id(bed_id)
    if new_bed.status != "available":
        raise BadRequestError("Selected bed is not available")

    if admission.bed_id:
        old_bed = await bed_repo.get_by_id(admission.bed_id)
        old_bed.is_occupied = False
        old_bed.status = "available"

    new_bed.is_occupied = True
    new_bed.status = "occupied"
    admission.bed_id = bed_id
    await db.flush()
    return await get_admission(db, admission_id)


async def discharge_patient(db: AsyncSession, admission_id: UUID, data: IpdDischargeRequest) -> IpdAdmission:
    repo = BaseRepository(IpdAdmission, db)
    admission = await repo.get_by_id(admission_id)
    if admission.status == "discharged":
        raise BadRequestError("Patient already discharged")
    admission.status = "discharged"
    admission.discharge_date = datetime.now(timezone.utc)
    admission.discharge_summary = data.discharge_summary
    await db.flush()

    # Free bed
    if admission.bed_id:
        bed_repo = BaseRepository(Bed, db)
        bed = await bed_repo.get_by_id(admission.bed_id)
        bed.is_occupied = False
        bed.status = "available"
        await db.flush()

    admission = await get_admission(db, admission_id)
    await _notify_admission(db, admission, "Patient discharged", "discharged")
    return admission


# ---------- Daily Rounds ----------

async def _attach_round_doctor_names(db: AsyncSession, rounds: list[IpdDailyRound]) -> list[IpdDailyRound]:
    if not rounds:
        return rounds
    result = await db.execute(
        select(Doctor.id, _doctor_name)
        .join(User, User.id == Doctor.user_id)
        .where(Doctor.id.in_({r.doctor_id for r in rounds}))
    )
    names = dict(result.all())
    for r in rounds:
        r.doctor_name = names.get(r.doctor_id)
    return rounds


async def create_round(db: AsyncSession, data: IpdDailyRoundCreate) -> IpdDailyRound:
    repo = BaseRepository(IpdDailyRound, db)
    round_entry = await repo.create(data.model_dump())
    return (await _attach_round_doctor_names(db, [round_entry]))[0]


async def list_rounds(db: AsyncSession, admission_id: UUID) -> list[IpdDailyRound]:
    result = await db.execute(
        select(IpdDailyRound)
        .where(IpdDailyRound.admission_id == admission_id)
        .order_by(IpdDailyRound.round_date.desc())
    )
    return await _attach_round_doctor_names(db, list(result.scalars().all()))
