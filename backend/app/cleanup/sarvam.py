"""Sarvam AI (Indian-language AI) client: fixes spelling, translates Malayalam and rewrites listing text in
good English. Used only by the temporary one-time clean-up tool."""

import json
import logging
import re

import httpx

from app.core.config import get_settings

FIELDS = ("title", "location", "description", "documents_note")

SYSTEM = """You clean up property listing text for LandFinder, a property brokerage in Chengannur, Kerala.

For each field you receive:
- Fix spelling mistakes.
- Translate any Malayalam (or Malayalam written in English letters) into English.
- Rewrite it as clear, natural, correct English. Keep it short and factual.

Rules:
- Keep every fact exactly: numbers, sizes (cents, sq ft), prices, distances, rooms, roads, landmarks and place names.
- Do not add facts, opinions or marketing claims, and do not drop any fact.
- Write Kerala place names in their usual English spelling (for example Chengannur, Puliyoor, Mulakuzha).
- For land types that matter legally, keep the Malayalam word in brackets after the English, e.g.
  "paddy land (nilam)", "garden land (purayidam)".
- "location" is a place name only (one or two words), not a sentence.
- If a field is empty, return it empty. If "title" is a generic one like "Land for sale" or "House for sale",
  return it unchanged.

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
    return result
