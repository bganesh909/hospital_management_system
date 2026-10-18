from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.auth import UserResponse
from app.schemas.user import PasswordResetRequest, UserAdminUpdate, UserCreate, UserStatusUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])

admin_only = require_role(UserRole.admin)


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    items, total = await user_service.list_users(
        db, page=page, limit=limit, search=search, role=role, is_active=is_active
    )
    return {
        "success": True,
        "data": await user_service.to_detail(db, items),
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


# Declared before /{user_id} so "unlinked" isn't parsed as an id
@router.get("/unlinked")
async def list_unlinked_users(
    link: Literal["doctor", "staff"],
    role: list[UserRole] | None = Query(None),
    search: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    users = await user_service.list_unlinked_users(db, link=link, roles=role, search=search, limit=limit)
    return {"success": True, "data": [UserResponse.model_validate(u) for u in users]}


@router.post("", status_code=201)
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = await user_service.create_user(db, data)
    return {"success": True, "data": (await user_service.to_detail(db, [user]))[0]}


@router.get("/{user_id}")
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = await user_service.get_user(db, user_id)
    return {"success": True, "data": (await user_service.to_detail(db, [user]))[0]}


@router.put("/{user_id}")
async def update_user(
    user_id: UUID,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = await user_service.update_user(db, user_id, data, actor=admin)
    return {"success": True, "data": (await user_service.to_detail(db, [user]))[0]}


@router.patch("/{user_id}/status")
async def set_user_status(
    user_id: UUID,
    data: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    user = await user_service.set_user_active(db, user_id, data.is_active, actor=admin)
    return {"success": True, "data": (await user_service.to_detail(db, [user]))[0]}


@router.patch("/{user_id}/password")
async def reset_user_password(
    user_id: UUID,
    data: PasswordResetRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(admin_only),
):
    await user_service.reset_password(db, user_id, data.new_password)
    return {"success": True, "message": "Password reset successfully"}
