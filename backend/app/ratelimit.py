"""Small in-process sliding-window limiter (single VPS process). Cloudflare rules sit in front."""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from app.security import client_ip


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, limit: int, window: float) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) > 50_000:
                self._prune(now, window)
            q = self._hits[key]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                raise HTTPException(429, "Too many requests, please try again later")
            q.append(now)

    def _prune(self, now: float, window: float) -> None:
        for key in [k for k, q in self._hits.items() if not q or q[-1] <= now - window]:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def rate_limit(name: str, limit: int, window_seconds: float):
    def dependency(request: Request) -> None:
        limiter.hit(f"{name}:{client_ip(request)}", limit, window_seconds)

    return dependency
