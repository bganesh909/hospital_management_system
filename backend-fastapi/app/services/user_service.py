from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ConflictError
from app.core.security import hash_password
from app.models.doctor import Doctor
from app.models.staff import Staff
from app.models.user import RefreshToken, User, UserRole
from app.repositories.base import BaseRepository
from app.schemas.user import UserAdminUpdate, UserCreate, UserDetailResponse


def _search_filter(search: str):
    term = f"%{search.strip()}%"
    return or_(
        User.email.ilike(term),
        User.first_name.ilike(term),
        User.last_name.ilike(term),
        func.concat(User.first_name, " ", User.last_name).ilike(term),
        User.phone.ilike(term),
    )


async def to_detail(db: AsyncSession, users: list[User]) -> list[UserDetailResponse]:
    """Attach which profile tables (doctor/staff) each user is linked to."""
    if not users:
        return []
    ids = [u.id for u in users]
    doctor_ids = set((await db.execute(select(Doctor.user_id).where(Doctor.user_id.in_(ids)))).scalars())
    staff_ids = set((await db.execute(select(Staff.user_id).where(Staff.user_id.in_(ids)))).scalars())
    result = []
    for u in users:
        linked = []
        if u.id in doctor_ids:
            linked.append("doctor")
        if u.id in staff_ids:
            linked.append("staff")
        result.append(UserDetailResponse.model_validate(u).model_copy(update={"linked_as": linked}))
    return result


async def list_users(
    db: AsyncSession,
    page: int = 1,
    limit: int = 20,
    search: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    repo = BaseRepository(User, db)
    filters = []
    if search and search.strip():
        filters.append(_search_filter(search))
    if role:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active == is_active)
    return await repo.get_all(page=page, limit=limit, filters=filters)


async def list_unlinked_users(
    db: AsyncSession,
    link: str,
    roles: list[UserRole] | None = None,
    search: str | None = None,
    limit: int = 50,
) -> list[User]:
    """Active users without a doctor (link='doctor') or staff (link='staff') record."""
    profile = Doctor if link == "doctor" else Staff
    query = (
        select(User)
        .where(User.is_active == True)  # noqa: E712
        .where(~select(profile.user_id).where(profile.user_id == User.id).exists())
    )
    if roles:
        query = query.where(User.role.in_(roles))
    if search and search.strip():
        query = query.where(_search_filter(search))
    query = query.order_by(User.first_name, User.last_name).limit(limit)
    return list((await db.execute(query)).scalars().all())


async def get_user(db: AsyncSession, user_id: UUID) -> User:
    return await BaseRepository(User, db).get_by_id(user_id)


async def create_user(db: AsyncSession, data: UserCreate) -> User:
    email = data.email.lower()
    existing = await db.execute(select(User).where(func.lower(User.email) == email))
    if existing.scalar_one_or_none():
        raise ConflictError("Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        role=data.role,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        phone=data.phone or None,
        is_active=data.is_active,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


async def _active_admin_count(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).select_from(User).where(User.role == UserRole.admin, User.is_active == True)  # noqa: E712
    )
    return result.scalar() or 0


async def _guard_admin_change(db: AsyncSession, target: User, actor: User, *, deactivating: bool, demoting: bool) -> None:
    if target.id == actor.id and deactivating:
        raise BadRequestError("You cannot deactivate your own account")
    if target.id == actor.id and demoting:
        raise BadRequestError("You cannot remove your own admin role")
    if target.role == UserRole.admin and target.is_active and (deactivating or demoting):
        if await _active_admin_count(db) <= 1:
            raise BadRequestError("At least one active admin is required")


async def _revoke_sessions(db: AsyncSession, user_id: UUID) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)  # noqa: E712
        .values(revoked=True)
    )


async def update_user(db: AsyncSession, user_id: UUID, data: UserAdminUpdate, actor: User) -> User:
    user = await get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True)

    for field in ("first_name", "last_name", "role", "is_active"):
        if field in changes and changes[field] is None:
            changes.pop(field)

    deactivating = changes.get("is_active") is False and user.is_active
    demoting = "role" in changes and changes["role"] != UserRole.admin and user.role == UserRole.admin
    await _guard_admin_change(db, user, actor, deactivating=deactivating, demoting=demoting)

    if "role" in changes and changes["role"] != user.role:
        linked_doctor = (await db.execute(select(Doctor.id).where(Doctor.user_id == user.id))).first()
        if linked_doctor and user.role == UserRole.doctor:
            raise BadRequestError("This user has a doctor profile; remove it before changing the role")

    for key, value in changes.items():
        setattr(user, key, value.strip() if isinstance(value, str) else value)

    # Role or active changes should take effect on next refresh, not linger in old sessions
    if deactivating or "role" in changes:
        await _revoke_sessions(db, user.id)

    await db.flush()
    await db.refresh(user)
    return user


async def set_user_active(db: AsyncSession, user_id: UUID, is_active: bool, actor: User) -> User:
    return await update_user(db, user_id, UserAdminUpdate(is_active=is_active), actor)


async def reset_password(db: AsyncSession, user_id: UUID, new_password: str) -> None:
    user = await get_user(db, user_id)
    user.password_hash = hash_password(new_password)
    await _revoke_sessions(db, user.id)
    await db.flush()
