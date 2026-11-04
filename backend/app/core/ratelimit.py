"""Tiny in-process sliding-window limiter (one server process in the prototype)."""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


class RateLimiter:
    def __init__(
        self, limit: int, window_seconds: float, message: str = "Too many searches. Please wait a little and try again."
    ) -> None:
        self.limit, self.window, self.message = limit, window_seconds, message
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise HTTPException(429, self.message)
            q.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
