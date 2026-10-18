from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base


async def generate_sequential_number(
    db: AsyncSession, model: type[Base], prefix: str, field_name: str = "patient_number"
) -> str:
    """Generate a sequential number like PAT-00001 by counting existing records."""
    column = getattr(model, field_name, None)
    if column is None:
        # Fallback: count all records
        result = await db.execute(select(func.count()).select_from(model))
    else:
        result = await db.execute(select(func.count()).select_from(model))
    count = result.scalar() or 0
    next_number = count + 1
    return f"{prefix}-{next_number:05d}"
