"""What gets embedded for each kind of record, and word matching that tolerates small typos."""

import re
from difflib import SequenceMatcher

TYPE_WORDS = {"house": "house home veedu", "land": "land plot purayidam", "commercial": "commercial shop building"}
_AUTO_TITLE = re.compile(r"^(house|land|commercial|commercial property)\s+for\s+sale\.?$", re.I)


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", (text or "").lower())


def _close(a: str, b: str) -> bool:
    """Same word, allowing a small spelling difference in longer words (Puliyur ~ Puliyoor)."""
    return a == b or (len(a) >= 4 and len(b) >= 4 and SequenceMatcher(None, a, b).ratio() >= 0.8)


def keyword_score(query_words: list[str], text: str) -> float:
    """Share of the query's words found in the text (as part of a word, or a close spelling of one)."""
    if not query_words:
        return 0.0
    low = (text or "").lower()
    tokens = words(low)
    hits = sum(1 for w in query_words if w in low or any(_close(w, t) for t in tokens))
    return hits / len(query_words)


def area_match(wanted_area: str, location: str) -> bool:
    """Does a buyer's wanted area mention this place (allowing small spelling differences)?"""
    place = words(location)
    return any(_close(w, t) for w in words(wanted_area) if len(w) >= 3 for t in place)


def _join(*parts) -> str:
    return ". ".join(str(p).strip() for p in parts if p and str(p).strip())


def listing_text(snap: dict) -> str:
    """Public text only: what buyers can see."""
    title = "" if _AUTO_TITLE.match(snap.get("title") or "") else snap.get("title")
    return _join(
        TYPE_WORDS.get(snap.get("property_type"), ""),
        title,
        snap.get("location"),
        f"{snap.get('land_area_cents')} cents" if snap.get("land_area_cents") else "",
        snap.get("description"),
        snap.get("documents_note"),
    )


def property_text(sub: dict, listing: dict | None) -> str:
    """Admin search: the seller's details plus the listing's text (founders only)."""
    src = listing or sub
    return _join(
        TYPE_WORDS.get(src.get("property_type"), ""),
        listing.get("title") if listing and not _AUTO_TITLE.match(listing.get("title") or "") else "",
        src.get("location"),
        f"{src.get('land_area_cents')} cents",
        listing.get("description") if listing else "",
        sub.get("description"),
        sub.get("address"),
        src.get("documents_note"),
    )


def buyer_text(b: dict) -> str:
    return _join(
        TYPE_WORDS.get(b.get("property_type"), ""),
        b.get("area"),
        b.get("notes"),
        "needs a home loan, finance" if b.get("wants_finance_help") else "",
    )
