from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, BusinessRuleError, ConflictError, NotFoundError
from app.models.doctor import Department, Doctor, DoctorSchedule
from app.models.staff import Staff
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.doctor import (
    DepartmentCreate,
    DepartmentUpdate,
    DoctorCreate,
    DoctorScheduleCreate,
    DoctorScheduleUpdate,
    DoctorUpdate,
)


# ---------- Departments ----------

async def _ensure_department_name_free(db: AsyncSession, name: str, exclude_id: UUID | None = None) -> None:
    query = select(Department.id).where(func.lower(Department.name) == name.strip().lower())
    if exclude_id:
        query = query.where(Department.id != exclude_id)
    if (await db.execute(query)).first():
        raise ConflictError("A department with this name already exists")


async def _ensure_valid_head(db: AsyncSession, head_id: UUID | None, dept_id: UUID | None = None) -> None:
    if head_id is None:
        return
    doctor = (await db.execute(select(Doctor).where(Doctor.id == head_id))).scalar_one_or_none()
    if not doctor:
        raise NotFoundError("Head doctor not found")
    if dept_id and doctor.department_id != dept_id:
        raise BadRequestError("Head doctor must belong to this department")


async def _attach_department_details(db: AsyncSession, depts: list[Department]) -> list[Department]:
    """Set doctor_count, staff_count and head_name on each department for the response schema."""
    if not depts:
        return depts
    ids = [d.id for d in depts]
    doctor_counts = dict(
        (await db.execute(
            select(Doctor.department_id, func.count(Doctor.id))
            .where(Doctor.department_id.in_(ids))
            .group_by(Doctor.department_id)
        )).all()
    )
    staff_counts = dict(
        (await db.execute(
            select(Staff.department_id, func.count(Staff.id))
            .where(Staff.department_id.in_(ids))
            .group_by(Staff.department_id)
        )).all()
    )
    head_ids = [d.head_id for d in depts if d.head_id]
    head_names: dict[UUID, str] = {}
    if head_ids:
        rows = await db.execute(
            select(Doctor.id, User.first_name, User.last_name)
            .join(User, User.id == Doctor.user_id)
            .where(Doctor.id.in_(head_ids))
        )
        head_names = {r.id: f"{r.first_name} {r.last_name}".strip() for r in rows}
    for d in depts:
        d.doctor_count = doctor_counts.get(d.id, 0)
        d.staff_count = staff_counts.get(d.id, 0)
        d.head_name = head_names.get(d.head_id) if d.head_id else None
    return depts


async def create_department(db: AsyncSession, data: DepartmentCreate) -> Department:
    await _ensure_department_name_free(db, data.name)
    # A new department has no doctors yet, so only check the head exists
    await _ensure_valid_head(db, data.head_id)
    repo = BaseRepository(Department, db)
    dept = await repo.create(data.model_dump())
    return (await _attach_department_details(db, [dept]))[0]


async def list_departments(
    db: AsyncSession, page: int = 1, limit: int = 50, search: str | None = None
) -> tuple[list[Department], int]:
    repo = BaseRepository(Department, db)
    filters = []
    if search:
        filters.append(Department.name.ilike(f"%{search.strip()}%"))
    items, total = await repo.get_all(page=page, limit=limit, filters=filters, order_by=Department.name)
    return await _attach_department_details(db, items), total


async def get_department(db: AsyncSession, dept_id: UUID) -> Department:
    repo = BaseRepository(Department, db)
    dept = await repo.get_by_id(dept_id)
    return (await _attach_department_details(db, [dept]))[0]


async def update_department(db: AsyncSession, dept_id: UUID, data: DepartmentUpdate) -> Department:
    repo = BaseRepository(Department, db)
    changes = data.model_dump(exclude_unset=True)
    if changes.get("name"):
        await _ensure_department_name_free(db, changes["name"], exclude_id=dept_id)
    elif "name" in changes:
        raise BadRequestError("Department name cannot be empty")
    if "head_id" in changes:
        await _ensure_valid_head(db, changes["head_id"], dept_id)
    dept = await repo.update(dept_id, changes)
    return (await _attach_department_details(db, [dept]))[0]


async def delete_department(db: AsyncSession, dept_id: UUID) -> None:
    dept = await get_department(db, dept_id)
    if dept.doctor_count or dept.staff_count:
        raise BusinessRuleError(
            f"Cannot delete: {dept.doctor_count} doctor(s) and {dept.staff_count} staff are assigned to this department"
        )
    # Core delete: session.delete() would lazy-load Department.doctors, which fails under async
    await db.execute(delete(Department).where(Department.id == dept_id))
    await db.flush()


# ---------- Doctors ----------

DOCTOR_LOAD_OPTIONS = (selectinload(Doctor.user), selectinload(Doctor.department))


async def create_doctor(db: AsyncSession, data: DoctorCreate) -> Doctor:
    if not await db.get(User, data.user_id):
        raise NotFoundError("User not found")
    existing = await db.execute(
        select(Doctor.id).where(
            or_(Doctor.user_id == data.user_id, Doctor.license_number == data.license_number)
        )
    )
    if existing.first():
        raise ConflictError("A doctor with this user account or license number already exists")
    repo = BaseRepository(Doctor, db)
    doctor = await repo.create(data.model_dump())
    return await get_doctor(db, doctor.id)


async def get_doctor(db: AsyncSession, doctor_id: UUID) -> Doctor:
    result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id).options(*DOCTOR_LOAD_OPTIONS)
        .execution_options(populate_existing=True)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise NotFoundError("Doctor not found")
    return doctor


async def list_doctors(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    department_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[Doctor], int]:
    query = select(Doctor).join(User, Doctor.user_id == User.id)
    if department_id:
        query = query.where(Doctor.department_id == department_id)
    if search:
        term = f"%{search}%"
        query = query.where(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                (User.first_name + " " + User.last_name).ilike(term),
                Doctor.specialization.ilike(term),
                Doctor.license_number.ilike(term),
            )
        )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(
        query.options(*DOCTOR_LOAD_OPTIONS)
        .order_by(User.first_name, User.last_name)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def update_doctor(db: AsyncSession, doctor_id: UUID, data: DoctorUpdate) -> Doctor:
    repo = BaseRepository(Doctor, db)
    await repo.update(doctor_id, data.model_dump(exclude_unset=True))
    return await get_doctor(db, doctor_id)


async def get_available_doctors(db: AsyncSession, department_id: UUID | None = None) -> list[Doctor]:
    query = select(Doctor).where(Doctor.is_available == True).options(*DOCTOR_LOAD_OPTIONS)  # noqa: E712
    if department_id:
        query = query.where(Doctor.department_id == department_id)
    result = await db.execute(query)
    return list(result.scalars().all())


# ---------- Schedule ----------

async def get_doctor_schedule(db: AsyncSession, doctor_id: UUID) -> list[DoctorSchedule]:
    result = await db.execute(
        select(DoctorSchedule).where(DoctorSchedule.doctor_id == doctor_id).order_by(DoctorSchedule.day_of_week)
    )
    return list(result.scalars().all())


async def upsert_doctor_schedule(
    db: AsyncSession, doctor_id: UUID, schedules: list[DoctorScheduleCreate]
) -> list[DoctorSchedule]:
    # Delete existing schedules for this doctor
    existing = await db.execute(select(DoctorSchedule).where(DoctorSchedule.doctor_id == doctor_id))
    for s in existing.scalars().all():
        await db.delete(s)
    await db.flush()

    created = []
    for s in schedules:
        sched = DoctorSchedule(doctor_id=doctor_id, **s.model_dump())
        db.add(sched)
        await db.flush()
        await db.refresh(sched)
        created.append(sched)
    return created
