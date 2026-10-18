from datetime import date, datetime, time, timedelta, timezone
from uuid import UUID

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse


async def list_audit_logs(
    db: AsyncSession,
    page: int = 1,
    limit: int = 50,
    entity_type: str | None = None,
    entity_id: UUID | None = None,
    action: str | None = None,
    user_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[list[AuditLogResponse], int]:
    filters = []
    if entity_type:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id:
        filters.append(AuditLog.entity_id == entity_id)
    if action:
        filters.append(AuditLog.action == action)
    if user_id:
        filters.append(AuditLog.user_id == user_id)
    if date_from:
        filters.append(AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        filters.append(AuditLog.created_at < end)

    total = (await db.execute(select(func.count()).select_from(AuditLog).where(*filters))).scalar() or 0

    query = (
        select(AuditLog, User.first_name, User.last_name, User.email, User.role)
        .outerjoin(User, User.id == AuditLog.user_id)
        .where(*filters)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = (await db.execute(query)).all()

    items = []
    for log, first_name, last_name, email, role in rows:
        name = f"{first_name or ''} {last_name or ''}".strip() or None
        items.append(
            AuditLogResponse(
                id=log.id,
                user_id=log.user_id,
                user_name=name,
                user_email=email,
                user_role=role.value if hasattr(role, "value") else role,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                old_values=log.old_values,
                new_values=log.new_values,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                created_at=log.created_at,
            )
        )
    return items, total


async def list_entity_types(db: AsyncSession) -> list[str]:
    result = await db.execute(select(distinct(AuditLog.entity_type)).order_by(AuditLog.entity_type))
    return [r for (r,) in result.all()]
