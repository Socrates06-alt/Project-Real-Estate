"""Sarvam AI (Indian-language AI) client: fixes spelling, translates Malayalam and rewrites listing text in
good English. Used by the Rephrase button on each property and the one-time clean-up tool."""

import json
import logging
import re

import httpx

from app.core.config import get_settings

FIELDS = ("title", "location", "description", "documents_note")

SYSTEM = """You clean up property listing text for LandFinder, a property brokerage in Chengannur, Kerala.
Buyers read it on their phones, many in English as a second language, so write simple, good English.

You receive four fields. For every field: fix spelling mistakes and translate any Malayalam (or Malayalam
written in English letters) into English.

"description":
- Rewrite it as a few short, simple, well-phrased English sentences that read naturally.
- Keep every detail the seller gave: land size, built-up area, rooms, floors, road access and width, water,
  electricity, distances, nearby places and landmarks, and anything else mentioned. Do not drop any detail.
- Remove list numbering and bullets ("1.", "2)", "-", "*") and turn the points into normal sentences.
- Remove phone numbers, names of people and other contact details.
- Do not add anything the seller did not say: no opinions, no marketing words like "beautiful" or "best".

"title": a short, simple English title. If it is a generic one like "Land for sale" or "House for sale",
return it unchanged.

"location": the place name only (one or two words, no sentence), in its usual English spelling, for example
Chengannur, Puliyoor, Mulakuzha, Pandanad.

"documents_note": the documents as a short plain list in English, for example
"Title deed, tax receipt, possession certificate".

In all fields:
- Use normal sentence capitalization: no words or sentences in ALL CAPITALS and no Capital Letter On Every
  Word. Only names (places, institutions) and abbreviations (MC Road, KSRTC) keep capitals.
- Keep numbers that are facts exactly as given (sizes such as 10 cents or 1200 sq ft, distances such as 400 m,
  prices, number of rooms).
- For land types that matter legally, keep the Malayalam word in brackets after the English, e.g.
  "paddy land (nilam)", "garden land (purayidam)".
- If a field is empty, return it empty.

Reply with only a JSON object with exactly these keys: "title", "location", "description", "documents_note"."""


log = logging.getLogger("nilayam")


class CleanupError(Exception):
    pass


def enabled() -> bool:
    return bool(get_settings().sarvam_api_key)


def _parse(content: str) -> dict | None:
    """The JSON object from the reply, ignoring any thinking text or code fences around it. None if missing."""
    if "</think>" in content:
        content = content.rsplit("</think>", 1)[1]  # the answer comes after the model's thinking
    elif "<think>" in content:
        return None  # cut off while still thinking
    decoder, found = json.JSONDecoder(), None
    for start in [m.start() for m in re.finditer(r"\{", content)]:
        try:
            data, _ = decoder.raw_decode(content, start)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and any(k in data for k in FIELDS):
            found = data  # keep the last complete answer in the reply
    return {k: str(found.get(k) or "").strip() for k in FIELDS} if found else None


_PHONE = re.compile(r"(?:\+?91[\s-]*)?(?<!\d)[6-9](?:[\s-]?\d){9}(?!\d)")


def scrub_contacts(text: str) -> str:
    """Remove Indian mobile numbers (they must never be public) and tidy the spacing left behind."""
    text = _PHONE.sub("", text)
    text = re.sub(r"\(\s*\)|\[\s*\]", "", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return re.sub(r"\s+([.,;:])", r"\1", text).strip()


def _ask(payload: dict, headers: dict) -> tuple[str, str]:
    """One call to Sarvam: (reply text, finish reason)."""
    try:
        r = httpx.post(get_settings().sarvam_url, json=payload, headers=headers, timeout=180)
    except httpx.HTTPError as exc:
        raise CleanupError(f"Couldn't reach Sarvam ({exc.__class__.__name__})") from exc
    if r.status_code >= 400:
        raise CleanupError(f"Sarvam returned an error ({r.status_code}): {r.text[:200]}")
    try:
        choice = r.json()["choices"][0]
        return choice["message"].get("content") or "", str(choice.get("finish_reason") or "")
    except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
        raise CleanupError("Unexpected reply from Sarvam") from exc


def clean(fields: dict) -> dict:
    """Ask Sarvam to clean the fields; returns the same keys."""
    s = get_settings()
    if not s.sarvam_api_key:
        raise CleanupError("Set SARVAM_API_KEY on the server first")
    payload = {
        "model": s.sarvam_model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": json.dumps({k: fields.get(k) or "" for k in FIELDS}, ensure_ascii=False)},
        ],
        "temperature": 0.2,
        "max_tokens": s.sarvam_max_tokens,
    }
    headers = {"api-subscription-key": s.sarvam_api_key, "Authorization": f"Bearer {s.sarvam_api_key}"}
    content, finish = _ask(payload, headers)
    result = _parse(content)
    if result is None and finish == "length":  # ran out of room (usually while thinking): once more, with double
        content, finish = _ask({**payload, "max_tokens": s.sarvam_max_tokens * 2}, headers)
        result = _parse(content)
    if result is None:
        log.warning("Sarvam reply had no result (finish=%s, %d chars): %r", finish, len(content), content[:400])
        reason = "it ran out of room" if finish == "length" else f"finish: {finish or 'unknown'}"
        raise CleanupError(f"The AI reply had no result ({reason}, {len(content)} characters)")
    return {k: scrub_contacts(v) for k, v in result.items()}
