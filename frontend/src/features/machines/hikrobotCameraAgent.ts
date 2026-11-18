import { cameraAgentUrl } from '../../config/runtime';

export type HikrobotCamera = {
  id: string;
  label: string;
  transport: string;
  serial_number: string;
};

type CameraListResponse = { cameras?: HikrobotCamera[] };
type AgentErrorResponse = { detail?: unknown; message?: unknown };

const requestTimeoutMs = 12_000;

function errorText(body: AgentErrorResponse, fallback: string) {
  if (typeof body.detail === 'string') return body.detail;
  if (typeof body.message === 'string') return body.message;
  return fallback;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${cameraAgentUrl}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.ok) return response;
    let body: AgentErrorResponse = {};
    try {
      body = (await response.json()) as AgentErrorResponse;
    } catch {
      /* A non-JSON error is still a usable failure. */
    }
    throw new Error(errorText(body, `Camera agent returned HTTP ${response.status}.`));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Không thể kết nối Camera Agent trên máy này trong 12 giây.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

/** Discover cameras exposed by the local Hikrobot/MVS Camera Agent. */
export async function listHikrobotCameras(): Promise<HikrobotCamera[]> {
  const response = await request('/api/v1/cameras');
  const body = (await response.json()) as CameraListResponse;
  return Array.isArray(body.cameras) ? body.cameras : [];
}

/** Capture one still image and convert it into a file ready for Buffing upload. */
export async function captureHikrobotPhoto(cameraId: string): Promise<File> {
  const response = await request(`/api/v1/cameras/${encodeURIComponent(cameraId)}/capture`, {
    method: 'POST',
  });
  const image = await response.blob();
  if (image.size === 0) throw new Error('Camera Agent trả về ảnh trống.');
  return new File(
    [image],
    `buffing-check-mvs-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
    { type: image.type || 'image/jpeg' },
  );
}

/** Return the direct MJPEG stream URL for a selected Camera Agent device. */
export function hikrobotStreamUrl(cameraId: string): string {
  return `${cameraAgentUrl}/api/v1/cameras/${encodeURIComponent(cameraId)}/stream`;
}
