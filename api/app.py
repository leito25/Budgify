import importlib
import pkgutil
from collections.abc import AsyncGenerator, Callable, Sequence
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Engine

from api import routes
from api.auth import TokenVerifier
from api.migrations import migrate
from api.sample_data import ensure_sample_data
from api.settings import Settings

DIST_DIR = Path(__file__).resolve().parent.parent / "dist"


def utc_now() -> datetime:
    return datetime.now(UTC)


def include_routes(app: FastAPI) -> None:
    for module_info in pkgutil.iter_modules(routes.__path__):
        module = importlib.import_module(f"{routes.__name__}.{module_info.name}")
        router = getattr(module, "router", None)
        if isinstance(router, APIRouter):
            app.include_router(router)


def create_app(
    settings: Settings,
    verifier: TokenVerifier,
    engine: Engine,
    today: date,
    now: Callable[[], datetime] = utc_now,
    static_dir: Path | None = DIST_DIR,
    extra_routers: Sequence[APIRouter] = (),
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        migrate(engine)
        ensure_sample_data(engine, today, now().isoformat())
        yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.state.verifier = verifier
    app.state.engine = engine
    app.state.now = lambda: now().isoformat()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/config.json")
    def config() -> dict[str, str]:
        return {
            "supabaseUrl": settings.supabase_url,
            "supabasePublishableKey": settings.supabase_publishable_key,
        }

    include_routes(app)
    for router in extra_routers:
        app.include_router(router)
    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="web")
    return app
