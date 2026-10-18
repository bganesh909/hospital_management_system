from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    get_refresh_token_expiry,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.user import RefreshToken, User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse, UserUpdateRequest


async def login(db: AsyncSession, data: LoginRequest) -> TokenResponse:
    result = await db.execute(select(User).where(func.lower(User.email) == data.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")

    access_token = create_access_token({"sub": str(user.id), "role": user.role.value, "email": user.email})
    refresh_token = create_refresh_token()

    db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_token),
        expires_at=get_refresh_token_expiry(),
    )
    db.add(db_refresh)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


async def register(db: AsyncSession, data: RegisterRequest) -> UserResponse:
    from app.schemas.user import UserCreate
    from app.services import user_service

    user = await user_service.create_user(db, UserCreate(**data.model_dump()))
    return UserResponse.model_validate(user)


async def update_me(db: AsyncSession, user: User, data: UserUpdateRequest) -> User:
    changes = data.model_dump(exclude_unset=True)
    for field in ("first_name", "last_name"):
        if field in changes and not (changes[field] or "").strip():
            raise BadRequestError(f"{field.replace('_', ' ').capitalize()} cannot be empty")
    for key, value in changes.items():
        setattr(user, key, value.strip() if isinstance(value, str) else value)
    await db.flush()
    await db.refresh(user)
    return user


async def refresh_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    db_token = result.scalar_one_or_none()

    if not db_token:
        raise UnauthorizedError("Invalid or expired refresh token")

    # Revoke old token (rotation)
    db_token.revoked = True

    # Get user
    user_result = await db.execute(select(User).where(User.id == db_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    # Issue new tokens
    access_token = create_access_token({"sub": str(user.id), "role": user.role.value, "email": user.email})
    new_refresh_token = create_refresh_token()

    new_db_refresh = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(new_refresh_token),
        expires_at=get_refresh_token_expiry(),
    )
    db.add(new_db_refresh)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


async def logout(db: AsyncSession, refresh_token: str) -> None:
    token_hash = hash_token(refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        db_token.revoked = True
        await db.flush()


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise BadRequestError("Current password is incorrect")
    if current_password == new_password:
        raise BadRequestError("New password must be different from the current password")

    user.password_hash = hash_password(new_password)
    await db.flush()
