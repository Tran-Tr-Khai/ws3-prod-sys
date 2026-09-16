from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="System health check")
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="ws3-backend",
        timestamp=datetime.now(timezone.utc),
    )
