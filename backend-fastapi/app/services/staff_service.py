from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import Select, and_, case, delete, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, NotFoundError
from app.models.staff import Attendance, LeaveRequest, Payroll, Staff
from app.models.user import User, UserRole
from app.schemas.staff import (
    AttendanceCreate,
    LeaveRequestCreate,
    LeaveRequestUpdate,
    PayrollCreate,
    PayrollGenerateRequest,
    PayrollUpdate,
    StaffCreate,
    StaffUpdate,
)
from app.services import notification_service
from app.utils.generators import generate_sequential_number

# Eager-load options so name/department properties work without lazy loading
STAFF_OPTIONS = (selectinload(Staff.user), selectinload(Staff.department))


def _via_staff(rel):
    return (
        selectinload(rel).selectinload(Staff.user),
        selectinload(rel).selectinload(Staff.department),
    )


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


# ---------- Staff ----------

STAFF_SORT_COLUMNS = {
    "employee_number": Staff.employee_number,
    "designation": Staff.designation,
    "join_date": Staff.join_date,
    "full_name": User.first_name,
    "status": Staff.status,
}


async def create_staff(db: AsyncSession, data: StaffCreate) -> Staff:
    emp_number = await generate_sequential_number(db, Staff, "EMP", "employee_number")
    staff = Staff(**data.model_dump(), employee_number=emp_number)
    db.add(staff)
    await db.flush()
    return await get_staff(db, staff.id)


async def get_staff(db: AsyncSession, staff_id: UUID) -> Staff:
    return await _get_one(db, Staff, staff_id, STAFF_OPTIONS)


async def list_staff(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_dir: str = "asc",
) -> tuple[list[Staff], int]:
    query = select(Staff).join(User, Staff.user_id == User.id).options(*STAFF_OPTIONS)
    filters = []
    if status:
        filters.append(Staff.status == status)
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
                Staff.employee_number.ilike(term),
                Staff.designation.ilike(term),
            )
        )
    column = STAFF_SORT_COLUMNS.get(sort_by or "", Staff.created_at)
    query = query.order_by(column.desc() if sort_dir == "desc" or not sort_by else column.asc())
    return await _paginate(db, query, filters, page, limit)


async def update_staff(db: AsyncSession, staff_id: UUID, data: StaffUpdate) -> Staff:
    staff = await get_staff(db, staff_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(staff, key, value)
    await db.flush()
    return await get_staff(db, staff_id)


# ---------- Attendance ----------

def _aware(value: datetime | None) -> datetime | None:
    # Times from the DB are tz-aware; times from requests may be naive (treated as UTC)
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _hours_between(check_in: datetime | None, check_out: datetime | None) -> float | None:
    check_in, check_out = _aware(check_in), _aware(check_out)
    if check_in and check_out and check_out > check_in:
        return round((check_out - check_in).total_seconds() / 3600, 2)
    return None


async def create_attendance(db: AsyncSession, data: AttendanceCreate) -> Attendance:
    """Upsert: one record per staff member per day (check-in, then check-out)."""
    result = await db.execute(
        select(Attendance).where(Attendance.staff_id == data.staff_id, Attendance.date == data.date)
    )
    attendance = result.scalar_one_or_none()
    values = data.model_dump(exclude_unset=True, exclude={"staff_id", "date"})
    if attendance:
        for key, value in values.items():
            if value is not None:
                setattr(attendance, key, value)
    else:
        attendance = Attendance(staff_id=data.staff_id, date=data.date, **values)
        db.add(attendance)
    if "hours_worked" not in values:
        hours = _hours_between(attendance.check_in, attendance.check_out)
        if hours is not None:
            attendance.hours_worked = hours
    await db.flush()
    return await _get_one(db, Attendance, attendance.id, _via_staff(Attendance.staff))


async def list_attendance(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    staff_id: UUID | None = None,
    month: int | None = None,
    year: int | None = None,
    on_date: date | None = None,
    search: str | None = None,
) -> tuple[list[Attendance], int]:
    query = select(Attendance).options(*_via_staff(Attendance.staff)).order_by(Attendance.date.desc())
    filters = []
    if staff_id:
        filters.append(Attendance.staff_id == staff_id)
    if month:
        filters.append(extract("month", Attendance.date) == month)
    if year:
        filters.append(extract("year", Attendance.date) == year)
    if on_date:
        filters.append(Attendance.date == on_date)
    if search:
        term = f"%{search}%"
        query = query.join(Staff, Attendance.staff_id == Staff.id).join(User, Staff.user_id == User.id)
        filters.append(
            or_(User.first_name.ilike(term), User.last_name.ilike(term), Staff.employee_number.ilike(term))
        )
    return await _paginate(db, query, filters, page, limit)


# ---------- Leave Requests ----------

# Allowed status changes; approved leave can still be cancelled
LEAVE_TRANSITIONS = {
    "pending": {"approved", "rejected", "cancelled"},
    "approved": {"cancelled"},
    "rejected": set(),
    "cancelled": set(),
}


async def create_leave_request(db: AsyncSession, data: LeaveRequestCreate) -> LeaveRequest:
    if data.end_date < data.start_date:
        raise BadRequestError("End date cannot be before start date")
    await get_staff(db, data.staff_id)
    leave = LeaveRequest(**data.model_dump())
    db.add(leave)
    await db.flush()
    leave = await _get_one(db, LeaveRequest, leave.id, _via_staff(LeaveRequest.staff))
    await notification_service.notify_roles(
        db,
        (UserRole.admin,),
        "leave",
        "New leave request",
        f"{getattr(leave, 'full_name', None) or 'A staff member'} requested {leave.leave_type} leave "
        f"from {leave.start_date:%d %b} to {leave.end_date:%d %b %Y}.",
        reference_type="leave_request",
        reference_id=leave.id,
    )
    return leave


async def list_leave_requests(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    staff_id: UUID | None = None,
    status: str | None = None,
    leave_type: str | None = None,
    search: str | None = None,
) -> tuple[list[LeaveRequest], int]:
    query = select(LeaveRequest).options(*_via_staff(LeaveRequest.staff)).order_by(LeaveRequest.created_at.desc())
    filters = []
    if staff_id:
        filters.append(LeaveRequest.staff_id == staff_id)
    if status:
        filters.append(LeaveRequest.status == status)
    if leave_type:
        filters.append(LeaveRequest.leave_type == leave_type)
    if search:
        term = f"%{search}%"
        query = query.join(Staff, LeaveRequest.staff_id == Staff.id).join(User, Staff.user_id == User.id)
        filters.append(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                Staff.employee_number.ilike(term),
                LeaveRequest.reason.ilike(term),
            )
        )
    return await _paginate(db, query, filters, page, limit)


def _dates_between(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


async def _ensure_no_overlap(db: AsyncSession, leave: LeaveRequest) -> None:
    result = await db.execute(
        select(LeaveRequest.id).where(
            LeaveRequest.staff_id == leave.staff_id,
            LeaveRequest.status == "approved",
            LeaveRequest.id != leave.id,
            LeaveRequest.start_date <= leave.end_date,
            LeaveRequest.end_date >= leave.start_date,
        )
    )
    if result.first():
        raise BadRequestError("This staff member already has approved leave overlapping these dates")


async def _mark_leave_attendance(db: AsyncSession, leave: LeaveRequest) -> None:
    """Set attendance to 'leave' for each day, without overwriting days the person actually worked."""
    days = _dates_between(leave.start_date, leave.end_date)
    result = await db.execute(
        select(Attendance).where(Attendance.staff_id == leave.staff_id, Attendance.date.in_(days))
    )
    existing = {a.date: a for a in result.scalars().all()}
    for day in days:
        record = existing.get(day)
        if record is None:
            db.add(Attendance(staff_id=leave.staff_id, date=day, status="leave", notes="Approved leave"))
        elif record.check_in is None:
            record.status = "leave"


async def _clear_leave_attendance(db: AsyncSession, leave: LeaveRequest) -> None:
    await db.execute(
        delete(Attendance).where(
            Attendance.staff_id == leave.staff_id,
            Attendance.date.between(leave.start_date, leave.end_date),
            Attendance.status == "leave",
            Attendance.check_in.is_(None),
        )
    )


async def update_leave_request(
    db: AsyncSession, leave_id: UUID, data: LeaveRequestUpdate, approved_by: UUID | None = None
) -> LeaveRequest:
    leave = await _get_one(db, LeaveRequest, leave_id, _via_staff(LeaveRequest.staff))
    update_data = data.model_dump(exclude_unset=True)
    new_status = update_data.get("status")
    if new_status and new_status != leave.status:
        if new_status not in LEAVE_TRANSITIONS.get(leave.status, set()):
            raise BadRequestError(f"Cannot change leave from '{leave.status}' to '{new_status}'")
        if new_status == "approved":
            await _ensure_no_overlap(db, leave)
            await _mark_leave_attendance(db, leave)
        elif leave.status == "approved" and new_status == "cancelled":
            await _clear_leave_attendance(db, leave)
    if new_status in ("approved", "rejected") and not update_data.get("approved_by"):
        update_data["approved_by"] = approved_by
    previous_status = leave.status
    for key, value in update_data.items():
        if value is not None:
            setattr(leave, key, value)
    await db.flush()
    leave = await _get_one(db, LeaveRequest, leave_id, _via_staff(LeaveRequest.staff))
    if leave.status != previous_status and leave.status in ("approved", "rejected"):
        await notification_service.notify(
            db,
            await notification_service.staff_user_id(db, leave.staff_id),
            "leave",
            f"Leave request {leave.status}",
            f"Your {leave.leave_type} leave from {leave.start_date:%d %b} to {leave.end_date:%d %b %Y} "
            f"was {leave.status}.",
            reference_type="leave_request",
            reference_id=leave.id,
            exclude_user_id=approved_by,
        )
    return leave


# ---------- Payroll ----------

async def create_payroll(db: AsyncSession, data: PayrollCreate) -> Payroll:
    payroll = Payroll(**data.model_dump())
    db.add(payroll)
    await db.flush()
    return await _get_one(db, Payroll, payroll.id, _via_staff(Payroll.staff))


async def generate_payroll(db: AsyncSession, data: PayrollGenerateRequest) -> int:
    """Create pending payroll for every active staff member with a salary, skipping existing ones."""
    existing = await db.execute(
        select(Payroll.staff_id).where(Payroll.month == data.month, Payroll.year == data.year)
    )
    existing_ids = set(existing.scalars().all())
    result = await db.execute(
        select(Staff).where(Staff.status.in_(("active", "on_leave")), Staff.salary.is_not(None))
    )
    created = 0
    for staff in result.scalars().all():
        if staff.id in existing_ids:
            continue
        db.add(
            Payroll(
                staff_id=staff.id,
                month=data.month,
                year=data.year,
                basic_salary=staff.salary,
                allowances=0,
                deductions=0,
                net_salary=staff.salary,
            )
        )
        created += 1
    await db.flush()
    return created


async def list_payroll(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    staff_id: UUID | None = None,
    month: int | None = None,
    year: int | None = None,
) -> tuple[list[Payroll], int]:
    query = select(Payroll).options(*_via_staff(Payroll.staff)).order_by(Payroll.created_at.desc())
    filters = []
    if staff_id:
        filters.append(Payroll.staff_id == staff_id)
    if month:
        filters.append(Payroll.month == month)
    if year:
        filters.append(Payroll.year == year)
    return await _paginate(db, query, filters, page, limit)


async def mark_payroll_paid(db: AsyncSession, payroll_id: UUID) -> Payroll:
    payroll = await _get_one(db, Payroll, payroll_id, _via_staff(Payroll.staff))
    if payroll.status == "paid":
        raise BadRequestError("Payroll is already marked as paid")
    payroll.status = "paid"
    payroll.paid_at = datetime.now(timezone.utc)
    await db.flush()
    return await _get_one(db, Payroll, payroll_id, _via_staff(Payroll.staff))


async def update_payroll(db: AsyncSession, payroll_id: UUID, data: PayrollUpdate) -> Payroll:
    payroll = await _get_one(db, Payroll, payroll_id, _via_staff(Payroll.staff))
    if payroll.status != "pending":
        raise BadRequestError("Only pending payroll can be edited")
    values = data.model_dump(exclude_unset=True)
    if values.get("allowances") is not None:
        payroll.allowances = Decimal(str(values["allowances"]))
    if values.get("deductions") is not None:
        payroll.deductions = Decimal(str(values["deductions"]))
    net = Decimal(payroll.basic_salary) + Decimal(payroll.allowances or 0) - Decimal(payroll.deductions or 0)
    if net < 0:
        raise BadRequestError("Deductions cannot exceed basic salary plus allowances")
    payroll.net_salary = net
    await db.flush()
    return await _get_one(db, Payroll, payroll_id, _via_staff(Payroll.staff))


async def get_payroll_summary(db: AsyncSession, month: int, year: int) -> dict:
    is_paid = Payroll.status == "paid"
    row = (
        await db.execute(
            select(
                func.count(Payroll.id),
                func.coalesce(func.sum(Payroll.basic_salary), 0),
                func.coalesce(func.sum(Payroll.allowances), 0),
                func.coalesce(func.sum(Payroll.deductions), 0),
                func.coalesce(func.sum(Payroll.net_salary), 0),
                func.count(case((is_paid, 1))),
                func.coalesce(func.sum(case((is_paid, Payroll.net_salary), else_=0)), 0),
                func.count(case((~is_paid, 1))),
                func.coalesce(func.sum(case((~is_paid, Payroll.net_salary), else_=0)), 0),
            ).where(and_(Payroll.month == month, Payroll.year == year))
        )
    ).one()
    return {
        "month": month,
        "year": year,
        "total_records": row[0],
        "total_basic": float(row[1]),
        "total_allowances": float(row[2]),
        "total_deductions": float(row[3]),
        "total_net": float(row[4]),
        "paid_count": row[5],
        "paid_amount": float(row[6]),
        "pending_count": row[7],
        "pending_amount": float(row[8]),
    }
