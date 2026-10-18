from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.opd import (
    OpdVisitCreate,
    OpdVisitResponse,
    OpdVisitUpdate,
    PrescriptionCreate,
    PrescriptionResponse,
    PrescriptionUpdate,
)
from app.services import opd_service

router = APIRouter(prefix="/opd", tags=["OPD"])


# ---------- Visits ----------

@router.get("/visits")
async def list_visits(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = None,
    doctor_id: UUID | None = None,
    status: str | None = None,
    date: date | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await opd_service.list_visits(
        db,
        page=page,
        limit=limit,
        patient_id=patient_id,
        doctor_id=doctor_id,
        status=status,
        visit_date=date,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "success": True,
        "data": [OpdVisitResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/visits", status_code=201)
async def create_visit(
    data: OpdVisitCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.receptionist)),
):
    visit = await opd_service.create_visit(db, data)
    return {"success": True, "data": OpdVisitResponse.model_validate(visit)}


@router.get("/visits/{visit_id}")
async def get_visit(
    visit_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    visit = await opd_service.get_visit(db, visit_id)
    return {"success": True, "data": OpdVisitResponse.model_validate(visit)}


@router.put("/visits/{visit_id}")
async def update_visit(
    visit_id: UUID,
    data: OpdVisitUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    visit = await opd_service.update_visit(db, visit_id, data)
    return {"success": True, "data": OpdVisitResponse.model_validate(visit)}


@router.patch("/visits/{visit_id}/complete")
async def complete_visit(
    visit_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    visit = await opd_service.complete_visit(db, visit_id)
    return {"success": True, "data": OpdVisitResponse.model_validate(visit)}


# ---------- Prescriptions ----------

@router.get("/prescriptions")
async def list_prescriptions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = None,
    opd_visit_id: UUID | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await opd_service.list_prescriptions(
        db, page=page, limit=limit, patient_id=patient_id, opd_visit_id=opd_visit_id, status=status
    )
    return {
        "success": True,
        "data": [PrescriptionResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/prescriptions", status_code=201)
async def create_prescription(
    data: PrescriptionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    prescription = await opd_service.create_prescription(db, data)
    return {"success": True, "data": PrescriptionResponse.model_validate(prescription)}


@router.get("/prescriptions/{prescription_id}")
async def get_prescription(
    prescription_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    prescription = await opd_service.get_prescription(db, prescription_id)
    return {"success": True, "data": PrescriptionResponse.model_validate(prescription)}


@router.put("/prescriptions/{prescription_id}")
async def update_prescription(
    prescription_id: UUID,
    data: PrescriptionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    prescription = await opd_service.update_prescription(db, prescription_id, data)
    return {"success": True, "data": PrescriptionResponse.model_validate(prescription)}
