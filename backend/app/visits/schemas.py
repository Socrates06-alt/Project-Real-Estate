"""Visit requests from buyers, and the admin's updates to them."""

from typing import Annotated

from app.core.validation import Name, Phone, Short, Source, Strict, VisitStatus, text


class VisitRequestIn(Strict):
    name: Name
    phone: Phone
    preferred_time: Short = ""
    budget: Annotated[str, text(0, 60)] = ""
    came_from: Source = ""


class VisitUpdate(Strict):
    status: VisitStatus | None = None
    admin_notes: Annotated[str, text(0, 2000)] | None = None
