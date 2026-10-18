from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.appointment import (
    AppointmentCancelRequest,
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AppointmentUpdate,
)
from app.services import appointment_service

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get("")
async def list_appointments(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    patient_id: UUID | None = None,
    doctor_id: UUID | None = None,
    status: str | None = None,
    appointment_date: date | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await appointment_service.list_appointments(
        db, page=page, limit=limit, patient_id=patient_id,
        doctor_id=doctor_id, status=status, appointment_date=appointment_date,
        search=search,
    )
    return {
        "success": True,
        "data": [AppointmentResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("", status_code=201)
async def create_appointment(
    data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    appointment = await appointment_service.create_appointment(db, data, booked_by=user.id)
    return {"success": True, "data": AppointmentResponse.model_validate(appointment)}


@router.get("/today")
async def get_today_appointments(
    doctor_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = await appointment_service.get_today_appointments(db, doctor_id=doctor_id)
    return {"success": True, "data": [AppointmentResponse.model_validate(i) for i in items]}


@router.get("/slots")
async def get_available_slots(
    doctor_id: UUID = Query(...),
    appointment_date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    slots = await appointment_service.get_available_slots(db, doctor_id, appointment_date)
    return {"success": True, "data": slots}


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    appointment = await appointment_service.get_appointment(db, appointment_id)
    return {"success": True, "data": AppointmentResponse.model_validate(appointment)}


@router.put("/{appointment_id}")
async def update_appointment(
    appointment_id: UUID,
    data: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    appointment = await appointment_service.update_appointment(db, appointment_id, data)
    return {"success": True, "data": AppointmentResponse.model_validate(appointment)}


@router.patch("/{appointment_id}/cancel")
async def cancel_appointment(
    appointment_id: UUID,
    data: AppointmentCancelRequest | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reason = data.cancelled_reason if data else None
    appointment = await appointment_service.cancel_appointment(db, appointment_id, reason)
    return {"success": True, "data": AppointmentResponse.model_validate(appointment)}


@router.patch("/{appointment_id}/status")
async def update_status(
    appointment_id: UUID,
    data: AppointmentStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    appointment = await appointment_service.update_status(db, appointment_id, data.status)
    return {"success": True, "data": AppointmentResponse.model_validate(appointment)}
