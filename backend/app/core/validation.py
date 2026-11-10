"""Shared field types for request validation (phone numbers, names, prices...)."""

import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints


def normalize_phone(value: str) -> str:
    """A number with "+" and a country code is kept in that country (e.g. +971...); otherwise it's Indian."""
    digits = re.sub(r"\D", "", value)
    if value.strip().startswith("+") and not digits.startswith("91"):
        if not 8 <= len(digits) <= 15 or digits.startswith("0"):
            raise ValueError("Enter a valid phone number with its country code")
        return "+" + digits
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return "+91" + digits


def text(min_length: int = 0, max_length: int = 500):
    return StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)


Phone = Annotated[str, AfterValidator(normalize_phone)]
# Optional extra number: empty is fine
OptionalPhone = Annotated[str, AfterValidator(lambda v: normalize_phone(v) if v.strip() else "")]
Name = Annotated[str, text(2, 80)]
Location = Annotated[str, text(2, 120)]
Short = Annotated[str, text(0, 500)]
Cents = Annotated[float, Field(gt=0, le=100_000)]
Price = Annotated[int, Field(gt=0, le=10**11)]
PropertyType = Literal["house", "land", "commercial"]
VisitStatus = Literal["new", "contacted", "scheduled", "done", "cancelled"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")
