"""LandFinder API: app setup only. Each feature has its own folder (routes, rules, schemas)."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.admin import routes_auth as admin_auth
from app.admin import routes_properties as admin_properties
from app.core.config import get_settings
from app.core.migrations import init_db
from app.core.security import check_production
from app.listings import routes as listings
from app.site import routes as site
from app.submissions import photos
from app.submissions import routes as submissions
from app.visits import routes as visits


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
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Token"],
    )

    if not settings.production:

        @app.get("/", include_in_schema=False)
        def root() -> RedirectResponse:
            # The web app runs on the frontend (http://localhost:5173); this server is the API.
            return RedirectResponse("/docs")

    for router in (
        site.router,
        listings.router,
        submissions.router,
        visits.router,
        visits.admin_router,
        admin_auth.router,
        admin_properties.router,
    ):
        app.include_router(router)

    # Only published photo copies are public; seller originals stay private.
    public_dir = Path(settings.media_dir) / "public"
    public_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media/public", StaticFiles(directory=public_dir), name="media")
    return app


app = create_app()
