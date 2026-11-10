"""The meaning model: a small free AI model that runs on our own server (no API, no cost per search).

It loads in the background at startup (downloading once, ~0.2 GB, into the data folder), so the site
starts instantly; until it's ready, and if it ever fails, search simply works by words as before.
"""

import logging
import threading
from pathlib import Path

from app.core.config import get_settings

log = logging.getLogger("nilayam")

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

_model = None  # anything with .embed(list[str]) -> iterable of vectors (tests plug in a small fake)
_state = "off"  # off | loading | ready | failed
_lock = threading.Lock()


def cache_dir() -> str:
    s = get_settings()
    return s.semantic_cache_dir or str(Path(s.database_path).resolve().parent / "models")


def start() -> None:
    """Called at startup: load the model in the background, then embed anything not embedded yet."""
    global _state
    if not get_settings().semantic_search or np is None or _model is not None:
        return
    _state = "loading"
    threading.Thread(target=_load, name="semantic-load", daemon=True).start()


def _load() -> None:
    global _model, _state
    s = get_settings()
    try:
        from fastembed import TextEmbedding

        model = TextEmbedding(s.semantic_model, cache_dir=cache_dir())
        list(model.embed(["warm up"]))
        _model, _state = model, "ready"
        log.warning("Semantic search ready (%s).", s.semantic_model)
        from app.semantic import store

        store.backfill()
    except Exception as exc:  # not installed, no internet for the first download, etc.
        _state = "failed"
        log.warning("Semantic search off (%s); search works by words.", exc)


def use_model(model) -> None:
    """Tests: plug in a model (or None to switch off)."""
    global _model, _state
    _model, _state = model, ("ready" if model is not None else "off")


def ready() -> bool:
    return _model is not None and np is not None


def state() -> str:
    return _state


def embed(texts: list[str], kind: str = "passage"):
    """Unit-length vectors for the texts (kind: 'query' for searches, 'passage' for stored text)."""
    if "e5" in get_settings().semantic_model.lower():  # e5 models expect these prefixes
        texts = [f"{kind}: {t}" for t in texts]
    with _lock:
        vecs = np.asarray(list(_model.embed(texts)), dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return vecs / norms
