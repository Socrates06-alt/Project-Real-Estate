import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app import admin, photos, public
from app.config import get_settings
from app.db import init_db

WEAK = {"change-me", "demo123", "secret", "password", "admin"}


def check_production(settings) -> None:
    """On the live server, refuse to start with weak admin passwords or the placeholder phone number."""
    if not settings.production:
        return
    problems = []
    for name in ("admin_password", "admin_password_2"):
        pw = getattr(settings, name)
        if name == "admin_password" or pw:
            if len(pw) < 12 or pw.lower() in WEAK:
                problems.append(f"{name.upper()} must be at least 12 characters and not a sample password")
    for name in ("contact_phone", "contact_whatsapp"):
        number = getattr(settings, name).replace(" ", "")
        if not re.fullmatch(r"\+\d{11,14}", number) or "9999999999" in number:
            problems.append(f"Set {name.upper()} to your real number with country code, e.g. +919847012345")
    if problems:
        raise RuntimeError("Production settings not ready:\n - " + "\n - ".join(problems))


@asynccontextmanager
async def lifespan(_: FastAPI):
    check_production(get_settings())
    init_db()
    photos.ensure_small_copies()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    # The API docs page is handy on a laptop but not needed (or wanted) on the live site.
    docs = None if settings.production else "/docs"
    app = FastAPI(
        title="LandFinder API",
        lifespan=lifespan,
        docs_url=docs,
        redoc_url=None,
        openapi_url=None if settings.production else "/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Token"],
    )

    if not settings.production:

        @app.get("/", include_in_schema=False)
        def root() -> RedirectResponse:
            # The web app runs on the frontend (http://localhost:5173); this server is the API.
            return RedirectResponse("/docs")

    app.include_router(public.router)
    app.include_router(admin.router)

    # Only published photo copies are public; seller originals stay private.
    public_dir = Path(settings.media_dir) / "public"
    public_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media/public", StaticFiles(directory=public_dir), name="media")
    return app


app = create_app()
