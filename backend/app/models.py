"""Request validation."""

import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, StringConstraints


def normalize_indian_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return "+91" + digits


def text(min_length: int = 0, max_length: int = 500):
    return StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)


Phone = Annotated[str, AfterValidator(normalize_indian_phone)]
Name = Annotated[str, text(2, 80)]
Location = Annotated[str, text(2, 120)]
Description = Annotated[str, text(10, 4000)]
Short = Annotated[str, text(0, 500)]
Cents = Annotated[float, Field(gt=0, le=100_000)]
Price = Annotated[int, Field(gt=0, le=10**11)]
PropertyType = Literal["house", "land"]
VisitStatus = Literal["new", "contacted", "scheduled", "done", "cancelled"]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SubmissionForm(BaseModel):
    # Multipart form: the photo field shares the body, so extra fields are ignored.
    model_config = ConfigDict(extra="ignore")

    seller_name: Name
    seller_phone: Phone
    property_type: PropertyType
    land_area_cents: Cents
    location: Location
    description: Description
    expected_price: Price
    negotiable: bool
    documents_available: bool
    documents_note: Short = ""
    consent: bool
    consent_version: str


class VisitRequestIn(Strict):
    name: Name
    phone: Phone
    preferred_time: Short = ""
    budget: Annotated[str, text(0, 60)] = ""


class LoginIn(Strict):
    password: str


class NoteIn(Strict):
    note: Short = ""


class ListingUpdate(Strict):
    title: Annotated[str, text(5, 120)] | None = None
    property_type: PropertyType | None = None
    land_area_cents: Cents | None = None
    location: Location | None = None
    description: Description | None = None
    price: Price | None = None
    negotiable: bool | None = None
    documents_available: bool | None = None
    documents_note: Short | None = None
    photo_ids: Annotated[list[str], Field(max_length=3)] | None = None


class VisitUpdate(Strict):
    status: VisitStatus | None = None
    admin_notes: Annotated[str, text(0, 2000)] | None = None
