from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.doctor import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DoctorCreate,
    DoctorResponse,
    DoctorScheduleCreate,
    DoctorScheduleResponse,
    DoctorUpdate,
)
from app.services import doctor_service

router = APIRouter(prefix="/doctors", tags=["Doctors"])


# ---------- Doctors ----------

@router.get("")
async def list_doctors(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    department_id: UUID | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await doctor_service.list_doctors(
        db, page=page, limit=limit, department_id=department_id, search=search
    )
    return {
        "success": True,
        "data": [DoctorResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("", status_code=201)
async def create_doctor(
    data: DoctorCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    doctor = await doctor_service.create_doctor(db, data)
    return {"success": True, "data": DoctorResponse.model_validate(doctor)}


@router.get("/available")
async def get_available_doctors(
    department_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doctors = await doctor_service.get_available_doctors(db, department_id=department_id)
    return {"success": True, "data": [DoctorResponse.model_validate(d) for d in doctors]}


@router.get("/{doctor_id}")
async def get_doctor(
    doctor_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    doctor = await doctor_service.get_doctor(db, doctor_id)
    return {"success": True, "data": DoctorResponse.model_validate(doctor)}


@router.put("/{doctor_id}")
async def update_doctor(
    doctor_id: UUID,
    data: DoctorUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    doctor = await doctor_service.update_doctor(db, doctor_id, data)
    return {"success": True, "data": DoctorResponse.model_validate(doctor)}


# ---------- Schedule ----------

@router.get("/{doctor_id}/schedule")
async def get_schedule(
    doctor_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    schedules = await doctor_service.get_doctor_schedule(db, doctor_id)
    return {"success": True, "data": [DoctorScheduleResponse.model_validate(s) for s in schedules]}


@router.put("/{doctor_id}/schedule")
async def update_schedule(
    doctor_id: UUID,
    data: list[DoctorScheduleCreate],
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.doctor)),
):
    schedules = await doctor_service.upsert_doctor_schedule(db, doctor_id, data)
    return {"success": True, "data": [DoctorScheduleResponse.model_validate(s) for s in schedules]}


# ---------- Departments ----------

departments_router = APIRouter(prefix="/departments", tags=["Departments"])


@departments_router.get("")
async def list_departments(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await doctor_service.list_departments(db, page=page, limit=limit, search=search)
    return {
        "success": True,
        "data": [DepartmentResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@departments_router.post("", status_code=201)
async def create_department(
    data: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    dept = await doctor_service.create_department(db, data)
    return {"success": True, "data": DepartmentResponse.model_validate(dept)}


@departments_router.get("/{department_id}")
async def get_department(
    department_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    dept = await doctor_service.get_department(db, department_id)
    return {"success": True, "data": DepartmentResponse.model_validate(dept)}


@departments_router.put("/{department_id}")
async def update_department(
    department_id: UUID,
    data: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    dept = await doctor_service.update_department(db, department_id, data)
    return {"success": True, "data": DepartmentResponse.model_validate(dept)}


@departments_router.delete("/{department_id}")
async def delete_department(
    department_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    await doctor_service.delete_department(db, department_id)
    return {"success": True, "data": None}
