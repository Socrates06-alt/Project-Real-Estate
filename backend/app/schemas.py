import re
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated
from uuid import UUID

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


Phone = Annotated[str, AfterValidator(normalize_indian_phone)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
Location = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=4000)]
Cents = Annotated[Decimal, Field(gt=0, le=100_000, max_digits=10, decimal_places=2)]
Price = Annotated[int, Field(gt=0, le=10**11)]


class PropertyType(StrEnum):
    house = "house"
    land = "land"


class VisitStatus(StrEnum):
    new = "new"
    contacted = "contacted"
    scheduled = "scheduled"
    done = "done"
    cancelled = "cancelled"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- Seller ---------------------------------------------------------------


class SubmissionForm(BaseModel):
    # Multipart form: file fields share the body, so extras are ignored (not stored).
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
    documents_note: ShortText = ""
    consent: bool
    consent_version: str
    turnstile_token: str | None = None


class SubmissionCreated(BaseModel):
    id: UUID
    ref_code: str
    status: str


class MySubmission(BaseModel):
    id: UUID
    ref_code: str
    property_type: PropertyType
    location: str
    expected_price: int
    status: str
    created_at: datetime
    listing_id: UUID | None = None


# --- Buyer ----------------------------------------------------------------


class VisitRequestIn(Strict):
    name: Name
    phone: Phone
    preferred_time: ShortText = ""
    budget: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    message: ShortText = ""
    turnstile_token: str | None = None


class VisitRequestCreated(BaseModel):
    id: UUID
    status: str


# --- Admin ----------------------------------------------------------------


class NoteIn(Strict):
    note: ShortText = ""


class ListingUpdate(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=5, max_length=120)] | None = None
    property_type: PropertyType | None = None
    land_area_cents: Cents | None = None
    location: Location | None = None
    description: Description | None = None
    price: Price | None = None
    negotiable: bool | None = None
    documents_available: bool | None = None
    documents_note: ShortText | None = None
    photo_ids: Annotated[list[UUID], Field(max_length=3)] | None = None


class VisitUpdate(Strict):
    status: VisitStatus | None = None
    admin_notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
