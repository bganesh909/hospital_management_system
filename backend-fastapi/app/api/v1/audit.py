from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.services import audit_service

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    action: str | None = Query(None, pattern="^(create|update|delete)$"),
    user_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    items, total = await audit_service.list_audit_logs(
        db,
        page=page,
        limit=limit,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    return {
        "success": True,
        "data": items,
        "meta": BaseRepository.get_pagination_meta(total, page, limit),
    }


@router.get("/entity-types")
async def list_entity_types(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(UserRole.admin)),
):
    return {"success": True, "data": await audit_service.list_entity_types(db)}
