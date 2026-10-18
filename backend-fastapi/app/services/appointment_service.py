from datetime import date, datetime, time, timedelta
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models.appointment import Appointment, AppointmentStatus
from app.models.doctor import Doctor, DoctorSchedule
from app.models.patient import Patient
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate
from app.services import notification_service
from app.utils.generators import generate_sequential_number

# Use these whenever an appointment is serialized with AppointmentResponse
APPOINTMENT_LOAD_OPTIONS = (
    selectinload(Appointment.patient),
    selectinload(Appointment.doctor).selectinload(Doctor.user),
)


async def _ensure_slot_free(
    db: AsyncSession, doctor_id: UUID, appointment_date: date, start_time: time,
    exclude_id: UUID | None = None,
) -> None:
    query = select(Appointment.id).where(
        Appointment.doctor_id == doctor_id,
        Appointment.appointment_date == appointment_date,
        Appointment.start_time == start_time,
        Appointment.status.notin_([AppointmentStatus.cancelled, AppointmentStatus.no_show]),
    )
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)
    if (await db.execute(query)).first():
        raise ConflictError("This time slot is already booked for the doctor")


async def create_appointment(db: AsyncSession, data: AppointmentCreate, booked_by: UUID) -> Appointment:
    await _ensure_slot_free(db, data.doctor_id, data.appointment_date, data.start_time)
    repo = BaseRepository(Appointment, db)
    apt_number = await generate_sequential_number(db, Appointment, "APT", "appointment_number")
    apt_data = data.model_dump()
    apt_data["appointment_number"] = apt_number
    apt_data["booked_by"] = booked_by
    appointment = await repo.create(apt_data)
    appointment = await get_appointment(db, appointment.id)
    await _notify_doctor(db, appointment, "New appointment", "booked", exclude_user_id=booked_by)
    return appointment


async def get_appointment(db: AsyncSession, appointment_id: UUID) -> Appointment:
    result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id).options(*APPOINTMENT_LOAD_OPTIONS)
        .execution_options(populate_existing=True)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise NotFoundError("Appointment not found")
    return appointment


async def list_appointments(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    patient_id: UUID | None = None,
    doctor_id: UUID | None = None,
    status: str | None = None,
    appointment_date: date | None = None,
    search: str | None = None,
) -> tuple[list[Appointment], int]:
    query = select(Appointment)
    if patient_id:
        query = query.where(Appointment.patient_id == patient_id)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    if status:
        query = query.where(Appointment.status == status)
    if appointment_date:
        query = query.where(Appointment.appointment_date == appointment_date)
    if search:
        term = f"%{search}%"
        query = (
            query.join(Patient, Appointment.patient_id == Patient.id)
            .join(Doctor, Appointment.doctor_id == Doctor.id)
            .join(User, Doctor.user_id == User.id)
            .where(
                or_(
                    Appointment.appointment_number.ilike(term),
                    Patient.patient_number.ilike(term),
                    (Patient.first_name + " " + Patient.last_name).ilike(term),
                    (User.first_name + " " + User.last_name).ilike(term),
                )
            )
        )
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(
        query.options(*APPOINTMENT_LOAD_OPTIONS)
        .order_by(Appointment.appointment_date.desc(), Appointment.start_time)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def update_appointment(db: AsyncSession, appointment_id: UUID, data: AppointmentUpdate) -> Appointment:
    repo = BaseRepository(Appointment, db)
    current = await repo.get_by_id(appointment_id)
    changes = data.model_dump(exclude_unset=True)
    if {"doctor_id", "appointment_date", "start_time"} & changes.keys():
        await _ensure_slot_free(
            db,
            changes.get("doctor_id") or current.doctor_id,
            changes.get("appointment_date") or current.appointment_date,
            changes.get("start_time") or current.start_time,
            exclude_id=appointment_id,
        )
    await repo.update(appointment_id, changes)
    appointment = await get_appointment(db, appointment_id)
    if {"doctor_id", "appointment_date", "start_time"} & changes.keys():
        await _notify_doctor(db, appointment, "Appointment rescheduled", "rescheduled to")
    return appointment


async def cancel_appointment(db: AsyncSession, appointment_id: UUID, reason: str | None = None) -> Appointment:
    repo = BaseRepository(Appointment, db)
    appointment = await repo.get_by_id(appointment_id)
    if appointment.status in (AppointmentStatus.completed, AppointmentStatus.cancelled):
        raise BadRequestError("Cannot cancel this appointment")
    appointment.status = AppointmentStatus.cancelled
    appointment.cancelled_reason = reason
    await db.flush()
    appointment = await get_appointment(db, appointment_id)
    await _notify_doctor(db, appointment, "Appointment cancelled", "cancelled for")
    return appointment


async def _notify_doctor(
    db: AsyncSession, appointment: Appointment, title: str, verb: str, exclude_user_id: UUID | None = None
) -> None:
    patient = appointment.patient
    who = f"{patient.first_name} {patient.last_name}" if patient else "A patient"
    when = f"{appointment.appointment_date:%d %b %Y} at {appointment.start_time:%H:%M}"
    await notification_service.notify_doctor(
        db,
        appointment.doctor_id,
        "appointment",
        title,
        f"{appointment.appointment_number}: {who}, {verb} {when}.",
        reference_type="appointment",
        reference_id=appointment.id,
        exclude_user_id=exclude_user_id,
    )


async def update_status(db: AsyncSession, appointment_id: UUID, status: AppointmentStatus) -> Appointment:
    repo = BaseRepository(Appointment, db)
    appointment = await repo.get_by_id(appointment_id)
    appointment.status = status
    await db.flush()
    return await get_appointment(db, appointment_id)


async def get_today_appointments(db: AsyncSession, doctor_id: UUID | None = None) -> list[Appointment]:
    today = date.today()
    query = select(Appointment).where(Appointment.appointment_date == today).options(*APPOINTMENT_LOAD_OPTIONS)
    if doctor_id:
        query = query.where(Appointment.doctor_id == doctor_id)
    query = query.order_by(Appointment.start_time)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_available_slots(
    db: AsyncSession, doctor_id: UUID, appointment_date: date
) -> list[dict]:
    # Schedules use 0=Sunday..6=Saturday (JS convention); Python's weekday() is 0=Monday
    day_of_week = (appointment_date.weekday() + 1) % 7
    result = await db.execute(
        select(DoctorSchedule).where(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == day_of_week,
            DoctorSchedule.is_active == True,  # noqa: E712
        )
    )
    schedules = list(result.scalars().all())
    if not schedules:
        return []

    # Get existing appointments for that day
    existing = await db.execute(
        select(Appointment).where(
            Appointment.doctor_id == doctor_id,
            Appointment.appointment_date == appointment_date,
            Appointment.status.notin_([AppointmentStatus.cancelled, AppointmentStatus.no_show]),
        )
    )
    booked_times = {a.start_time for a in existing.scalars().all()}

    slots = []
    for sched in schedules:
        current = datetime.combine(appointment_date, sched.start_time)
        end = datetime.combine(appointment_date, sched.end_time)
        slot_duration = timedelta(minutes=30)
        while current + slot_duration <= end:
            slot_time = current.time()
            slot_end = (current + slot_duration).time()
            slots.append({
                "start_time": slot_time.strftime("%H:%M"),
                "end_time": slot_end.strftime("%H:%M"),
                "available": slot_time not in booked_times,
            })
            current += slot_duration
    return slots
