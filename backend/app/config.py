from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    admin_password: str = ""  # empty disables admin login
    database_path: str = "nilayam.db"
    media_dir: str = "media"
    cors_origins: list[str] = ["http://localhost:5173"]

    contact_phone: str = "+919999999999"
    contact_whatsapp: str = "+919999999999"
    consent_version: str = "2026-11-v1"
    seller_brokerage_pct: float = 2.0
    buyer_brokerage_pct: float = 1.0
    material_price_change_pct: float = 5.0

    max_photos: int = 3
    max_photo_bytes: int = 8 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
