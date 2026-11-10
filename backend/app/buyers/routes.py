"""Buyers list (founders only): people looking to buy, with their phones, area, type and notes."""

import json
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from app.buyers.schemas import BuyerIn
from app.core.config import get_settings
from app.core.db import DB, many, now, one
from app.core.security import require_admin
from app.semantic import matching
from app.semantic import store as semantic
from app.semantic.text import buyer_text, keyword_score, words

router = APIRouter(prefix="/api/admin/buyers", dependencies=[Depends(require_admin)])


def _out(row: dict) -> dict:
    row["phones"] = json.loads(row["phones"])
    row["wants_finance_help"] = bool(row["wants_finance_help"])
    return row


def _values(body: BuyerIn) -> tuple:
    phones = list(dict.fromkeys(body.phones))  # drop repeats, keep order
    return body.name, json.dumps(phones), body.area, body.property_type, body.notes, body.wants_finance_help


@router.get("")
def list_buyers(db: DB, q: str = Query("", max_length=100)) -> list[dict]:
    q = q.strip()
    if not q:
        return [_out(r) for r in many(db, "select * from buyers order by updated_at desc limit 500")]
    digits = re.sub(r"\D", "", q)
    # "finance" or "loan" also finds buyers who need financial assistance
    conditions = [
        "lower(name || ' ' || area || ' ' || notes"
        " || case when wants_finance_help then ' finance loan' else '' end) like ?"
    ]
    args: list = [f"%{q.lower()}%"]
    if len(digits) >= 4:  # part of a phone number, any format
        phone = digits[2:] if len(digits) == 12 and digits.startswith("91") else digits.lstrip("0")
        conditions.append("phones like ?")
        args.append(f"%{phone}%")
    rows = many(db, f"select * from buyers where {' or '.join(conditions)} order by updated_at desc limit 100", *args)
    found = [_out(r) for r in rows]
    if re.search(r"[a-zA-Z]", q):  # also small typos and similar meaning ("plot near road" ~ "land by the main road")
        seen = {r["id"] for r in found}
        s = get_settings()
        everyone = many(db, "select * from buyers order by updated_at desc limit 3000")
        meaning = semantic.scores(db, "buyer", q, [r["id"] for r in everyone])
        query_words = words(q)
        for r in everyone:
            if r["id"] in seen:
                continue
            close_words = keyword_score(query_words, f"{r['name']} {buyer_text(r)}") == 1
            if close_words or (meaning.get(r["id"]) or -1) >= s.semantic_min_score:
                found.append(_out(r))
    return found


@router.get("/{buyer_id}/matches")
def matching_properties(buyer_id: str, db: DB) -> list[dict]:
    """Live properties that may suit this buyer, best first."""
    if one(db, "select 1 from buyers where id = ?", buyer_id) is None:
        raise HTTPException(404, "Buyer not found")
    return matching.properties_for_buyer(db, buyer_id)


@router.post("", status_code=201)
def add_buyer(body: BuyerIn, db: DB) -> dict:
    buyer_id = str(uuid.uuid4())
    db.execute(
        "insert into buyers (id, name, phones, area, property_type, notes, wants_finance_help)"
        " values (?, ?, ?, ?, ?, ?, ?)",
        (buyer_id, *_values(body)),
    )
    semantic.refresh_buyer(db, buyer_id)
    return _out(one(db, "select * from buyers where id = ?", buyer_id))


@router.put("/{buyer_id}")
def update_buyer(buyer_id: str, body: BuyerIn, db: DB) -> dict:
    cur = db.execute(
        "update buyers set name = ?, phones = ?, area = ?, property_type = ?, notes = ?, wants_finance_help = ?,"
        " updated_at = ? where id = ?",
        (*_values(body), now(), buyer_id),
    )
    if cur.rowcount == 0:
        raise HTTPException(404, "Buyer not found")
    semantic.refresh_buyer(db, buyer_id)
    return _out(one(db, "select * from buyers where id = ?", buyer_id))


@router.delete("/{buyer_id}")
def delete_buyer(buyer_id: str, db: DB) -> dict:
    if db.execute("delete from buyers where id = ?", (buyer_id,)).rowcount == 0:
        raise HTTPException(404, "Buyer not found")
    semantic.remove(db, "buyer", buyer_id)
    return {"id": buyer_id, "deleted": True}
