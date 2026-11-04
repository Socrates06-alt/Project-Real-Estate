"""Admin requests: login, notes, and publishing a listing."""

from typing import Annotated

from pydantic import Field, model_validator

from app.core.validation import Cents, Location, Price, PropertyType, Short, Strict, text


class LoginIn(Strict):
    password: str


class NoteIn(Strict):
    note: Short = ""


class PublishIn(Strict):
    """What buyers will see. Seller identity is never part of this."""

    title: Annotated[str, text(5, 120)]
    property_type: PropertyType
    land_area_cents: Cents
    location: Location
    description: Annotated[str, text(0, 4000)] = ""
    price: Price
    negotiable: bool
    documents_available: bool
    documents_note: Short = ""
    photo_ids: Annotated[list[str], Field(max_length=3)]
    seller_confirmed: bool = False  # seller agreed to this price (needed for big price changes)
    lat: Annotated[float, Field(ge=-90, le=90)] | None = None  # area centre; buyers' search uses its grid flag
    lng: Annotated[float, Field(ge=-180, le=180)] | None = None

    @model_validator(mode="after")
    def _both_or_neither(self):
        if (self.lat is None) != (self.lng is None):
            raise ValueError("Location needs both latitude and longitude")
        return self
