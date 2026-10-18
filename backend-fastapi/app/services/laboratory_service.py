from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.doctor import Doctor
from app.models.laboratory import LabRequest, LabRequestItem, LabTestCatalog
from app.models.patient import Patient
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.laboratory import (
    LabRequestCreate,
    LabResultEntry,
    LabTestCatalogCreate,
    LabTestCatalogUpdate,
)
from app.services import notification_service
from app.utils.generators import generate_sequential_number

# Display-only values (names, test details) are attached as plain attributes on
# the ORM instances so the Pydantic response models can read them via from_attributes.


# ---------- Catalog ----------

async def create_catalog_item(db: AsyncSession, data: LabTestCatalogCreate) -> LabTestCatalog:
    code = data.test_code.strip().upper()
    taken = await db.execute(select(LabTestCatalog.id).where(func.upper(LabTestCatalog.test_code) == code))
    if taken.first():
        raise ConflictError(f"Test code {code} already exists")
    repo = BaseRepository(LabTestCatalog, db)
    return await repo.create(data.model_dump() | {"test_code": code})


async def list_catalog(
    db: AsyncSession,
    page: int = 1,
    limit: int = 50,
    search: str | None = None,
    is_active: bool | None = None,
) -> tuple[list[LabTestCatalog], int]:
    repo = BaseRepository(LabTestCatalog, db)
    filters = []
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                LabTestCatalog.name.ilike(term),
                LabTestCatalog.test_code.ilike(term),
                LabTestCatalog.category.ilike(term),
            )
        )
    if is_active is not None:
        filters.append(LabTestCatalog.is_active == is_active)
    return await repo.get_all(page=page, limit=limit, filters=filters, order_by=LabTestCatalog.name)


async def update_catalog_item(db: AsyncSession, item_id: UUID, data: LabTestCatalogUpdate) -> LabTestCatalog:
    changes = data.model_dump(exclude_unset=True)
    for field in ("name", "price", "turnaround_hours", "is_active"):
        if field in changes and changes[field] is None:
            raise BadRequestError(f"{field} cannot be empty")
    repo = BaseRepository(LabTestCatalog, db)
    return await repo.update(item_id, changes)


# ---------- Lab Requests ----------

def _request_query():
    return select(LabRequest).options(selectinload(LabRequest.items))


async def _attach_request_details(db: AsyncSession, requests: list[LabRequest]) -> list[LabRequest]:
    if not requests:
        return requests

    patient_rows = await db.execute(
        select(Patient.id, Patient.first_name + " " + Patient.last_name, Patient.patient_number)
        .where(Patient.id.in_({r.patient_id for r in requests}))
    )
    patients = {row[0]: row[1:] for row in patient_rows}

    doctor_rows = await db.execute(
        select(Doctor.id, User.first_name + " " + User.last_name)
        .join(User, User.id == Doctor.user_id)
        .where(Doctor.id.in_({r.doctor_id for r in requests}))
    )
    doctors = dict(doctor_rows.all())

    test_ids = {item.test_id for r in requests for item in r.items}
    tests = {}
    if test_ids:
        test_rows = await db.execute(
            select(
                LabTestCatalog.id,
                LabTestCatalog.name,
                LabTestCatalog.test_code,
                LabTestCatalog.normal_range,
                LabTestCatalog.unit,
            ).where(LabTestCatalog.id.in_(test_ids))
        )
        tests = {row[0]: row[1:] for row in test_rows}

    for r in requests:
        r.patient_name, r.patient_number = patients.get(r.patient_id, (None, None))
        r.doctor_name = doctors.get(r.doctor_id)
        for item in r.items:
            item.test_name, item.test_code, item.normal_range, item.unit = tests.get(
                item.test_id, (None, None, None, None)
            )
    return requests


async def create_lab_request(db: AsyncSession, data: LabRequestCreate) -> LabRequest:
    request_number = await generate_sequential_number(db, LabRequest, "LAB", "request_number")
    lab_request = LabRequest(
        request_number=request_number,
        patient_id=data.patient_id,
        doctor_id=data.doctor_id,
        opd_visit_id=data.opd_visit_id,
        ipd_admission_id=data.ipd_admission_id,
        priority=data.priority,
        notes=data.notes,
    )
    db.add(lab_request)
    await db.flush()

    for item_data in data.items:
        db.add(LabRequestItem(request_id=lab_request.id, test_id=item_data.test_id))
    await db.flush()
    lab_request = await get_lab_request(db, lab_request.id)
    await notification_service.notify_roles(
        db,
        (UserRole.lab_tech,),
        "lab_request",
        f"New {lab_request.priority} lab request" if lab_request.priority != "normal" else "New lab request",
        f"{lab_request.request_number}: {len(lab_request.items)} test(s) for {_patient_label(lab_request)}.",
        reference_type="lab_request",
        reference_id=lab_request.id,
    )
    return lab_request


def _patient_label(request: LabRequest) -> str:
    return getattr(request, "patient_name", None) or "a patient"


async def list_lab_requests(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    patient_id: UUID | None = None,
    status: str | None = None,
    priority: str | None = None,
    search: str | None = None,
) -> tuple[list[LabRequest], int]:
    query = _request_query()
    if patient_id:
        query = query.where(LabRequest.patient_id == patient_id)
    if status:
        query = query.where(LabRequest.status == status)
    if priority:
        query = query.where(LabRequest.priority == priority)
    if search:
        term = f"%{search}%"
        query = query.join(Patient, Patient.id == LabRequest.patient_id).where(
            or_(
                LabRequest.request_number.ilike(term),
                Patient.first_name.ilike(term),
                Patient.last_name.ilike(term),
                Patient.patient_number.ilike(term),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(query.with_only_columns(LabRequest.id).subquery()))
    ).scalar() or 0
    result = await db.execute(
        query.order_by(LabRequest.created_at.desc()).offset((page - 1) * limit).limit(limit)
    )
    return await _attach_request_details(db, list(result.scalars().all())), total


async def get_lab_request(db: AsyncSession, request_id: UUID) -> LabRequest:
    result = await db.execute(
        _request_query().where(LabRequest.id == request_id).execution_options(populate_existing=True)
    )
    request = result.scalar_one_or_none()
    if not request:
        raise NotFoundError("Lab request not found")
    return (await _attach_request_details(db, [request]))[0]


async def update_request_status(db: AsyncSession, request_id: UUID, status: str) -> LabRequest:
    request = await get_lab_request(db, request_id)
    if status == "completed" and any(item.result_status == "pending" for item in request.items):
        raise BadRequestError("All test results must be entered before completing the request")
    request.status = status
    await db.flush()
    return await get_lab_request(db, request_id)


async def enter_result(
    db: AsyncSession, item_id: UUID, data: LabResultEntry, performed_by: UUID
) -> LabRequestItem:
    result = await db.execute(select(LabRequestItem).where(LabRequestItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Lab request item not found")
    item.result_value = data.result_value
    item.result_status = data.result_status
    item.performed_by = performed_by
    item.performed_at = datetime.now(timezone.utc)
    item.remarks = data.remarks
    await db.flush()

    # Complete the request once every test has a result
    request = await get_lab_request(db, item.request_id)
    if request.status != "cancelled" and all(i.result_status != "pending" for i in request.items):
        request.status = "completed"
        await db.flush()
        await notification_service.notify_doctor(
            db,
            request.doctor_id,
            "lab_result",
            "Lab results ready",
            f"{request.request_number}: all results are in for {_patient_label(request)}.",
            reference_type="lab_request",
            reference_id=request.id,
        )

    entered = next(i for i in request.items if i.id == item_id)
    if data.result_status == "critical":
        await notification_service.notify_doctor(
            db,
            request.doctor_id,
            "lab_result",
            "Critical lab result",
            f"{request.request_number}: {getattr(entered, 'test_name', None) or 'A test'} for "
            f"{_patient_label(request)} is critical ({data.result_value}).",
            reference_type="lab_request",
            reference_id=request.id,
        )
    return entered


async def get_pending_requests(db: AsyncSession) -> list[LabRequest]:
    result = await db.execute(
        _request_query()
        .where(LabRequest.status.in_(["requested", "sample_collected", "processing"]))
        .order_by(LabRequest.created_at)
    )
    return await _attach_request_details(db, list(result.scalars().all()))


async def get_patient_report(db: AsyncSession, patient_id: UUID) -> list[LabRequest]:
    result = await db.execute(
        _request_query()
        .where(LabRequest.patient_id == patient_id)
        .order_by(LabRequest.created_at.desc())
    )
    return await _attach_request_details(db, list(result.scalars().all()))
