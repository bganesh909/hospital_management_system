import asyncio
import logging
import smtplib
from email.message import EmailMessage
from uuid import UUID

from sqlalchemy import event, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import async_session
from app.core.exceptions import NotFoundError
from app.models.doctor import Doctor
from app.models.notification import Notification, NotificationPreference
from app.models.staff import Staff
from app.models.user import User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.notification import NotificationPreferenceUpdate

logger = logging.getLogger(__name__)

# Notification type -> preference flag that controls email for it
_EMAIL_PREF = {
    "appointment": "appointment_email",
    "lab_result": "lab_result_email",
    "billing": "billing_email",
}
_PENDING_EMAILS = "pending_notification_emails"
_email_tasks: set[asyncio.Task] = set()  # keep references so tasks aren't GC'd


async def list_notifications(
    db: AsyncSession, user_id: UUID, page: int = 1, limit: int = 20, is_read: bool | None = None
) -> tuple[list[Notification], int]:
    repo = BaseRepository(Notification, db)
    filters = [Notification.user_id == user_id]
    if is_read is not None:
        filters.append(Notification.is_read == is_read)
    return await repo.get_all(page=page, limit=limit, filters=filters)


async def get_unread_count(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    return result.scalar() or 0


async def mark_read(db: AsyncSession, notification_id: UUID, user_id: UUID) -> Notification:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise NotFoundError("Notification not found")
    notification.is_read = True
    await db.flush()
    await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, user_id: UUID) -> int:
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,  # noqa: E712
        )
    )
    notifications = result.scalars().all()
    count = 0
    for n in notifications:
        n.is_read = True
        count += 1
    await db.flush()
    return count


async def get_preferences(db: AsyncSession, user_id: UUID) -> NotificationPreference:
    result = await db.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    pref = result.scalar_one_or_none()
    if not pref:
        # Create default preferences
        pref = NotificationPreference(user_id=user_id)
        db.add(pref)
        await db.flush()
        await db.refresh(pref)
    return pref


async def update_preferences(
    db: AsyncSession, user_id: UUID, data: NotificationPreferenceUpdate
) -> NotificationPreference:
    pref = await get_preferences(db, user_id)
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(pref, key, value)
    await db.flush()
    await db.refresh(pref)
    return pref


# ---------- Creating notifications ----------

def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


async def notify(
    db: AsyncSession,
    user_ids: list[UUID] | UUID | None,
    type: str,
    title: str,
    message: str,
    reference_type: str | None = None,
    reference_id: UUID | None = None,
    exclude_user_id: UUID | None = None,
) -> None:
    """Create in-app notifications (and queue email if enabled). Never raises:
    a notification failure must not break the business operation."""
    if user_ids is None:
        return
    ids = {user_ids} if isinstance(user_ids, UUID) else set(user_ids)
    ids.discard(None)
    ids.discard(exclude_user_id)
    if not ids:
        return
    try:
        async with db.begin_nested():
            users = (
                await db.execute(select(User).where(User.id.in_(ids), User.is_active == True))  # noqa: E712
            ).scalars().all()
            prefs = {}
            if _smtp_configured():
                rows = await db.execute(
                    select(NotificationPreference).where(NotificationPreference.user_id.in_(ids))
                )
                prefs = {p.user_id: p for p in rows.scalars().all()}

            pref_key = _EMAIL_PREF.get(type, "system_email")
            for user in users:
                pref = prefs.get(user.id)
                # Defaults mirror the table: system email off, others on
                wants_email = getattr(pref, pref_key) if pref else pref_key != "system_email"
                send_email = _smtp_configured() and wants_email and bool(user.email)
                notification = Notification(
                    user_id=user.id,
                    title=title[:200],
                    message=message,
                    type=type[:30],
                    reference_type=reference_type,
                    reference_id=reference_id,
                    sent_via="both" if send_email else "in_app",
                )
                db.add(notification)
                await db.flush()
                if send_email:
                    db.sync_session.info.setdefault(_PENDING_EMAILS, []).append(
                        (notification.id, user.email, title, message)
                    )
    except Exception:  # noqa: BLE001
        logger.exception("Failed to create notification %r", title)


async def user_ids_for_roles(db: AsyncSession, *roles: UserRole) -> list[UUID]:
    result = await db.execute(
        select(User.id).where(User.role.in_(roles), User.is_active == True)  # noqa: E712
    )
    return list(result.scalars().all())


async def doctor_user_id(db: AsyncSession, doctor_id: UUID | None) -> UUID | None:
    if not doctor_id:
        return None
    return (await db.execute(select(Doctor.user_id).where(Doctor.id == doctor_id))).scalar_one_or_none()


async def staff_user_id(db: AsyncSession, staff_id: UUID | None) -> UUID | None:
    if not staff_id:
        return None
    return (await db.execute(select(Staff.user_id).where(Staff.id == staff_id))).scalar_one_or_none()


async def notify_doctor(db: AsyncSession, doctor_id: UUID | None, type: str, title: str, message: str, **kwargs) -> None:
    try:
        user_id = await doctor_user_id(db, doctor_id)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to resolve doctor for notification")
        return
    await notify(db, user_id, type, title, message, **kwargs)


async def notify_roles(db: AsyncSession, roles: tuple[UserRole, ...], type: str, title: str, message: str, **kwargs) -> None:
    try:
        user_ids = await user_ids_for_roles(db, *roles)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to resolve users for notification")
        return
    await notify(db, user_ids, type, title, message, **kwargs)


async def notify_low_stock(db: AsyncSession, medicine) -> None:
    """Alert admins and pharmacists when a medicine is at or below its reorder level."""
    if medicine.stock_quantity is None or medicine.reorder_level is None:
        return
    if medicine.stock_quantity > medicine.reorder_level:
        return
    level = "out of stock" if medicine.stock_quantity <= 0 else f"low on stock ({medicine.stock_quantity} left)"
    await notify_roles(
        db,
        (UserRole.admin, UserRole.pharmacist),
        "inventory",
        f"{medicine.name} is {level}",
        f"{medicine.name} has {medicine.stock_quantity} units; reorder level is {medicine.reorder_level}.",
        reference_type="medicine",
        reference_id=medicine.id,
    )


# ---------- Email delivery (after commit, only when SMTP is configured) ----------

def _send_email_sync(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to
    msg.set_content(body)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


async def _deliver_emails(pending: list[tuple[UUID, str, str, str]]) -> None:
    sent: list[UUID] = []
    for notification_id, to, subject, body in pending:
        try:
            await asyncio.to_thread(_send_email_sync, to, subject, body)
            sent.append(notification_id)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to send notification email to %s", to)
    if not sent:
        return
    try:
        async with async_session() as session:
            await session.execute(update(Notification).where(Notification.id.in_(sent)).values(email_sent=True))
            await session.commit()
    except Exception:  # noqa: BLE001
        logger.exception("Failed to mark notification emails as sent")


@event.listens_for(Session, "after_commit")
def _flush_pending_emails(session: Session) -> None:
    pending = session.info.pop(_PENDING_EMAILS, None)
    if not pending:
        return
    try:
        task = asyncio.get_running_loop().create_task(_deliver_emails(pending))
        _email_tasks.add(task)
        task.add_done_callback(_email_tasks.discard)
    except RuntimeError:
        logger.warning("No running event loop; dropped %d notification emails", len(pending))


@event.listens_for(Session, "after_rollback")
def _drop_pending_emails(session: Session) -> None:
    session.info.pop(_PENDING_EMAILS, None)
