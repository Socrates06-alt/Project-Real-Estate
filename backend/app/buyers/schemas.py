"""A buyer the founders are helping (entered by founders)."""

from typing import Annotated

from pydantic import Field

from app.core.validation import Name, Phone, PropertyType, Strict, text


class BuyerIn(Strict):
    name: Name
    phones: Annotated[list[Phone], Field(max_length=5)]  # may be empty until a number is known
    area: Annotated[str, text(0, 120)] = ""
    property_type: PropertyType | None = None
    notes: Annotated[str, text(0, 2000)] = ""
    wants_finance_help: bool = False


class BuyersImport(Strict):
    csv: Annotated[str, text(1, 500_000)]
