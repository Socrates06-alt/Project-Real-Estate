from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    admin_password: str = ""  # empty disables admin login
    admin_password_2: str = ""  # optional second founder's own password
    production: bool = False  # live server: strong passwords required, API docs hidden
    database_path: str = "nilayam.db"
    media_dir: str = "media"
    cors_origins: list[str] = ["http://localhost:5173"]

    contact_phone: str = "+919999999999"
    contact_whatsapp: str = "+919999999999"
    consent_version: str = "2026-11-v1"
    rera_number: str = ""  # Kerala RERA agent registration; shown on listings once set
    seller_brokerage_pct: float = 2.0
    buyer_brokerage_pct: float = 1.0
    material_price_change_pct: float = 5.0

    # Search by meaning: a small free model on our own server. Off -> search by words only, as before.
    semantic_search: bool = True
    semantic_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    semantic_cache_dir: str = ""  # default: a "models" folder next to the database
    semantic_min_score: float = 0.45  # how close in meaning a result must be when no words match
    semantic_strong_score: float = 0.6  # ...and when other results already match the words
    match_min_score: float = 0.45  # buyer <-> property matching

    # TEMPORARY one-time English clean-up of listings (Sarvam AI). Empty key = tool switched off.
    sarvam_api_key: str = ""
    sarvam_model: str = "sarvam-105b"
    sarvam_url: str = "https://api.sarvam.ai/v1/chat/completions"
    sarvam_max_tokens: int = 8000  # room for the model's thinking plus the answer

    first_property_number: int = 1001
    max_photos: int = 3
    max_photo_bytes: int = 8 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


def public_contact() -> dict:
    """LandFinder's own phone/WhatsApp, shown to buyers instead of the seller's."""
    s = get_settings()
    return {"phone": s.contact_phone, "whatsapp": s.contact_whatsapp}
