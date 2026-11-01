from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import admin, public
from app.config import get_settings
from app.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Nilayam API (prototype)", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Token"],
    )
    app.include_router(public.router)
    app.include_router(admin.router)

    # Only published photo copies are public; seller originals stay private.
    public_dir = Path(settings.media_dir) / "public"
    public_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media/public", StaticFiles(directory=public_dir), name="media")
    return app


app = create_app()
