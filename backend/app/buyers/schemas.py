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
    property_type: PropertyType | None = "land"  # for every buyer in the file (None = other / any)


class BuyerRequestIn(Strict):
    """A buyer asks for a property they didn't find (public form). Size and budget are optional."""

    name: Name
    phones: Annotated[list[Phone], Field(min_length=1, max_length=2)]
    property_type: PropertyType
    area: Annotated[str, text(0, 120)] = ""
    min_cents: Annotated[float, Field(gt=0, le=100_000)] | None = None
    max_cents: Annotated[float, Field(gt=0, le=100_000)] | None = None
    budget_lakh: Annotated[float, Field(gt=0, le=100_000)] | None = None
    note: Annotated[str, text(0, 500)] = ""
