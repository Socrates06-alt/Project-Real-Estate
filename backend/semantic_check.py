"""Check search-by-meaning on the live listings (run on the server, read-only).

    cd /opt/landfinder/backend && sudo -u landfinder .venv/bin/python semantic_check.py "quiet plot near school"

Prints how close in meaning each live listing is to your search (1.0 = same meaning). Listings scoring at or
above SEMANTIC_MIN_SCORE are shown even when no words match; raise it in .env if unrelated ones appear.
"""

import sys

from app.core.config import get_settings
from app.core.db import connect, many
from app.semantic import engine
from app.semantic.text import listing_text


def main() -> None:
    query = " ".join(sys.argv[1:]) or "quiet plot near school"
    s = get_settings()
    from fastembed import TextEmbedding

    print(f"Loading {s.semantic_model} ...")
    engine.use_model(TextEmbedding(s.semantic_model, cache_dir=engine.cache_dir()))
    conn = connect()
    try:
        rows = many(
            conn,
            """select l.id, l.number, v.snapshot from listings l
               join published_versions v on v.listing_id = l.id and v.version = l.current_version
               where l.state = 'published'""",
        )
        texts = {r["id"]: listing_text(r["snapshot"]) for r in rows}
        q = engine.embed([query], "query")[0]
        vecs = engine.embed(list(texts.values()), "passage")
        scored = sorted(((float(v @ q), r) for v, r in zip(vecs, rows, strict=True)), key=lambda x: x[0], reverse=True)
        print(f'\nSearch: "{query}"   (shown without matching words if >= {s.semantic_min_score})\n')
        for score, r in scored[:15]:
            mark = "*" if score >= s.semantic_min_score else " "
            print(f"{mark} {score:.2f}  #{r['number']}  {texts[r['id']][:90]}")
        print(f"\nSaved embeddings: {conn.execute('select count(*) from embeddings').fetchone()[0]}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
