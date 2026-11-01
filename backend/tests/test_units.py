import io

import pytest
from PIL import Image

from app.images import InvalidImage, sanitize_image
from app.schemas import normalize_indian_phone
from app.search import parse_query
from tests.conftest import jpeg_with_gps


def test_parse_query_extracts_filters():
    p = parse_query("House under 40 lakh near Mulakuzha 10 cents")
    assert p.property_type == "house"
    assert p.max_price == 4_000_000
    assert p.min_cents == 10
    assert p.text == "mulakuzha"


def test_parse_query_crore_and_min():
    p = parse_query("land above 1.5 cr below 50 cents in Puliyoor")
    assert p.property_type == "land"
    assert p.min_price == 15_000_000
    assert p.max_cents == 50
    assert p.text == "puliyoor"


def test_sanitize_strips_exif_and_gps():
    out = sanitize_image(jpeg_with_gps())
    with Image.open(io.BytesIO(out)) as img:
        assert img.format == "WEBP"
        assert not img.getexif()
        assert "exif" not in img.info


def test_sanitize_rejects_non_images_and_gif():
    with pytest.raises(InvalidImage):
        sanitize_image(b"<?php echo 'hi'; ?>")
    buf = io.BytesIO()
    Image.new("RGB", (4, 4)).save(buf, "GIF")
    with pytest.raises(InvalidImage):
        sanitize_image(buf.getvalue())


@pytest.mark.parametrize("raw", ["9847012345", "+91 98470 12345", "098470-12345"])
def test_phone_normalization(raw):
    assert normalize_indian_phone(raw) == "+919847012345"


def test_phone_rejects_invalid():
    with pytest.raises(ValueError):
        normalize_indian_phone("12345")
