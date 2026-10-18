from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("")
async def list_patients(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await patient_service.list_patients(
        db, page=page, limit=limit, status=status, search=search
    )
    return {
        "success": True,
        "data": [PatientResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("", status_code=201)
async def create_patient(
    data: PatientCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = await patient_service.create_patient(db, data, registered_by=user.id)
    return {"success": True, "data": PatientResponse.model_validate(patient)}


@router.get("/search")
async def search_patients(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await patient_service.search_patients(db, query=q, page=page, limit=limit)
    return {
        "success": True,
        "data": [PatientResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.get("/{patient_id}")
async def get_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = await patient_service.get_patient(db, patient_id)
    return {"success": True, "data": PatientResponse.model_validate(patient)}


@router.put("/{patient_id}")
async def update_patient(
    patient_id: UUID,
    data: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    patient = await patient_service.update_patient(db, patient_id, data)
    return {"success": True, "data": PatientResponse.model_validate(patient)}


@router.delete("/{patient_id}")
async def delete_patient(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    await patient_service.delete_patient(db, patient_id)
    return {"success": True, "message": "Patient deleted"}


@router.get("/{patient_id}/history")
async def get_patient_history(
    patient_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    history = await patient_service.get_patient_history(db, patient_id)
    return {"success": True, "data": history}
