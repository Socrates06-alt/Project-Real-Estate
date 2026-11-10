"""Read a buyers spreadsheet (CSV) into buyer rows.

Everyone is a land buyer; unclear phone numbers go into the notes to check.
"""

import csv
import io

from app.core.validation import normalize_phone


def _col(row: dict, *names: str) -> str:
    for key, value in row.items():
        if key and key.strip().lower() in names:
            return (value or "").strip()
    return ""


def read_csv(text: str) -> tuple[list[dict], list[str]]:
    rows, problems = [], []
    for i, row in enumerate(csv.DictReader(io.StringIO(text.lstrip("\ufeff"))), start=2):
        name = _col(row, "name")
        notes = [_col(row, "needs (notes)", "needs", "notes")]
        phones = []
        for raw in (_col(row, "phone"), _col(row, "other phone")):
            if not raw:
                continue
            try:
                phones.append(normalize_phone(raw.replace("?", "")))
            except ValueError:
                notes.append(f"Phone to check: {raw}")
        if not phones:
            notes.append("Phone missing")
        no = _col(row, "no")
        if len(name.strip(" ?()")) < 2:
            name = f"Unknown{f' (#{no})' if no else ''} {name}".strip()
        if not name and not phones:
            problems.append(f"Row {i}: empty, skipped")
            continue
        rows.append(
            {
                "name": name[:80],
                "phones": list(dict.fromkeys(phones)),
                "area": _col(row, "area")[:120],
                "property_type": "land",  # the imported lists are land buyers
                "notes": " · ".join(n for n in notes if n)[:2000],
            }
        )
    return rows, problems
