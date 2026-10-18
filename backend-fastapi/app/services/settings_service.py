from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError
from app.models.settings import HospitalSettings
from app.schemas.settings import HospitalSettingsUpdate

_REQUIRED = {"hospital_name", "currency", "currency_symbol", "tax_rate", "timezone"}


async def get_settings(db: AsyncSession) -> HospitalSettings:
    result = await db.execute(select(HospitalSettings).limit(1))
    hospital = result.scalar_one_or_none()
    if not hospital:
        hospital = HospitalSettings()
        db.add(hospital)
        await db.flush()
        await db.refresh(hospital)
    return hospital


async def update_settings(db: AsyncSession, data: HospitalSettingsUpdate) -> HospitalSettings:
    hospital = await get_settings(db)
    changes = data.model_dump(exclude_unset=True)
    cleared = [k for k in _REQUIRED if k in changes and changes[k] is None]
    if cleared:
        raise BadRequestError(f"{', '.join(sorted(cleared))} cannot be empty")
    for key, value in changes.items():
        if isinstance(value, str):
            value = value.strip() or None
            if value is None and key in _REQUIRED:
                raise BadRequestError(f"{key} cannot be empty")
        if key == "currency" and value:
            value = value.upper()
        setattr(hospital, key, value)
    await db.flush()
    await db.refresh(hospital)
    return hospital
