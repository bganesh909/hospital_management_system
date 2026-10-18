from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.laboratory import (
    LabPriority,
    LabRequestCreate,
    LabRequestItemResponse,
    LabRequestResponse,
    LabRequestStatus,
    LabResultEntry,
    LabStatusUpdate,
    LabTestCatalogCreate,
    LabTestCatalogResponse,
    LabTestCatalogUpdate,
)
from app.services import laboratory_service

router = APIRouter(prefix="/lab", tags=["Laboratory"])


# ---------- Catalog ----------

@router.get("/catalog")
async def list_catalog(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await laboratory_service.list_catalog(
        db, page=page, limit=limit, search=search, is_active=is_active
    )
    return {
        "success": True,
        "data": [LabTestCatalogResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/catalog", status_code=201)
async def create_catalog_item(
    data: LabTestCatalogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.lab_tech)),
):
    item = await laboratory_service.create_catalog_item(db, data)
    return {"success": True, "data": LabTestCatalogResponse.model_validate(item)}


@router.put("/catalog/{item_id}")
async def update_catalog_item(
    item_id: UUID,
    data: LabTestCatalogUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.lab_tech)),
):
    item = await laboratory_service.update_catalog_item(db, item_id, data)
    return {"success": True, "data": LabTestCatalogResponse.model_validate(item)}


# ---------- Requests ----------

@router.get("/requests")
async def list_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = None,
    status: LabRequestStatus | None = None,
    priority: LabPriority | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await laboratory_service.list_lab_requests(
        db,
        page=page,
        limit=limit,
        patient_id=patient_id,
        status=status,
        priority=priority,
        search=search,
    )
    return {
        "success": True,
        "data": [LabRequestResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/requests", status_code=201)
async def create_request(
    data: LabRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor, UserRole.lab_tech)),
):
    request = await laboratory_service.create_lab_request(db, data)
    return {"success": True, "data": LabRequestResponse.model_validate(request)}


@router.get("/requests/pending")
async def get_pending_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.lab_tech)),
):
    items = await laboratory_service.get_pending_requests(db)
    return {"success": True, "data": [LabRequestResponse.model_validate(i) for i in items]}


@router.get("/requests/{request_id}")
async def get_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    request = await laboratory_service.get_lab_request(db, request_id)
    return {"success": True, "data": LabRequestResponse.model_validate(request)}


@router.patch("/requests/{request_id}/status")
async def update_request_status(
    request_id: UUID,
    data: LabStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.lab_tech)),
):
    request = await laboratory_service.update_request_status(db, request_id, data.status)
    return {"success": True, "data": LabRequestResponse.model_validate(request)}


@router.patch("/requests/items/{item_id}/result")
async def enter_result(
    item_id: UUID,
    data: LabResultEntry,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.lab_tech)),
):
    item = await laboratory_service.enter_result(db, item_id, data, performed_by=user.id)
    return {"success": True, "data": LabRequestItemResponse.model_validate(item)}


@router.get("/report/{patient_id}")
async def get_patient_report(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = await laboratory_service.get_patient_report(db, patient_id)
    return {"success": True, "data": [LabRequestResponse.model_validate(i) for i in items]}
