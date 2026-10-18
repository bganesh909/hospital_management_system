"""Create (or reset) an admin account without hardcoding credentials.

Usage, from backend-fastapi/:
    python -m app.scripts.create_admin                 # prompts for email / password
    ADMIN_EMAIL=... ADMIN_PASSWORD=... python -m app.scripts.create_admin
    python -m app.scripts.create_admin --reset         # reset password if the email exists
"""
import argparse
import asyncio
import getpass
import os
import sys

from sqlalchemy import func, select

from app.core.database import async_session, engine
from app.core.security import hash_password
from app.models.user import User, UserRole


async def main(reset: bool) -> int:
    email = (os.environ.get("ADMIN_EMAIL") or input("Admin email: ")).strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password (min 8 chars): ")
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 1
    first_name = os.environ.get("ADMIN_FIRST_NAME", "System")
    last_name = os.environ.get("ADMIN_LAST_NAME", "Admin")

    async with async_session() as db:
        existing = (
            await db.execute(select(User).where(func.lower(User.email) == email))
        ).scalar_one_or_none()
        if existing:
            if not reset:
                print(f"{email} already exists. Re-run with --reset to set a new password.", file=sys.stderr)
                return 1
            existing.password_hash = hash_password(password)
            existing.role = UserRole.admin
            existing.is_active = True
            action = "Reset"
        else:
            db.add(User(
                email=email,
                password_hash=hash_password(password),
                role=UserRole.admin,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
            ))
            action = "Created"
        await db.commit()
    await engine.dispose()
    print(f"{action} admin account: {email}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="reset the password of an existing account")
    sys.exit(asyncio.run(main(parser.parse_args().reset)))
