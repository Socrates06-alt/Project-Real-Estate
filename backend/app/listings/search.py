"""Rule-based "AI-style" query parsing, e.g. "house under 40 lakh near Mulakuzha 10 cents"."""

import re
from dataclasses import dataclass

_TYPE_WORDS = {
    "commercial": "commercial",
    "shop": "commercial",
    "shops": "commercial",
    "office": "commercial",
    "building": "commercial",
    "godown": "commercial",
    "warehouse": "commercial",
    "house": "house",
    "houses": "house",
    "home": "house",
    "villa": "house",
    "veedu": "house",
    "land": "land",
    "plot": "land",
    "plots": "land",
    "bhoomi": "land",
}
_STOPWORDS = {
    "near",
    "in",
    "at",
    "for",
    "sale",
    "a",
    "an",
    "the",
    "with",
    "around",
    "of",
    "and",
    "rs",
    "price",
    "property",
    "properties",
    "to",
    "buy",
    "area",
    "me",
    "show",
    "i",
    "want",
}
_MAX = r"under|below|less than|upto|up to|within|max|maximum|budget"
_MIN = r"above|over|more than|min|minimum|atleast|at least"
_NUM = r"(\d+(?:\.\d+)?)"

_CENTS_RE = re.compile(rf"(?:\b({_MAX}|{_MIN})\s+)?{_NUM}\s*(cents?|acres?)\b")  # 1 acre = 100 cents
_PRICE_RE = re.compile(rf"\b({_MAX}|{_MIN})\s+(?:rs\.?\s*|₹\s*)?{_NUM}\s*(lakhs?|lacs?|l|crores?|cr|k)?\b")
_UNIT = {"l": 100_000, "lakh": 100_000, "lac": 100_000, "cr": 10_000_000, "crore": 10_000_000, "k": 1_000}


@dataclass
class ParsedQuery:
    text: str = ""
    property_type: str | None = None
    min_price: int | None = None
    max_price: int | None = None
    min_cents: float | None = None
    max_cents: float | None = None


def _to_rupees(num: str, unit: str | None) -> int:
    value = float(num)
    if unit:
        return int(value * _UNIT[unit.rstrip("s")])
    # Bare small numbers in Kerala property talk mean lakhs.
    return int(value * 100_000) if value < 1000 else int(value)


def parse_query(q: str) -> ParsedQuery:
    out = ParsedQuery()
    s = q.lower().replace(",", " ")

    def take_cents(m: re.Match) -> str:
        op, val = m.group(1), float(m.group(2)) * (100 if m.group(3).startswith("acre") else 1)
        if op and re.fullmatch(_MAX, op):
            out.max_cents = val
        else:
            out.min_cents = val
        return " "

    def take_price(m: re.Match) -> str:
        rupees = _to_rupees(m.group(2), m.group(3))
        if re.fullmatch(_MAX, m.group(1)):
            out.max_price = rupees
        else:
            out.min_price = rupees
        return " "

    s = _CENTS_RE.sub(take_cents, s)
    s = _PRICE_RE.sub(take_price, s)

    words = []
    for w in re.findall(r"[a-z0-9]+", s):
        if w in _TYPE_WORDS:
            out.property_type = out.property_type or _TYPE_WORDS[w]
        elif w not in _STOPWORDS and not w.isdigit():
            words.append(w)
    out.text = " ".join(words)
    return out
