import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from app import db
from app.config import get_settings
from app.routers import admin, public, submissions


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "t": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        entry.update(getattr(record, "extra_fields", {}))
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def setup_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)


log = logging.getLogger("nilayam")


class BodySizeLimit:
    """Reject oversized request bodies, whether or not Content-Length is sent."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        length = dict(scope["headers"]).get(b"content-length")
        if length is not None and (not length.isdigit() or int(length) > self.max_bytes):
            return await JSONResponse({"detail": "Request too large"}, 413)(scope, receive, send)

        received = 0

        async def limited_receive():
            nonlocal received
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.max_bytes:
                raise _TooLarge
            return message

        try:
            await self.app(scope, limited_receive, send)
        except _TooLarge:
            await JSONResponse({"detail": "Request too large"}, 413)(scope, receive, send)


class _TooLarge(Exception):
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.open_pool(get_settings().database_url)
    yield
    db.close_pool()


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging()
    prod = settings.env == "prod"
    app = FastAPI(
        title="Nilayam API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None if prod else "/docs",
        redoc_url=None,
        openapi_url=None if prod else "/openapi.json",
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error", extra={"extra_fields": {"request_id": request_id}})
            response = JSONResponse({"detail": "Internal server error", "request_id": request_id}, 500)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        log.info(
            "request",
            extra={
                "extra_fields": {
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "ms": round((time.perf_counter() - start) * 1000, 1),
                }
            },
        )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Token"],
        max_age=600,
    )
    app.add_middleware(BodySizeLimit, max_bytes=settings.max_request_bytes)

    @app.get("/api/health", tags=["ops"])
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(public.router, prefix="/api")
    app.include_router(submissions.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")

    if settings.storage_backend == "local":  # dev only: serve the *public* bucket
        public_dir = Path(settings.local_media_dir) / settings.public_bucket
        public_dir.mkdir(parents=True, exist_ok=True)
        app.mount(f"/media/{settings.public_bucket}", StaticFiles(directory=public_dir), name="media")

    return app


app = create_app()
