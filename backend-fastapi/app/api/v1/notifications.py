from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.repositories.base import BaseRepository
from app.schemas.notification import (
    NotificationPreferenceResponse,
    NotificationPreferenceUpdate,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    is_read: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    items, total = await notification_service.list_notifications(
        db, user_id=user.id, page=page, limit=limit, is_read=is_read
    )
    return {
        "success": True,
        "data": [NotificationResponse.model_validate(i) for i in items],
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.get("/unread-count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = await notification_service.get_unread_count(db, user_id=user.id)
    return {"success": True, "data": UnreadCountResponse(unread_count=count)}


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = await notification_service.mark_read(db, notification_id, user_id=user.id)
    return {"success": True, "data": NotificationResponse.model_validate(notification)}


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    count = await notification_service.mark_all_read(db, user_id=user.id)
    return {"success": True, "message": f"Marked {count} notifications as read"}


@router.get("/preferences")
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = await notification_service.get_preferences(db, user_id=user.id)
    return {"success": True, "data": NotificationPreferenceResponse.model_validate(pref)}


@router.put("/preferences")
async def update_preferences(
    data: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pref = await notification_service.update_preferences(db, user_id=user.id, data=data)
    return {"success": True, "data": NotificationPreferenceResponse.model_validate(pref)}
