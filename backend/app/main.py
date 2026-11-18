from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import register_exception_handlers
from app.api.router import api_router
from app.api.routes.buffing import router as buffing_router
from app.api.routes.support import router as support_router
from app.api.routes.auth import router as auth_router
from app.api.routes.tenter_realtime import router as tenter_realtime_router
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
# The website exposes one stable HTTP API prefix. Keep all machine routes under
# `/api` so operators and developers do not need to reason about parallel APIs.
app.include_router(api_router, prefix=settings.api_prefix)
app.include_router(buffing_router, prefix="/api")
app.include_router(support_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(tenter_realtime_router)


@app.get("/health", include_in_schema=False)
def health_check() -> dict[str, str]:
    return {"status": "ok"}
