"""FastAPI application factory."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path
import subprocess
import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse
from lighting_control.config import settings
from lighting_control.auth.router import router as auth_router
from lighting_control.devices.router import router as devices_router, rooms_router, zones_router, groups_router
from lighting_control.scenes.router import router as scenes_router
from lighting_control.quick_actions.router import router as qa_router
from lighting_control.schedules.router import router as schedules_router, settings_router
from lighting_control.notifications.router import router as notifications_router
from lighting_control.websocket.router import router as ws_router

logger = logging.getLogger(__name__)


def _load_info() -> dict:
    info_path = Path(__file__).parent.parent.parent / "info.yml"
    if info_path.exists():
        with open(info_path) as f:
            return yaml.safe_load(f)
    return {"name": "Lighting Control Dashboard", "version": "dev"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings.data_dir_path
    try:
        alembic_ini = str(Path(__file__).parent.parent.parent / "alembic.ini")
        result = subprocess.run(["uv", "run", "alembic", "-c", alembic_ini, "upgrade", "head"], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            logger.info("Database migrations applied")
        else:
            logger.warning(f"Alembic migration failed: {result.stderr}")
    except Exception as e:
        logger.warning(f"Alembic migration skipped: {e}")
    logger.info("Lighting Control Dashboard starting up")
    yield
    logger.info("Lighting Control Dashboard shutting down")


def create_app() -> FastAPI:
    info = _load_info()
    application = FastAPI(title=info.get("name", "Lighting Control Dashboard"), version=info.get("version", "dev"), lifespan=lifespan)
    application.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    for r in [auth_router, devices_router, rooms_router, zones_router, groups_router, scenes_router, qa_router, schedules_router, settings_router, notifications_router]:
        application.include_router(r, prefix="/api")
    application.include_router(ws_router)
    @application.get("/api/health")
    async def health():
        return {"status": "ok", "version": info.get("version", "dev")}
    _mount_frontend(application)
    return application


def _mount_frontend(application: FastAPI):
    static_dir = Path(__file__).parent.parent.parent / "static"
    if not static_dir.exists():
        static_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
    if static_dir.exists():
        application.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")
        @application.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            file_path = static_dir / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(static_dir / "index.html")


app = create_app()
