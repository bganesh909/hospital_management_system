from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.staff import (
    AttendanceCreate,
    AttendanceResponse,
    LeaveRequestCreate,
    LeaveRequestResponse,
    LeaveRequestUpdate,
    PayrollCreate,
    PayrollGenerateRequest,
    PayrollResponse,
    PayrollSummary,
    PayrollUpdate,
    StaffCreate,
    StaffResponse,
    StaffUpdate,
)
from app.services import staff_service

router = APIRouter(prefix="/staff", tags=["Staff"])


# ---------- Staff ----------

@router.get("")
async def list_staff(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_dir: Literal["asc", "desc"] = "asc",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await staff_service.list_staff(
        db, page=page, limit=limit, status=status, search=search, sort_by=sort_by, sort_dir=sort_dir
    )
    return {
        "success": True,
        "data": [StaffResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("", status_code=201)
async def create_staff(
    data: StaffCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    staff_member = await staff_service.create_staff(db, data)
    return {"success": True, "data": StaffResponse.model_validate(staff_member)}


@router.get("/{staff_id}")
async def get_staff(
    staff_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    staff_member = await staff_service.get_staff(db, staff_id)
    return {"success": True, "data": StaffResponse.model_validate(staff_member)}


@router.put("/{staff_id}")
async def update_staff(
    staff_id: UUID,
    data: StaffUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    staff_member = await staff_service.update_staff(db, staff_id, data)
    return {"success": True, "data": StaffResponse.model_validate(staff_member)}


# ---------- Attendance ----------

@router.get("/attendance/list")
async def list_attendance(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    staff_id: UUID | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    on_date: date | None = Query(None, alias="date"),
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await staff_service.list_attendance(
        db, page=page, limit=limit, staff_id=staff_id, month=month, year=year, on_date=on_date, search=search
    )
    return {
        "success": True,
        "data": [AttendanceResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/attendance")
async def create_attendance(
    data: AttendanceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    attendance = await staff_service.create_attendance(db, data)
    return {"success": True, "data": AttendanceResponse.model_validate(attendance)}


# ---------- Leave Requests ----------

@router.get("/leave-requests/list")
async def list_leave_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    staff_id: UUID | None = None,
    status: str | None = None,
    leave_type: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await staff_service.list_leave_requests(
        db, page=page, limit=limit, staff_id=staff_id, status=status, leave_type=leave_type, search=search
    )
    return {
        "success": True,
        "data": [LeaveRequestResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/leave-requests")
async def create_leave_request(
    data: LeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    leave = await staff_service.create_leave_request(db, data)
    return {"success": True, "data": LeaveRequestResponse.model_validate(leave)}


@router.patch("/leave-requests/{leave_id}")
async def update_leave_request(
    leave_id: UUID,
    data: LeaveRequestUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    leave = await staff_service.update_leave_request(db, leave_id, data, approved_by=user.id)
    return {"success": True, "data": LeaveRequestResponse.model_validate(leave)}


# ---------- Payroll ----------

@router.get("/payroll/list")
async def list_payroll(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    staff_id: UUID | None = None,
    month: int | None = Query(None, ge=1, le=12),
    year: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    items, total = await staff_service.list_payroll(
        db, page=page, limit=limit, staff_id=staff_id, month=month, year=year
    )
    return {
        "success": True,
        "data": [PayrollResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.get("/payroll/summary")
async def get_payroll_summary(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    summary = await staff_service.get_payroll_summary(db, month, year)
    return {"success": True, "data": PayrollSummary(**summary)}


@router.post("/payroll")
async def create_payroll(
    data: PayrollCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    payroll = await staff_service.create_payroll(db, data)
    return {"success": True, "data": PayrollResponse.model_validate(payroll)}


@router.post("/payroll/generate")
async def generate_payroll(
    data: PayrollGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    created = await staff_service.generate_payroll(db, data)
    return {"success": True, "data": {"created": created}}


@router.patch("/payroll/{payroll_id}/pay")
async def mark_payroll_paid(
    payroll_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    payroll = await staff_service.mark_payroll_paid(db, payroll_id)
    return {"success": True, "data": PayrollResponse.model_validate(payroll)}


@router.patch("/payroll/{payroll_id}")
async def update_payroll(
    payroll_id: UUID,
    data: PayrollUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    payroll = await staff_service.update_payroll(db, payroll_id, data)
    return {"success": True, "data": PayrollResponse.model_validate(payroll)}
