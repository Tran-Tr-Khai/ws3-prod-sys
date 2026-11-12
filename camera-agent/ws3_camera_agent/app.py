"""Local-only HTTP bridge for MVS/Hikrobot cameras.

The browser Camera API can only see devices that Windows exposes as webcams.
Industrial cameras controlled through MVS need the vendor SDK on the workstation
where the camera is connected, so this small service stays on that workstation
and returns a JPEG to the WS3 web application.
"""

from __future__ import annotations

import importlib
import io
import json
import os
import base64
import subprocess
import sys
import threading
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

from ctypes import POINTER, byref, cast, create_string_buffer, c_ubyte, memset, sizeof, string_at

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image


DEFAULT_ORIGINS = (
    "https://192.168.100.253,"
    "http://192.168.100.253,"
    "https://localhost,"
    "https://127.0.0.1,"
    "http://localhost:5173,"
    "http://127.0.0.1:5173"
)
DEFAULT_SDK_PATHS = (
    r"C:\Program Files (x86)\MVS\Development\Samples\Python\MvImport",
    r"C:\Program Files\MVS\Development\Samples\Python\MvImport",
)
DEFAULT_RUNTIME_ROOTS = (
    r"C:\Program Files (x86)\Common Files\MVS\Runtime",
    r"C:\Program Files\Common Files\MVS\Runtime",
)


class CameraAgentError(RuntimeError):
    """A safe, user-facing error emitted by the local camera agent."""


class CameraNotFoundError(CameraAgentError):
    """The selected camera has been removed or changed."""


class CameraBusyError(CameraAgentError):
    """Another application has the camera open."""


@dataclass(frozen=True)
class CameraDescriptor:
    id: str
    label: str
    transport: str
    serial_number: str

    def as_response(self) -> dict[str, str]:
        return {
            "id": self.id,
            "label": self.label,
            "transport": self.transport,
            "serial_number": self.serial_number,
        }


class MvsCameraService:
    """Load MVS lazily and take a single JPEG snapshot per request.

    The service deliberately opens, captures and closes for each request.  This
    avoids holding an exclusive MVS device handle while the browser is idle and
    lets the MVS client or maintenance tools use the camera between checks.
    """

    def __init__(self) -> None:
        self._sdk: Any | None = None
        self._load_error: str | None = None
        self._dll_directories: list[Any] = []
        self._lock = threading.Lock()

    @staticmethod
    def _decode(value: Any) -> str:
        return bytes(value).split(b"\0", 1)[0].decode("utf-8", errors="replace").strip()

    @staticmethod
    def _sdk_paths() -> list[Path]:
        configured = os.getenv("WS3_MVS_PYTHON_PATH", "")
        paths = [Path(value.strip()) for value in configured.split(os.pathsep) if value.strip()]
        paths.extend(Path(value) for value in DEFAULT_SDK_PATHS)
        return paths

    def _load_sdk(self) -> Any:
        if self._sdk is not None:
            return self._sdk
        if self._load_error is not None:
            raise CameraAgentError(self._load_error)

        sdk_path = next(
            (path for path in self._sdk_paths() if (path / "MvCameraControl_class.py").is_file()),
            None,
        )
        if sdk_path is None:
            self._load_error = (
                "Không tìm thấy MVS Python SDK. Cài MVS rồi đặt WS3_MVS_PYTHON_PATH "
                "tới thư mục MvImport nếu không dùng đường dẫn mặc định."
            )
            raise CameraAgentError(self._load_error)

        runtime_arch = "Win64_x64" if sys.maxsize > 2**32 else "Win32_i86"
        for root in (Path(value) for value in DEFAULT_RUNTIME_ROOTS):
            runtime_path = root / runtime_arch
            if (runtime_path / "MvCameraControl.dll").is_file():
                os.environ["PATH"] = f"{runtime_path}{os.pathsep}{os.environ.get('PATH', '')}"
                if hasattr(os, "add_dll_directory"):
                    self._dll_directories.append(os.add_dll_directory(str(runtime_path)))
                break

        if str(sdk_path) not in sys.path:
            sys.path.insert(0, str(sdk_path))
        try:
            self._sdk = importlib.import_module("MvCameraControl_class")
        except Exception as exc:  # pragma: no cover - depends on the installed MVS runtime
            self._load_error = f"Không nạp được MVS SDK: {exc}"
            raise CameraAgentError(self._load_error) from exc
        return self._sdk

    @staticmethod
    def _transport_mask(sdk: Any) -> int:
        # USB3 Vision and GigE Vision cover normal MVS industrial cameras.
        # Probing every frame-grabber transport can add 20+ seconds to a scan
        # on a workstation without those interfaces, so advanced GenTL layers
        # are opt-in instead of slowing down the everyday BU-01 workflow.
        names = ["MV_GIGE_DEVICE", "MV_USB_DEVICE"]
        if os.getenv("WS3_MVS_EXTRA_TRANSPORTS", "").strip().lower() in {"1", "true", "yes"}:
            names.extend((
                "MV_CAMERALINK_DEVICE",
                "MV_GENTL_GIGE_DEVICE",
                "MV_GENTL_CAMERALINK_DEVICE",
                "MV_GENTL_CXP_DEVICE",
                "MV_GENTL_XOF_DEVICE",
                "MV_GENTL_XOC_DEVICE",
                "MV_GENTL_VIR_DEVICE",
            ))
        return sum(int(getattr(sdk, name, 0)) for name in names)

    @staticmethod
    def _transport_info(sdk: Any, device_info: Any) -> tuple[str, Any]:
        layer = int(device_info.nTLayerType)
        if layer & int(getattr(sdk, "MV_GIGE_DEVICE", 0)):
            return "GigE", device_info.SpecialInfo.stGigEInfo
        if layer & int(getattr(sdk, "MV_USB_DEVICE", 0)):
            return "USB3", device_info.SpecialInfo.stUsb3VInfo
        if layer & int(getattr(sdk, "MV_GENTL_CXP_DEVICE", 0)):
            return "CoaXPress", device_info.SpecialInfo.stCXPInfo
        if layer & int(getattr(sdk, "MV_GENTL_CAMERALINK_DEVICE", 0)):
            return "Camera Link", device_info.SpecialInfo.stCMLInfo
        if layer & int(getattr(sdk, "MV_GENTL_XOF_DEVICE", 0)):
            return "XoFLink", device_info.SpecialInfo.stXoFInfo
        if layer & int(getattr(sdk, "MV_GENTL_XOC_DEVICE", 0)):
            return "XoCLink", device_info.SpecialInfo.stXoCInfo
        return "MVS", device_info.SpecialInfo.stVirInfo

    def _describe(self, sdk: Any, device_info: Any, index: int) -> CameraDescriptor:
        transport, info = self._transport_info(sdk, device_info)
        name = self._decode(getattr(info, "chUserDefinedName", b""))
        model = self._decode(getattr(info, "chModelName", b""))
        serial = self._decode(getattr(info, "chSerialNumber", b""))
        identity = serial or self._decode(getattr(info, "chDeviceGUID", b"")) or str(index)
        label = " / ".join(part for part in (name, model) if part) or f"{transport} camera {index + 1}"
        return CameraDescriptor(
            id=f"{int(device_info.nTLayerType)}:{identity}",
            label=label,
            transport=transport,
            serial_number=serial,
        )

    def _enumerate(self, sdk: Any) -> tuple[Any, list[tuple[CameraDescriptor, Any]]]:
        device_list = sdk.MV_CC_DEVICE_INFO_LIST()
        result = sdk.MvCamera.MV_CC_EnumDevices(self._transport_mask(sdk), device_list)
        if result != 0:
            raise CameraAgentError(f"MVS không thể quét camera (0x{result & 0xFFFFFFFF:08X}).")
        cameras: list[tuple[CameraDescriptor, Any]] = []
        for index in range(int(device_list.nDeviceNum)):
            device_info = cast(device_list.pDeviceInfo[index], POINTER(sdk.MV_CC_DEVICE_INFO)).contents
            cameras.append((self._describe(sdk, device_info, index), device_info))
        return device_list, cameras

    def list_cameras(self) -> list[CameraDescriptor]:
        with self._lock:
            sdk = self._load_sdk()
            _, cameras = self._enumerate(sdk)
            return [descriptor for descriptor, _ in cameras]

    @staticmethod
    def _manual_value(name: str, default: str) -> float | None:
        value = os.getenv(name, default).strip().lower()
        if value in {"", "auto", "none"}:
            return None
        try:
            return float(value)
        except ValueError as exc:
            raise CameraAgentError(f"{name} phải là số hoặc 'auto'.") from exc

    def _apply_optional_production_settings(self, sdk: Any, camera: Any) -> bool:
        """Apply the known BU-01 settings only when the camera supports them.

        The source test program uses 125 us exposure and 12 dB gain.  We retain
        those values as safe defaults for BU-01, but never reject another MVS
        camera merely because it does not expose the same GenICam nodes or
        ranges.  Set either environment variable to ``auto`` to use the
        camera's current automatic setting instead.
        """
        exposure = self._manual_value("WS3_MVS_EXPOSURE_US", "125")
        gain = self._manual_value("WS3_MVS_GAIN_DB", "12")
        if exposure is None and gain is None:
            return False

        for key in ("ExposureAuto", "GainAuto"):
            camera.MV_CC_SetEnumValue(key, 0)
        for key, requested in (("ExposureTime", exposure), ("Gain", gain)):
            if requested is None:
                continue
            value = sdk.MVCC_FLOATVALUE()
            if camera.MV_CC_GetFloatValue(key, value) != 0:
                continue
            if not value.fMin <= requested <= value.fMax:
                continue
            camera.MV_CC_SetFloatValue(key, requested)
        return True

    @staticmethod
    def _apply_optional_pixel_format(camera: Any) -> None:
        """Prefer the BU-01 Bayer format but retain unsupported camera formats.

        MVS returns a non-zero status when the camera cannot use BayerGR8.  The
        result is intentionally ignored so Mono/RGB/YUV-capable cameras still
        use their native, compatible setting.  Use ``auto`` to skip this
        preference entirely.
        """
        pixel_format = os.getenv("WS3_MVS_PIXEL_FORMAT", "BayerGR8").strip()
        if pixel_format and pixel_format.lower() not in {"auto", "none"}:
            camera.MV_CC_SetEnumValueByString("PixelFormat", pixel_format)

    @contextmanager
    def _opened_camera(self, sdk: Any, device_info: Any) -> Iterator[Any]:
        camera = sdk.MvCamera()
        result = camera.MV_CC_CreateHandle(device_info)
        if result != 0:
            raise CameraAgentError(f"MVS không tạo được camera handle (0x{result & 0xFFFFFFFF:08X}).")
        is_open = False
        is_grabbing = False
        try:
            result = camera.MV_CC_OpenDevice(sdk.MV_ACCESS_Exclusive, 0)
            if result != 0:
                if result in (0x80000203, 0x80000204):
                    raise CameraBusyError("Camera đang được ứng dụng khác sử dụng.")
                raise CameraAgentError(f"MVS không mở được camera (0x{result & 0xFFFFFFFF:08X}).")
            is_open = True
            # Some MVS cameras do not expose TriggerMode; it is safe to retain
            # their current mode in that case.  When supported, free-run avoids
            # waiting forever for an external trigger while taking a checklist photo.
            camera.MV_CC_SetEnumValue("TriggerMode", 0)
            self._apply_optional_pixel_format(camera)
            result = camera.MV_CC_StartGrabbing()
            if result != 0:
                raise CameraAgentError(f"MVS không bắt đầu lấy ảnh được (0x{result & 0xFFFFFFFF:08X}).")
            is_grabbing = True
            # Match the successful MVS sample sequence: initialize one grabbing
            # session, stop it, change manual exposure/gain, then start again.
            if self._manual_value("WS3_MVS_EXPOSURE_US", "125") is not None or self._manual_value("WS3_MVS_GAIN_DB", "12") is not None:
                camera.MV_CC_StopGrabbing()
                is_grabbing = False
                self._apply_optional_production_settings(sdk, camera)
                result = camera.MV_CC_StartGrabbing()
                if result != 0:
                    raise CameraAgentError(f"MVS không khởi động lại camera sau khi đặt exposure/gain (0x{result & 0xFFFFFFFF:08X}).")
                is_grabbing = True
            yield camera
        finally:
            if is_grabbing:
                camera.MV_CC_StopGrabbing()
            if is_open:
                camera.MV_CC_CloseDevice()
            camera.MV_CC_DestroyHandle()

    @staticmethod
    def _jpeg_from_frame(sdk: Any, camera: Any, frame: Any) -> bytes:
        info = frame.stFrameInfo
        width, height = int(info.nWidth), int(info.nHeight)
        if width <= 0 or height <= 0 or not frame.pBufAddr:
            raise CameraAgentError("MVS trả về khung hình rỗng.")

        # Ask MVS to convert Bayer, Mono, RGB and YUV payloads to the one
        # format expected by Pillow.  Unlike forcing BayerGR8, this keeps the
        # device's compatible native PixelFormat and supports more MVS models.
        destination_size = width * height * 3
        destination = create_string_buffer(destination_size)
        convert = sdk.MV_CC_PIXEL_CONVERT_PARAM()
        convert.nWidth = width
        convert.nHeight = height
        convert.enSrcPixelType = info.enPixelType
        convert.pSrcData = cast(frame.pBufAddr, POINTER(c_ubyte))
        convert.nSrcDataLen = int(info.nFrameLen)
        convert.enDstPixelType = sdk.PixelType_Gvsp_BGR8_Packed
        convert.pDstBuffer = cast(destination, POINTER(c_ubyte))
        convert.nDstBufferSize = destination_size
        result = camera.MV_CC_ConvertPixelType(convert)
        if result == 0:
            image = Image.frombytes("RGB", (width, height), destination.raw, "raw", "BGR")
        elif info.enPixelType == sdk.PixelType_Gvsp_Mono8:
            raw = string_at(frame.pBufAddr, width * height)
            image = Image.frombytes("L", (width, height), raw).convert("RGB")
        else:
            raise CameraAgentError(
                f"MVS không chuyển được PixelFormat {int(info.enPixelType)} sang JPEG "
                f"(0x{result & 0xFFFFFFFF:08X})."
            )

        output = io.BytesIO()
        # ``optimize=True`` can take tens of seconds on the 5 MP BU-01 frame.
        # A fast JPEG is more useful to the operator and stays comfortably
        # within the existing 5 MiB image-upload limit.
        image.save(output, format="JPEG", quality=92)
        return output.getvalue()

    def capture_jpeg(self, camera_id: str) -> bytes:
        with self._lock:
            sdk = self._load_sdk()
            device_list, cameras = self._enumerate(sdk)
            selected = next((item for item in cameras if item[0].id == camera_id), None)
            if selected is None:
                raise CameraNotFoundError("Không tìm thấy camera MVS đã chọn. Hãy quét lại danh sách camera.")
            _descriptor, device_info = selected
            # Retain the SDK-owned enumeration list while its device-info
            # pointer is used to create the MVS handle.
            with self._opened_camera(sdk, device_info) as camera:
                for _ in range(3):
                    frame = sdk.MV_FRAME_OUT()
                    memset(byref(frame), 0, sizeof(frame))
                    result = camera.MV_CC_GetImageBuffer(frame, 1_500)
                    if result == 0:
                        try:
                            return self._jpeg_from_frame(sdk, camera, frame)
                        finally:
                            camera.MV_CC_FreeImageBuffer(frame)
                raise CameraAgentError("Không nhận được ảnh từ camera trong 3 lần thử.")


class MvsCameraWorkerProcess:
    """A persistent main-thread process for the MVS Python binding.

    MVS capture was verified in the standalone script but is not reliable when
    an HTTP framework moves requests between threads.  The companion process
    retains the SDK in one Python main thread and receives a small JSON-line
    protocol over stdio; the FastAPI process never calls MVS directly.
    """

    def __init__(self) -> None:
        self._process: subprocess.Popen[str] | None = None
        self._lock = threading.Lock()

    def _start(self) -> subprocess.Popen[str]:
        if self._process is not None and self._process.poll() is None:
            return self._process
        package_root = str(Path(__file__).resolve().parents[1])
        environment = os.environ.copy()
        previous_python_path = environment.get("PYTHONPATH", "")
        environment["PYTHONPATH"] = package_root if not previous_python_path else f"{package_root}{os.pathsep}{previous_python_path}"
        self._process = subprocess.Popen(
            [sys.executable, "-m", "ws3_camera_agent.capture_worker", "serve"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            bufsize=1,
            env=environment,
        )
        return self._process

    def _request(self, payload: dict[str, str]) -> dict[str, Any]:
        with self._lock:
            process = self._start()
            if process.stdin is None or process.stdout is None:
                raise CameraAgentError("Không khởi động được MVS capture worker.")
            try:
                process.stdin.write(json.dumps(payload, separators=(",", ":")) + "\n")
                process.stdin.flush()
                line = process.stdout.readline()
            except OSError as error:
                self._process = None
                raise CameraAgentError("Mất kết nối tới MVS capture worker.") from error
            if not line:
                stderr = process.stderr.read().strip() if process.stderr is not None else ""
                self._process = None
                raise CameraAgentError(stderr or "MVS capture worker đã dừng bất ngờ.")
        try:
            response = json.loads(line)
        except json.JSONDecodeError as error:
            raise CameraAgentError("MVS capture worker trả về dữ liệu không hợp lệ.") from error
        if not isinstance(response, dict):
            raise CameraAgentError("MVS capture worker trả về dữ liệu không hợp lệ.")
        if response.get("ok") is not True:
            detail = response.get("error")
            message = detail if isinstance(detail, str) else "MVS capture worker không thể xử lý camera."
            if response.get("error_type") == "not_found":
                raise CameraNotFoundError(message)
            if response.get("error_type") == "busy":
                raise CameraBusyError(message)
            raise CameraAgentError(message)
        return response

    def list_cameras(self) -> list[CameraDescriptor]:
        response = self._request({"action": "list"})
        cameras = response.get("cameras")
        if not isinstance(cameras, list):
            raise CameraAgentError("MVS capture worker trả về danh sách camera không hợp lệ.")
        try:
            return [
                CameraDescriptor(
                    id=str(camera["id"]),
                    label=str(camera["label"]),
                    transport=str(camera["transport"]),
                    serial_number=str(camera["serial_number"]),
                )
                for camera in cameras
            ]
        except (KeyError, TypeError) as error:
            raise CameraAgentError("MVS capture worker trả về danh sách camera không hợp lệ.") from error

    def capture_jpeg(self, camera_id: str) -> bytes:
        response = self._request({"action": "capture", "camera_id": camera_id})
        jpeg = response.get("jpeg")
        if not isinstance(jpeg, str):
            raise CameraAgentError("MVS capture worker trả về ảnh trống.")
        try:
            image = base64.b64decode(jpeg, validate=True)
        except ValueError as error:
            raise CameraAgentError("MVS capture worker trả về ảnh không hợp lệ.") from error
        if not image:
            raise CameraAgentError("MVS capture worker trả về ảnh trống.")
        return image

    def close(self) -> None:
        with self._lock:
            process, self._process = self._process, None
            if process is None or process.poll() is not None:
                return
            process.terminate()
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            process.kill()


def _origins() -> list[str]:
    return [
        origin.strip()
        for origin in os.getenv("WS3_CAMERA_AGENT_ORIGINS", DEFAULT_ORIGINS).split(",")
        if origin.strip()
    ]


camera_worker = MvsCameraWorkerProcess()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        yield
    finally:
        camera_worker.close()


app = FastAPI(title="WS3 Camera Agent", version="0.1.0", docs_url=None, redoc_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    max_age=600,
)


@app.middleware("http")
async def allow_private_network_access(request: Any, call_next: Any) -> Response:
    response = await call_next(request)
    # Chrome may preflight a request from the factory web server to loopback.
    # The agent only binds to 127.0.0.1, and CORS still controls its callers.
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


def _http_error(error: CameraAgentError) -> HTTPException:
    if isinstance(error, CameraNotFoundError):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, CameraBusyError):
        return HTTPException(status_code=409, detail=str(error))
    return HTTPException(status_code=503, detail=str(error))


@app.get("/health")
async def health() -> dict[str, str]:
    try:
        camera_worker.list_cameras()
        return {"status": "ok"}
    except CameraAgentError as error:
        return {"status": "degraded", "detail": str(error)}


@app.get("/api/v1/cameras")
async def cameras() -> dict[str, list[dict[str, str]]]:
    try:
        return {"cameras": [camera.as_response() for camera in camera_worker.list_cameras()]}
    except CameraAgentError as error:
        raise _http_error(error) from error


@app.post("/api/v1/cameras/{camera_id}/capture")
async def capture(camera_id: str) -> Response:
    try:
        jpeg = camera_worker.capture_jpeg(camera_id)
    except CameraAgentError as error:
        raise _http_error(error) from error
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )


def main() -> None:
    import uvicorn

    uvicorn.run(
        app,
        host=os.getenv("WS3_CAMERA_AGENT_HOST", "127.0.0.1"),
        port=int(os.getenv("WS3_CAMERA_AGENT_PORT", "8765")),
        log_level=os.getenv("WS3_CAMERA_AGENT_LOG_LEVEL", "info"),
    )
