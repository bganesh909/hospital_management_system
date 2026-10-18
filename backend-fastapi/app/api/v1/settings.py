from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.schemas.settings import HospitalSettingsResponse, HospitalSettingsUpdate
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hospital = await settings_service.get_settings(db)
    return {"success": True, "data": HospitalSettingsResponse.model_validate(hospital)}


@router.put("")
async def update_settings(
    data: HospitalSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    hospital = await settings_service.update_settings(db, data)
    return {"success": True, "data": HospitalSettingsResponse.model_validate(hospital)}
