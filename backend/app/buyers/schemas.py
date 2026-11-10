"""A buyer the founders are helping (entered by founders)."""

from typing import Annotated

from pydantic import Field

from app.core.validation import Name, Phone, PropertyType, Strict, text


class BuyerIn(Strict):
    name: Name
    phones: Annotated[list[Phone], Field(min_length=1, max_length=5)]
    area: Annotated[str, text(0, 120)] = ""
    property_type: PropertyType | None = None
    notes: Annotated[str, text(0, 2000)] = ""
    wants_finance_help: bool = False
