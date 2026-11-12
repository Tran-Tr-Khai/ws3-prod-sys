"""Persistent main-thread MVS worker for the local WS3 Camera Agent."""

from __future__ import annotations

import base64
import json
import sys
from typing import Any

from .app import CameraAgentError, CameraBusyError, CameraNotFoundError, MvsCameraService


def response_for_error(error: CameraAgentError) -> dict[str, Any]:
    error_type = "camera_error"
    if isinstance(error, CameraNotFoundError):
        error_type = "not_found"
    elif isinstance(error, CameraBusyError):
        error_type = "busy"
    return {"ok": False, "error_type": error_type, "error": str(error)}


def serve() -> int:
    service = MvsCameraService()
    for raw_request in sys.stdin:
        try:
            request = json.loads(raw_request)
            if not isinstance(request, dict):
                raise CameraAgentError("Yêu cầu camera không hợp lệ.")
            action = request.get("action")
            if action == "list":
                response: dict[str, Any] = {"ok": True, "cameras": [camera.as_response() for camera in service.list_cameras()]}
            elif action == "capture" and isinstance(request.get("camera_id"), str):
                jpeg = service.capture_jpeg(request["camera_id"])
                response = {"ok": True, "jpeg": base64.b64encode(jpeg).decode("ascii")}
            else:
                raise CameraAgentError("Yêu cầu camera không hợp lệ.")
        except CameraAgentError as error:
            response = response_for_error(error)
        except Exception as error:  # pragma: no cover - converts vendor SDK errors into a safe response
            response = response_for_error(CameraAgentError(str(error)))
        print(json.dumps(response, separators=(",", ":")), flush=True)
    return 0


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "serve":
        return serve()
    print("Use: python -m ws3_camera_agent.capture_worker serve", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
