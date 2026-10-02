from fastapi import APIRouter

from app.api.routes.health import router as health_router
from app.api.routes.simulator import router as simulator_router
from app.api.routes.ws3_orders import router as ws3_orders_router
from app.api.routes.ws3_snapshot import router as ws3_snapshot_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(simulator_router)
api_router.include_router(ws3_orders_router)
api_router.include_router(ws3_snapshot_router)
