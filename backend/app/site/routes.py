"""Site-wide: health check and the public settings the app needs (contact, brokerage, limits)."""

from fastapi import APIRouter

from app.core.config import get_settings, public_contact

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/config")
def public_config() -> dict:
    s = get_settings()
    return {
        "contact": public_contact(),
        "brokerage": {
            "seller_pct": s.seller_brokerage_pct,
            "buyer_pct": s.buyer_brokerage_pct,
            "gst_extra": True,
            "listing_fee": 0,
        },
        "consent_version": s.consent_version,
        "rera_number": s.rera_number or None,
        "max_photos": s.max_photos,
        "max_photo_bytes": s.max_photo_bytes,
        "ads": {
            "web": s.ad_price_web,
            "social": s.ad_price_social,
            "days": s.ad_days,
            "upi_id": s.upi_id or None,
            "upi_name": s.upi_name,
        },
    }
