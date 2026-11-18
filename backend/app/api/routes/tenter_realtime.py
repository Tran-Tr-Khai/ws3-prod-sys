import asyncio

from fastapi import APIRouter, HTTPException, Query, WebSocket
from starlette.websockets import WebSocketDisconnect
from websockets import connect as connect_upstream

from app.config.settings import get_settings
from app.db.session import SessionLocal
from app.security.auth import SESSION_COOKIE, get_current_user_for_session
from app.security.authorization import require_machine_access


router = APIRouter(tags=["tenter-realtime"])


@router.websocket("/ws/tenter-data")
async def tenter_data_websocket(
    websocket: WebSocket,
    machine_id: str = Query(default="TE-01", max_length=20),
) -> None:
    """
    Relay authorized Tenter readings from the collector to one browser.

    The collector remains the source of truth. WS3 only relays its stream over
    the same-origin WebSocket after checking the caller's session and machine.

    Args:
        websocket: Browser WebSocket connection.
        machine_id: Tenter machine requested by the browser.
    """
    db = SessionLocal()
    try:
        user = get_current_user_for_session(websocket.cookies.get(SESSION_COOKIE), db)
        require_machine_access(
            user,
            machine_id,
            supported_machines={"TE-01", "TE-02"},
            not_found_detail="Tentering machine was not found",
        )
    except HTTPException:
        await websocket.close(code=4401, reason="Authentication or machine access is required")
        return
    finally:
        db.close()

    await websocket.accept()
    upstream_url = get_settings().tenter_realtime_ws_url.strip()
    if not upstream_url:
        await websocket.send_json({"type": "tenter_unavailable", "message": "Tenter realtime source is not configured."})
        await websocket.close(code=1013, reason="Tenter realtime source is not configured")
        return

    try:
        async with connect_upstream(upstream_url, open_timeout=5, ping_interval=20, ping_timeout=20) as upstream:
            async for message in upstream:
                if isinstance(message, bytes):
                    await websocket.send_bytes(message)
                else:
                    await websocket.send_text(message)
    except WebSocketDisconnect:
        return
    except asyncio.CancelledError:
        raise
    except Exception:
        if websocket.client_state.name != "DISCONNECTED":
            await websocket.close(code=1011, reason="Tenter realtime source unavailable")
