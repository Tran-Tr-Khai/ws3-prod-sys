from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = Field(default="WS3 Backend API", validation_alias="APP_NAME")
    app_env: str = Field(default="development", validation_alias="APP_ENV")
    app_debug: bool = Field(default=False, validation_alias="APP_DEBUG")
    api_prefix: str = Field(default="/api", validation_alias="API_PREFIX")
    backend_cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173",
        validation_alias="BACKEND_CORS_ORIGINS",
    )
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=8000, validation_alias="PORT")
    auth_secret_key: str = Field(default="change-me-before-production", validation_alias="AUTH_SECRET_KEY")
    auth_session_ttl_hours: int = Field(default=8, validation_alias="AUTH_SESSION_TTL_HOURS")
    auth_cookie_secure: bool = Field(default=False, validation_alias="AUTH_COOKIE_SECURE")
    media_root: str = Field(default="media", validation_alias="MEDIA_ROOT")
    tenter_realtime_ws_url: str = Field(default="", validation_alias="TENTER_REALTIME_WS_URL")

    database_url: str = Field(
        default="postgresql+psycopg://ws3:ws3_password@localhost:5432/ws3",
        validation_alias="DATABASE_URL",
    )

    @field_validator("api_prefix", mode="before")
    @classmethod
    def normalize_api_prefix(cls, value: object) -> str:
        """Keep an empty environment value from disabling the stable API prefix."""
        if value is None or not str(value).strip():
            return "/api"
        prefix = str(value).strip()
        return prefix if prefix.startswith("/") else f"/{prefix}"
    
    model_config = SettingsConfigDict(
        # Resolve the local file from the backend package, not the process cwd.
        # Container environment variables still take precedence over this file.
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def media_path(self) -> Path:
        """Return the absolute directory used for uploaded media files."""
        path = Path(self.media_root)
        return path if path.is_absolute() else BACKEND_DIR / path


@lru_cache
def get_settings() -> Settings:
    return Settings()
