"""Photos: verify real image type, strip metadata (incl. GPS), resize, save as WebP.

Originals live in media/originals (private, served only to admin).
Published copies live in media/public (served at /media/public).
"""

import io
import shutil
import warnings
from pathlib import Path

from PIL import Image, ImageOps

from app.config import get_settings

Image.MAX_IMAGE_PIXELS = 50_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_SIDE = 1600


class InvalidImage(ValueError):
    pass


def sanitize(data: bytes) -> bytes:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as img:
                if img.format not in ALLOWED_FORMATS:
                    raise InvalidImage("Only JPEG, PNG or WebP photos are allowed")
                img = ImageOps.exif_transpose(img).convert("RGB")
                img.thumbnail((MAX_SIDE, MAX_SIDE))
                out = io.BytesIO()
                img.save(out, "WEBP", quality=82)  # no exif passed => metadata dropped
                return out.getvalue()
    except InvalidImage:
        raise
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise InvalidImage("Could not read photo") from exc


def media_root() -> Path:
    return Path(get_settings().media_dir).resolve()


def save_original(submission_id: str, photo_id: str, data: bytes) -> str:
    rel = f"originals/{submission_id}/{photo_id}.webp"
    path = media_root() / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel


def read(rel: str) -> bytes:
    return (media_root() / rel).read_bytes()


CARD_SIDE = 640  # light copy for property cards (cheap phones, patchy 4G)


def publish_copy(original_rel: str, listing_id: str, photo_id: str) -> str:
    """Copy an original into the public folder (idempotent), plus a card-size copy; return the full URL."""
    rel = f"public/{listing_id}/{photo_id}.webp"
    dest = media_root() / rel
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(media_root() / original_rel, dest)
    make_small_copy(dest)
    return f"/media/{rel}"


def make_small_copy(full: Path) -> None:
    """abc.webp -> abc-sm.webp (640 px). Skips if it already exists."""
    small = full.with_name(f"{full.stem}-sm.webp")
    if small.exists():
        return
    with Image.open(full) as img:
        img.thumbnail((CARD_SIDE, CARD_SIDE))
        img.save(small, "WEBP", quality=78)


def ensure_small_copies() -> None:
    """Create card-size copies for photos published before this existed."""
    public = media_root() / "public"
    if not public.exists():
        return
    for full in public.rglob("*.webp"):
        if not full.stem.endswith("-sm"):
            try:
                make_small_copy(full)
            except OSError:
                pass


def delete_files(rels: list[str]) -> None:
    for rel in rels:
        (media_root() / rel).unlink(missing_ok=True)
