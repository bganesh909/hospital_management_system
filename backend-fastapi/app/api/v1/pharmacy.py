from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.opd import PrescriptionResponse
from app.schemas.pharmacy import (
    DispensationCreate,
    DispensationResponse,
    MedicineCategoryCreate,
    MedicineCategoryResponse,
    MedicineCategoryUpdate,
    MedicineCreate,
    MedicineResponse,
    MedicineUpdate,
    StockUpdateRequest,
)
from app.services import pharmacy_service

router = APIRouter(prefix="/pharmacy", tags=["Pharmacy"])


# ---------- Categories ----------

@router.get("/categories")
async def list_categories(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items = await pharmacy_service.list_categories(db, search=search)
    return {"success": True, "data": [MedicineCategoryResponse.model_validate(i) for i in items]}


@router.post("/categories", status_code=201)
async def create_category(
    data: MedicineCategoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    cat = await pharmacy_service.create_category(db, data)
    return {"success": True, "data": MedicineCategoryResponse.model_validate(cat)}


@router.put("/categories/{category_id}")
async def update_category(
    category_id: UUID,
    data: MedicineCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    cat = await pharmacy_service.update_category(db, category_id, data)
    return {"success": True, "data": MedicineCategoryResponse.model_validate(cat)}


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    await pharmacy_service.delete_category(db, category_id)
    return {"success": True, "message": "Category deleted"}


# ---------- Medicines ----------

@router.get("/medicines")
async def list_medicines(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: UUID | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await pharmacy_service.list_medicines(
        db,
        page=page,
        limit=limit,
        category_id=category_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return {
        "success": True,
        "data": [MedicineResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/medicines", status_code=201)
async def create_medicine(
    data: MedicineCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    medicine = await pharmacy_service.create_medicine(db, data)
    return {"success": True, "data": MedicineResponse.model_validate(medicine)}


@router.put("/medicines/{medicine_id}")
async def update_medicine(
    medicine_id: UUID,
    data: MedicineUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    medicine = await pharmacy_service.update_medicine(db, medicine_id, data)
    return {"success": True, "data": MedicineResponse.model_validate(medicine)}


@router.patch("/medicines/{medicine_id}/stock")
async def update_stock(
    medicine_id: UUID,
    data: StockUpdateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    medicine = await pharmacy_service.update_stock(db, medicine_id, data)
    return {"success": True, "data": MedicineResponse.model_validate(medicine)}


@router.get("/medicines/low-stock")
async def get_low_stock(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    items = await pharmacy_service.get_low_stock(db)
    return {"success": True, "data": [MedicineResponse.model_validate(i) for i in items]}


@router.get("/medicines/expiring")
async def get_expiring(
    days: int = Query(30, ge=1),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    items = await pharmacy_service.get_expiring_medicines(db, days=days)
    return {"success": True, "data": [MedicineResponse.model_validate(i) for i in items]}


# Declared after /low-stock and /expiring so those paths aren't captured as an id
@router.get("/medicines/{medicine_id}")
async def get_medicine(
    medicine_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    medicine = await pharmacy_service.get_medicine(db, medicine_id)
    return {"success": True, "data": MedicineResponse.model_validate(medicine)}


# ---------- Dispensations ----------

@router.get("/dispensations")
async def list_dispensations(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    prescription_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await pharmacy_service.list_dispensations(
        db, page=page, limit=limit, prescription_id=prescription_id
    )
    return {
        "success": True,
        "data": [DispensationResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.post("/dispensations", status_code=201)
async def create_dispensation(
    data: DispensationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    dispensation = await pharmacy_service.create_dispensation(db, data, dispensed_by=user.id)
    return {"success": True, "data": DispensationResponse.model_validate(dispensation)}


@router.get("/prescriptions/pending")
async def get_pending_prescriptions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin, UserRole.pharmacist)),
):
    items = await pharmacy_service.get_pending_prescriptions(db)
    return {"success": True, "data": [PrescriptionResponse.model_validate(i) for i in items]}
