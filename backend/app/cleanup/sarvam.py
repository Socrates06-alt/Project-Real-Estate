"""Sarvam AI (Indian-language AI) client: fixes spelling, translates Malayalam and rewrites listing text in
good English. Used only by the temporary one-time clean-up tool."""

import json
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


class CleanupError(Exception):
    pass


def enabled() -> bool:
    return bool(get_settings().sarvam_api_key)


def _parse(content: str) -> dict:
    """The JSON object from the reply (ignores any reasoning text or code fences around it)."""
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.S)
    match = re.search(r"\{.*\}", content, flags=re.S)
    if not match:
        raise CleanupError("The AI reply had no result")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise CleanupError("The AI reply couldn't be read") from exc
    return {k: str(data.get(k) or "").strip() for k in FIELDS}


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
        "max_tokens": 2000,
    }
    headers = {"api-subscription-key": s.sarvam_api_key, "Authorization": f"Bearer {s.sarvam_api_key}"}
    try:
        r = httpx.post(s.sarvam_url, json=payload, headers=headers, timeout=90)
    except httpx.HTTPError as exc:
        raise CleanupError(f"Couldn't reach Sarvam ({exc.__class__.__name__})") from exc
    if r.status_code >= 400:
        raise CleanupError(f"Sarvam returned an error ({r.status_code}): {r.text[:200]}")
    try:
        content = r.json()["choices"][0]["message"]["content"] or ""
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise CleanupError("Unexpected reply from Sarvam") from exc
    return _parse(content)
