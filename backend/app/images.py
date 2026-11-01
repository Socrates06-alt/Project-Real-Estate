"""Photo sanitisation: detect real format, strip all metadata (incl. GPS), resize, re-encode."""

import io
import warnings

from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 50_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
MAX_SIDE = 1600


class InvalidImage(ValueError):
    pass


def sanitize_image(data: bytes) -> bytes:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as img:
                if img.format not in ALLOWED_FORMATS:
                    raise InvalidImage("Only JPEG, PNG or WebP photos are allowed")
                img.load()
                img = ImageOps.exif_transpose(img)
                img = img.convert("RGB")
                img.thumbnail((MAX_SIDE, MAX_SIDE))
                out = io.BytesIO()
                img.save(out, "WEBP", quality=82)  # no exif/info passed => metadata dropped
                return out.getvalue()
    except InvalidImage:
        raise
    except (OSError, SyntaxError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise InvalidImage("Could not read photo") from exc
