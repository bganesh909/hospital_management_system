from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import Patient
from app.repositories.base import BaseRepository
from app.schemas.patient import PatientCreate, PatientUpdate
from app.utils.generators import generate_sequential_number


async def create_patient(db: AsyncSession, data: PatientCreate, registered_by: UUID) -> Patient:
    repo = BaseRepository(Patient, db)
    patient_number = await generate_sequential_number(db, Patient, "PAT", "patient_number")
    patient_data = data.model_dump()
    patient_data["patient_number"] = patient_number
    patient_data["registered_by"] = registered_by
    return await repo.create(patient_data)


async def get_patient(db: AsyncSession, patient_id: UUID) -> Patient:
    repo = BaseRepository(Patient, db)
    return await repo.get_by_id(patient_id)


def _search_filter(query: str):
    search = f"%{query}%"
    return or_(
        Patient.first_name.ilike(search),
        Patient.last_name.ilike(search),
        (Patient.first_name + " " + Patient.last_name).ilike(search),
        Patient.patient_number.ilike(search),
        Patient.phone.ilike(search),
        Patient.email.ilike(search),
    )


async def list_patients(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Patient], int]:
    repo = BaseRepository(Patient, db)
    filters = []
    if status:
        filters.append(Patient.status == status)
    if search:
        filters.append(_search_filter(search))
    return await repo.get_all(page=page, limit=limit, filters=filters)


async def update_patient(db: AsyncSession, patient_id: UUID, data: PatientUpdate) -> Patient:
    repo = BaseRepository(Patient, db)
    update_data = data.model_dump(exclude_unset=True)
    return await repo.update(patient_id, update_data)


async def delete_patient(db: AsyncSession, patient_id: UUID) -> bool:
    repo = BaseRepository(Patient, db)
    return await repo.delete(patient_id)


async def search_patients(db: AsyncSession, query: str, page: int = 1, limit: int = 20) -> tuple[list[Patient], int]:
    repo = BaseRepository(Patient, db)
    return await repo.get_all(page=page, limit=limit, filters=[_search_filter(query)])


async def get_patient_history(db: AsyncSession, patient_id: UUID) -> dict:
    """Return basic patient info; in a real app, aggregate visits/admissions/labs."""
    repo = BaseRepository(Patient, db)
    patient = await repo.get_by_id(patient_id)
    return {
        "patient_id": patient_id,
        "patient_number": patient.patient_number,
        "name": f"{patient.first_name} {patient.last_name}",
    }
