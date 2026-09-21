from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import register_exception_handlers
from app.api.router import api_router
from app.api.routes.scouring import inspection_router as scouring_inspection_router
from app.api.routes.scouring import router as scouring_router
from app.api.routes.buffing import router as buffing_router
from app.config.middleware import configure_cors
from app.config.settings import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.app_debug,
    lifespan=lifespan, 
)

register_exception_handlers(app)
configure_cors(app, settings)
app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(scouring_router, prefix="/api")
app.include_router(scouring_inspection_router, prefix="/api")
app.include_router(buffing_router, prefix="/api")


@app.get("/health", include_in_schema=False)
def health_check() -> dict[str, str]:
    return {"status": "ok"}
