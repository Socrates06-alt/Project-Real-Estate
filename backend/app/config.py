from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/nilayam"

    # Supabase (auth + storage)
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""  # legacy HS256 secret; asymmetric keys use JWKS

    storage_backend: str = "local"  # "local" | "supabase"
    local_media_dir: str = "./media"
    private_bucket: str = "submissions"
    public_bucket: str = "listings"

    cors_origins: list[str] = ["http://localhost:5173"]
    trust_proxy_headers: bool = False  # true behind Cloudflare/Nginx
    turnstile_secret: str = ""  # empty disables Turnstile checks
    ip_hash_salt: str = "change-me"

    # Business
    contact_phone: str = "+910000000000"
    contact_whatsapp: str = "+910000000000"
    consent_version: str = "2026-11-v1"
    seller_brokerage_pct: float = 2.0
    buyer_brokerage_pct: float = 1.0
    material_price_change_pct: float = 5.0

    # Limits
    max_photos: int = 3
    max_photo_bytes: int = 8 * 1024 * 1024
    max_request_bytes: int = 26 * 1024 * 1024
    rejected_photo_retention_days: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
