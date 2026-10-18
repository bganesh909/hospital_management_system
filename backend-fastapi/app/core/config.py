from pydantic import Field, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All values come from environment variables or backend-fastapi/.env.

    Secrets and connection details have no defaults: the app refuses to start
    without them instead of silently falling back to hardcoded credentials.
    """

    APP_NAME: str = "Hospital Management System API"
    DEBUG: bool = False

    # Database (required)
    DATABASE_URL: str = Field(..., description="postgresql+asyncpg://user:pass@host:port/db")
    DATABASE_URL_SYNC: str | None = Field(None, description="Defaults to DATABASE_URL with the plain postgresql driver")
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # JWT (secret required)
    JWT_SECRET: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Server
    PORT: int = 8000
    CORS_ORIGINS: list[str] = []

    # Email (optional: email is skipped when SMTP_HOST is empty)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Hospital HMS"
    SMTP_FROM_EMAIL: str = ""

    # Redis (optional, not used yet)
    REDIS_URL: str | None = None

    model_config = {"env_file": ".env", "extra": "ignore"}

    @model_validator(mode="after")
    def _derive_and_check(self) -> "Settings":
        if not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must use the postgresql+asyncpg:// driver")
        if not self.DATABASE_URL_SYNC:
            self.DATABASE_URL_SYNC = self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
        if self.JWT_SECRET.startswith("change-this"):
            raise ValueError("JWT_SECRET is still the placeholder; generate one with: openssl rand -hex 32")
        return self


settings = Settings()
