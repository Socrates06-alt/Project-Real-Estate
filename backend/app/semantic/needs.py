"""Reads a buyer's size and budget from what founders type in the buyer's description, e.g.
"10-20 cents near the main road, budget 25 L", "around 1 acre", "20-25 lakh", "2 lakh per cent"."""

import re
from dataclasses import dataclass

_NUM = r"(\d+(?:\.\d+)?)"
_TO = r"\s*(?:-|–|to)\s*"
_MONEY_UNIT = r"(l|lac|lacs|lakh|lakhs|cr|crore|crores)\b"
_PER_CENT = r"\s*(?:/|per)\s*cent\b"


@dataclass
class Needs:
    min_cents: float | None = None
    max_cents: float | None = None
    max_price: int | None = None  # total budget
    min_price: int | None = None
    max_per_cent: int | None = None  # budget per cent (land)


def _rupees(value: str, unit: str) -> int:
    return int(float(value) * (10_000_000 if unit.startswith("cr") else 100_000))


def read_needs(text: str) -> Needs:
    t = (text or "").lower().replace(",", "")
    n = Needs()

    # Size: "10-20 cents", "10 to 20 cent", "1 acre", "around 15 cents" (about +-25%)
    if m := re.search(_NUM + _TO + _NUM + r"\s*cents?\b", t):
        n.min_cents, n.max_cents = sorted((float(m.group(1)), float(m.group(2))))
    elif m := re.search(_NUM + _TO + _NUM + r"\s*acres?\b", t):
        n.min_cents, n.max_cents = sorted((float(m.group(1)) * 100, float(m.group(2)) * 100))
    elif m := re.search(_NUM + r"\s*(cents?|acres?)\b(?!\s*(?:/|per))", t):
        size = float(m.group(1)) * (100 if m.group(2).startswith("acre") else 1)
        n.min_cents, n.max_cents = size * 0.75, size * 1.25

    # Budget per cent: "2 lakh per cent", "1.5 L/cent"
    if m := re.search(_NUM + r"\s*" + _MONEY_UNIT + _PER_CENT, t):
        n.max_per_cent = _rupees(m.group(1), m.group(2))
        t = t.replace(m.group(0), " ")

    # Total budget: "20-25 lakh", "budget 25 L", "under 1.5 crore"
    if m := re.search(_NUM + _TO + _NUM + r"\s*" + _MONEY_UNIT, t):
        low, high = sorted((float(m.group(1)), float(m.group(2))))
        n.min_price, n.max_price = _rupees(str(low), m.group(3)), _rupees(str(high), m.group(3))
    elif m := re.search(_NUM + r"\s*" + _MONEY_UNIT, t):
        n.max_price = _rupees(m.group(1), m.group(2))
    return n
