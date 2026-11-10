"""What a seller sends when listing a property."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.core.validation import Cents, Location, Name, OptionalPhone, Phone, Price, PropertyType, Short, text


class SubmissionForm(BaseModel):
    # Multipart form: the photo field shares the body, so extra fields are ignored.
    model_config = ConfigDict(extra="ignore")

    seller_name: Name
    seller_phone: Phone
    seller_phone2: OptionalPhone = ""  # another number, optional
    property_type: PropertyType
    land_area_cents: Cents
    location: Location  # area name, shown to buyers
    area_lat: Annotated[float, Field(ge=-90, le=90)] | None = None  # from the place suggestion
    area_lng: Annotated[float, Field(ge=-180, le=180)] | None = None
    address: Annotated[str, text(0, 300)] = ""  # full address: private, optional
    description: Annotated[str, text(0, 4000)] = ""  # optional
    expected_price: Price
    negotiable: bool
    documents_available: bool
    documents_note: Short = ""
    wants_doc_help: bool = False  # paid documentation assistance
    wants_dev_help: bool = False  # paid property development assistance
    consent: bool
    consent_version: str
