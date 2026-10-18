"""Automatic audit logging of create/update/delete on ORM models.

A request-scoped context (user, IP, user agent) is held in a contextvar. The
middleware stores a mutable dict there, and get_current_user fills in the user
id, so the value is visible wherever the session flushes during the request.
"""

import logging
import uuid
from contextvars import ContextVar
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from starlette.types import ASGIApp, Receive, Scope, Send

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import RefreshToken

logger = logging.getLogger(__name__)

audit_context: ContextVar[dict | None] = ContextVar("audit_context", default=None)

# Models that are noise or audit infrastructure themselves
_SKIP_MODELS = (AuditLog, RefreshToken, Notification)
_REDACT_KEYS = {"password_hash", "password", "token", "token_hash", "refresh_token", "access_token"}
_SKIP_KEYS = {"created_at", "updated_at"}


def set_audit_user(user_id: uuid.UUID) -> None:
    ctx = audit_context.get()
    if ctx is not None:
        ctx["user_id"] = user_id


class AuditContextMiddleware:
    """Pure ASGI middleware so the contextvar propagates into the endpoint."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        forwarded = headers.get("x-forwarded-for")
        client = scope.get("client")
        ip = forwarded.split(",")[0].strip() if forwarded else (client[0] if client else None)

        token = audit_context.set({
            "user_id": None,
            "ip_address": ip[:45] if ip else None,
            "user_agent": headers.get("user-agent"),
        })
        try:
            await self.app(scope, receive, send)
        finally:
            audit_context.reset(token)


def _json_safe(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (uuid.UUID, Decimal)):
        return str(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    return str(value)


def _clean(key: str, value):
    return "[REDACTED]" if key in _REDACT_KEYS else _json_safe(value)


def _snapshot(obj) -> dict:
    """Column values already loaded on the instance (never triggers a load)."""
    state = inspect(obj)
    loaded = state.dict
    return {
        attr.key: _clean(attr.key, loaded[attr.key])
        for attr in state.mapper.column_attrs
        if attr.key in loaded and attr.key not in _SKIP_KEYS
    }


def _diff(obj) -> tuple[dict, dict]:
    state = inspect(obj)
    old, new = {}, {}
    for attr in state.mapper.column_attrs:
        if attr.key in _SKIP_KEYS:
            continue
        hist = state.attrs[attr.key].history
        if not hist.has_changes():
            continue
        before = hist.deleted[0] if hist.deleted else None
        after = hist.added[0] if hist.added else None
        if before == after:
            continue
        old[attr.key] = _clean(attr.key, before)
        new[attr.key] = _clean(attr.key, after)
    return old, new


def _entity_id(obj):
    pk = inspect(obj).identity
    if pk and len(pk) == 1 and isinstance(pk[0], uuid.UUID):
        return pk[0]
    value = getattr(obj, "id", None) if "id" in inspect(obj).dict else None
    return value if isinstance(value, uuid.UUID) else None


@event.listens_for(Session, "after_flush")
def _write_audit_rows(session: Session, flush_context) -> None:
    # History and the new/dirty/deleted collections are still intact in after_flush
    try:
        ctx = audit_context.get() or {}
        rows = []

        def add(action: str, obj, old: dict | None, new: dict | None):
            rows.append({
                "id": uuid.uuid4(),
                "user_id": ctx.get("user_id"),
                "action": action,
                "entity_type": obj.__tablename__,
                "entity_id": _entity_id(obj),
                "old_values": old,
                "new_values": new,
                "ip_address": ctx.get("ip_address"),
                "user_agent": ctx.get("user_agent"),
            })

        for obj in session.new:
            if not isinstance(obj, _SKIP_MODELS) and hasattr(obj, "__tablename__"):
                add("create", obj, None, _snapshot(obj))
        for obj in session.dirty:
            if isinstance(obj, _SKIP_MODELS) or not hasattr(obj, "__tablename__"):
                continue
            if not session.is_modified(obj, include_collections=False):
                continue
            old, new = _diff(obj)
            if new:
                add("update", obj, old, new)
        for obj in session.deleted:
            if not isinstance(obj, _SKIP_MODELS) and hasattr(obj, "__tablename__"):
                add("delete", obj, _snapshot(obj), None)

        if not rows:
            return

        conn = session.connection()
        # Savepoint so a failed audit insert can't abort the request's transaction
        with conn.begin_nested():
            conn.execute(AuditLog.__table__.insert(), rows)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to write audit log")
