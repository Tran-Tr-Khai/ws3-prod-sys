import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureHikrobotPhoto,
  hikrobotStreamUrl,
  listHikrobotCameras,
  type HikrobotCamera,
} from './hikrobotCameraAgent';
import type { SelectedCamera } from './buffingTypes';

const CAMERA_STORAGE_KEY = 'ws3.buffing.camera-id';
const CAMERA_SKIP_STORAGE_KEY = 'ws3.buffing.camera-skipped';
const MVS_CAMERA_PREFIX = 'mvs:';

type UseBuffingCameraOptions = {
  language: string;
  onError: (message: string | null) => void;
};

type UseBuffingCameraResult = {
  cameras: MediaDeviceInfo[];
  mvsCameras: HikrobotCamera[];
  mvsAgentError: string | null;
  selectedCamera: SelectedCamera | null;
  cameraConnected: boolean;
  cameraSkipped: boolean;
  cameraConnecting: boolean;
  cameraPickerOpen: boolean;
  videoRef: { current: HTMLVideoElement | null };
  connectedCameraLabel: string;
  mvsStreamUrl: string | null;
  canPerformChecklist: boolean;
  setCameraPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  connectBrowserCamera: (cameraId: string) => Promise<void>;
  connectMvsCamera: (camera: HikrobotCamera) => Promise<void>;
  openCameraPicker: () => Promise<void>;
  captureCameraPhoto: () => Promise<File | null>;
  skipCamera: () => void;
};

/** Read the previously selected browser or MVS camera from local storage. */
function storedCamera(): SelectedCamera | null {
  const saved = window.localStorage.getItem(CAMERA_STORAGE_KEY);
  if (!saved) return null;
  if (saved.startsWith(MVS_CAMERA_PREFIX))
    return { source: 'mvs', id: saved.slice(MVS_CAMERA_PREFIX.length) };
  return { source: 'browser', id: saved };
}

/**
 * Manage browser/MVS camera discovery, connection, preview and capture for
 * the Buffing record screen.
 */
export function useBuffingCamera({
  language,
  onError,
}: UseBuffingCameraOptions): UseBuffingCameraResult {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mvsCameras, setMvsCameras] = useState<HikrobotCamera[]>([]);
  const [mvsAgentError, setMvsAgentError] = useState<string | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<SelectedCamera | null>(storedCamera);
  const [cameraConnected, setCameraConnected] = useState(false);
  const [cameraSkipped, setCameraSkipped] = useState(
    () => window.localStorage.getItem(CAMERA_SKIP_STORAGE_KEY) === 'true',
  );
  const [cameraConnecting, setCameraConnecting] = useState(false);
  const [cameraPickerOpen, setCameraPickerOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraConnected(false);
  }, []);

  /** Build a localized, actionable message for a camera connection failure. */
  const cameraErrorMessage = useCallback(
    (reason?: unknown) => {
      const prefix = language === 'vi' ? 'Không thể kết nối camera' : 'Unable to connect camera';
      if (!window.isSecureContext)
        return `${prefix}: ${language === 'vi' ? 'trang này không ở secure context (HTTPS/localhost).' : 'this page is not in a secure context (HTTPS/localhost).'}`;
      if (reason instanceof DOMException) {
        if (reason.name === 'NotAllowedError')
          return `${prefix}: ${language === 'vi' ? 'quyền camera bị chặn trong Chrome hoặc Windows.' : 'camera permission is blocked in Chrome or Windows.'}`;
        if (reason.name === 'NotFoundError')
          return `${prefix}: ${language === 'vi' ? 'Chrome không tìm thấy thiết bị camera.' : 'Chrome cannot find a camera device.'}`;
        if (reason.name === 'NotReadableError')
          return `${prefix}: ${language === 'vi' ? 'camera đang được ứng dụng khác sử dụng hoặc driver không gửi được hình ảnh.' : 'the camera is in use by another application or its driver is not providing video.'}`;
        if (reason.name === 'OverconstrainedError')
          return `${prefix}: ${language === 'vi' ? 'camera đã lưu không còn tồn tại. Hãy chọn lại camera.' : 'the saved camera is no longer available. Select it again.'}`;
        return `${prefix}: ${reason.name}.`;
      }
      return `${prefix}: ${language === 'vi' ? 'Camera API không khả dụng trong trình duyệt này.' : 'the Camera API is unavailable in this browser.'}`;
    },
    [language],
  );

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = cameraStreamRef.current;
    if (!cameraConnected || selectedCamera?.source !== 'browser' || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [cameraConnected, selectedCamera]);

  /** Connect one browser camera and attach its stream to the preview video. */
  const connectBrowserCamera = useCallback(
    async (cameraId: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError(cameraErrorMessage());
        return;
      }
      onError(null);
      setCameraConnecting(true);
      try {
        stopCamera();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } },
          audio: false,
        });
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === 'videoinput',
        );
        setCameras(devices);
        setSelectedCamera({ source: 'browser', id: cameraId });
        window.localStorage.setItem(CAMERA_STORAGE_KEY, cameraId);
        setCameraConnected(true);
        setCameraSkipped(false);
        window.localStorage.removeItem(CAMERA_SKIP_STORAGE_KEY);
        setCameraPickerOpen(false);
      } catch (reason) {
        stopCamera();
        onError(cameraErrorMessage(reason));
      } finally {
        setCameraConnecting(false);
      }
    },
    [cameraErrorMessage, onError, stopCamera],
  );

  /** Verify and connect one industrial MVS camera through the Camera Agent. */
  const connectMvsCamera = useCallback(
    async (camera: HikrobotCamera) => {
      onError(null);
      setCameraConnecting(true);
      try {
        stopCamera();
        // A one-off capture verifies the camera before the persistent MJPEG stream opens.
        await captureHikrobotPhoto(camera.id);
        setSelectedCamera({ source: 'mvs', id: camera.id });
        window.localStorage.setItem(CAMERA_STORAGE_KEY, `${MVS_CAMERA_PREFIX}${camera.id}`);
        setCameraConnected(true);
        setCameraSkipped(false);
        window.localStorage.removeItem(CAMERA_SKIP_STORAGE_KEY);
        setCameraPickerOpen(false);
      } catch (reason) {
        stopCamera();
        onError(
          reason instanceof Error
            ? reason.message
            : language === 'vi'
              ? 'Không thể kết nối MVS Camera Agent.'
              : 'Unable to connect to the MVS Camera Agent.',
        );
      } finally {
        setCameraConnecting(false);
      }
    },
    [language, onError, stopCamera],
  );

  /** Discover available browser and industrial cameras for the picker dialog. */
  const openCameraPicker = useCallback(async () => {
    setCameraPickerOpen(true);
    onError(null);
    setMvsAgentError(null);
    setCameraConnecting(true);
    try {
      const browserCameras = (async () => {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error(cameraErrorMessage());
        const permissionStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        permissionStream.getTracks().forEach((track) => track.stop());
        return (await navigator.mediaDevices.enumerateDevices()).filter(
          (device) => device.kind === 'videoinput',
        );
      })();
      const industrialCameras = listHikrobotCameras();
      const [browserResult, industrialResult] = await Promise.allSettled([
        browserCameras,
        industrialCameras,
      ]);
      if (browserResult.status === 'fulfilled') setCameras(browserResult.value);
      if (industrialResult.status === 'fulfilled') setMvsCameras(industrialResult.value);
      if (industrialResult.status === 'rejected') {
        setMvsCameras([]);
        setMvsAgentError(
          industrialResult.reason instanceof Error
            ? industrialResult.reason.message
            : 'MVS Camera Agent is unavailable.',
        );
      }
      if (browserResult.status === 'rejected' && industrialResult.status === 'rejected') {
        const browserError =
          browserResult.reason instanceof Error
            ? browserResult.reason.message
            : cameraErrorMessage();
        onError(browserError);
      }
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : cameraErrorMessage());
    } finally {
      setCameraConnecting(false);
    }
  }, [cameraErrorMessage, onError]);

  useEffect(() => {
    if (selectedCamera?.source === 'browser') void connectBrowserCamera(selectedCamera.id);
    if (selectedCamera?.source === 'mvs') {
      void listHikrobotCameras()
        .then((devices) => {
          setMvsCameras(devices);
          const saved = devices.find((device) => device.id === selectedCamera.id);
          if (saved) return connectMvsCamera(saved);
          onError(
            language === 'vi'
              ? 'Không tìm thấy MVS camera đã lưu. Hãy chọn lại camera.'
              : 'The saved MVS camera is no longer available. Select it again.',
          );
          return undefined;
        })
        .catch((reason: unknown) =>
          onError(reason instanceof Error ? reason.message : 'MVS Camera Agent is unavailable.'),
        );
    }
    // Restore the user's previously approved camera once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Capture one decoded browser-camera frame as a JPEG upload. */
  const captureCameraPhoto = useCallback(async (): Promise<File | null> => {
    const video = videoRef.current;
    if (!cameraConnected || !video) return null;
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          video.removeEventListener('loadeddata', finish);
          video.removeEventListener('canplay', finish);
          window.clearTimeout(timeoutId);
          resolve();
        };
        const timeoutId = window.setTimeout(finish, 2_000);
        video.addEventListener('loadeddata', finish, { once: true });
        video.addEventListener('canplay', finish, { once: true });
      });
    }
    // Wait two paint cycles so a newly opened stream cannot yield a black frame.
    await new Promise<void>((resolve) =>
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
    );
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    )
      return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    );
    return blob
      ? new File([blob], `buffing-check-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, {
          type: 'image/jpeg',
        })
      : null;
  }, [cameraConnected]);

  /** Continue without a camera and persist that station preference locally. */
  const skipCamera = useCallback(() => {
    window.localStorage.setItem(CAMERA_SKIP_STORAGE_KEY, 'true');
    setCameraSkipped(true);
    onError(null);
  }, [onError]);

  const connectedCameraLabel =
    selectedCamera?.source === 'mvs'
      ? mvsCameras.find((camera) => camera.id === selectedCamera.id)?.label || 'MVS / Hikrobot'
      : cameras.find((camera) => camera.deviceId === selectedCamera?.id)?.label || 'Camera';
  const mvsStreamUrl =
    cameraConnected && selectedCamera?.source === 'mvs'
      ? hikrobotStreamUrl(selectedCamera.id)
      : null;

  return {
    cameras,
    mvsCameras,
    mvsAgentError,
    selectedCamera,
    cameraConnected,
    cameraSkipped,
    cameraConnecting,
    cameraPickerOpen,
    videoRef,
    connectedCameraLabel,
    mvsStreamUrl,
    canPerformChecklist: cameraConnected || cameraSkipped,
    setCameraPickerOpen,
    connectBrowserCamera,
    connectMvsCamera,
    openCameraPicker,
    captureCameraPhoto,
    skipCamera,
  };
}
