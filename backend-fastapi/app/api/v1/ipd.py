from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.ipd import (
    BedBulkCreate,
    BedCreate,
    BedResponse,
    BedUpdate,
    IpdAdmissionCreate,
    IpdAdmissionResponse,
    IpdAdmissionUpdate,
    IpdDailyRoundCreate,
    IpdDailyRoundResponse,
    IpdDischargeRequest,
    IpdTransferRequest,
    WardCreate,
    WardResponse,
    WardUpdate,
)
from app.services import ipd_service

router = APIRouter(prefix="/ipd", tags=["IPD"])


# ---------- Wards ----------

@router.get("/wards")
async def list_wards(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await ipd_service.list_wards(db, page=page, limit=limit)
    return {
        "success": True,
        "data": [WardResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/wards", status_code=201)
async def create_ward(
    data: WardCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    ward = await ipd_service.create_ward(db, data)
    return {"success": True, "data": WardResponse.model_validate(ward)}


@router.put("/wards/{ward_id}")
async def update_ward(
    ward_id: UUID,
    data: WardUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    ward = await ipd_service.update_ward(db, ward_id, data)
    return {"success": True, "data": WardResponse.model_validate(ward)}


@router.delete("/wards/{ward_id}")
async def delete_ward(
    ward_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    await ipd_service.delete_ward(db, ward_id)
    return {"success": True, "message": "Ward deleted"}


# ---------- Beds ----------

@router.get("/beds")
async def list_beds(
    ward_id: UUID | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await ipd_service.list_beds(
        db, ward_id=ward_id, status=status, page=page, limit=limit
    )
    return {
        "success": True,
        "data": [BedResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/beds", status_code=201)
async def create_bed(
    data: BedCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    bed = await ipd_service.create_bed(db, data)
    return {"success": True, "data": BedResponse.model_validate(bed)}


@router.post("/beds/bulk", status_code=201)
async def create_beds_bulk(
    data: BedBulkCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    beds = await ipd_service.create_beds_bulk(db, data)
    return {"success": True, "data": [BedResponse.model_validate(b) for b in beds]}


@router.delete("/beds/{bed_id}")
async def delete_bed(
    bed_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    await ipd_service.delete_bed(db, bed_id)
    return {"success": True, "message": "Bed deleted"}


@router.patch("/beds/{bed_id}")
async def update_bed(
    bed_id: UUID,
    data: BedUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.nurse)),
):
    bed = await ipd_service.update_bed(db, bed_id, data)
    return {"success": True, "data": BedResponse.model_validate(bed)}


# ---------- Admissions ----------

@router.get("/admissions")
async def list_admissions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: Literal["asc", "desc"] = "desc",
    patient_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await ipd_service.list_admissions(
        db,
        page=page,
        limit=limit,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        patient_id=patient_id,
    )
    return {
        "success": True,
        "data": [IpdAdmissionResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/admissions", status_code=201)
async def create_admission(
    data: IpdAdmissionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.receptionist)),
):
    admission = await ipd_service.create_admission(db, data, admitted_by=user.id)
    return {"success": True, "data": IpdAdmissionResponse.model_validate(admission)}


@router.get("/admissions/{admission_id}")
async def get_admission(
    admission_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    admission = await ipd_service.get_admission(db, admission_id)
    return {"success": True, "data": IpdAdmissionResponse.model_validate(admission)}


@router.put("/admissions/{admission_id}")
async def update_admission(
    admission_id: UUID,
    data: IpdAdmissionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    admission = await ipd_service.update_admission(db, admission_id, data)
    return {"success": True, "data": IpdAdmissionResponse.model_validate(admission)}


@router.patch("/admissions/{admission_id}/discharge")
async def discharge_patient(
    admission_id: UUID,
    data: IpdDischargeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    admission = await ipd_service.discharge_patient(db, admission_id, data)
    return {"success": True, "data": IpdAdmissionResponse.model_validate(admission)}


@router.patch("/admissions/{admission_id}/transfer")
async def transfer_bed(
    admission_id: UUID,
    data: IpdTransferRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.nurse)),
):
    admission = await ipd_service.transfer_bed(db, admission_id, data.bed_id)
    return {"success": True, "data": IpdAdmissionResponse.model_validate(admission)}


# ---------- Daily Rounds ----------

@router.get("/rounds/{admission_id}")
async def list_rounds(
    admission_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rounds = await ipd_service.list_rounds(db, admission_id)
    return {"success": True, "data": [IpdDailyRoundResponse.model_validate(r) for r in rounds]}


@router.post("/rounds", status_code=201)
async def create_round(
    data: IpdDailyRoundCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.nurse)),
):
    round_entry = await ipd_service.create_round(db, data)
    return {"success": True, "data": IpdDailyRoundResponse.model_validate(round_entry)}
