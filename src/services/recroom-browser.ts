const DEFAULT_RECROOM_BROKER_URL = "https://echoxr-ripoteam-cloud-pc.hf.space";
const TARGET_BUILD_ID = "recroom-2022-05-19";

export interface RecRoomBrokerStatus {
  ok?: boolean;
  targetBuild?: string;
  configured?: boolean;
  onlineHosts?: number;
  sessions?: number;
  error?: string;
  detail?: string;
}

export interface RecRoomPlayResponse {
  ok?: boolean;
  mode?: string;
  state?: string;
  error?: string;
  detail?: string;
  sessionId?: string;
  sessionAccessToken?: string;
  streamUrl?: string;
  expiresAtMs?: number;
  hostId?: string;
  buildId?: string;
}

export interface RecRoomCaptureResponse {
  ok?: boolean;
  captureId?: string;
  sessionId?: string;
  state?: string;
  ready?: boolean;
  contentType?: string | null;
  error?: string | null;
  detail?: string;
}

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getRecRoomBrokerUrl() {
  return trimSlash(process.env.NEXT_PUBLIC_RECROOM_BROKER_URL || DEFAULT_RECROOM_BROKER_URL);
}

async function parseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T & { detail?: string; error?: string };
  if (!response.ok) {
    const message = payload.error || payload.detail || `Rec Room service returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

function sessionPath(sessionId: string, accessToken?: string) {
  const encodedSession = encodeURIComponent(sessionId);
  const suffix = accessToken ? `?accessToken=${encodeURIComponent(accessToken)}` : "";
  return `${getRecRoomBrokerUrl()}/api/recroom-public/sessions/${encodedSession}${suffix}`;
}

export async function getRecRoomBrokerStatus(): Promise<RecRoomBrokerStatus> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/status`, {
    cache: "no-store",
  });
  return parseJson<RecRoomBrokerStatus>(response);
}

export async function createRecRoomSession(firebaseIdToken: string): Promise<RecRoomPlayResponse> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/sessions`, {
    method: "POST",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${firebaseIdToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ buildId: TARGET_BUILD_ID }),
  });
  return parseJson<RecRoomPlayResponse>(response);
}

export async function getRecRoomSession(
  sessionId: string,
  accessToken: string,
): Promise<RecRoomPlayResponse> {
  const response = await fetch(sessionPath(sessionId, accessToken), { cache: "no-store" });
  return parseJson<RecRoomPlayResponse>(response);
}

export async function releaseRecRoomSession(sessionId: string, accessToken: string): Promise<void> {
  const response = await fetch(sessionPath(sessionId, accessToken), {
    method: "DELETE",
    cache: "no-store",
    keepalive: true,
  });
  if (!response.ok && response.status !== 404) {
    await parseJson(response);
  }
}

export async function requestRecRoomCapture(
  sessionId: string,
  accessToken: string,
): Promise<RecRoomCaptureResponse> {
  const response = await fetch(`${sessionPath(sessionId)}/captures?accessToken=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    cache: "no-store",
  });
  return parseJson<RecRoomCaptureResponse>(response);
}

export async function getRecRoomCapture(
  sessionId: string,
  accessToken: string,
  captureId: string,
): Promise<RecRoomCaptureResponse> {
  const response = await fetch(
    `${sessionPath(sessionId)}/captures/${encodeURIComponent(captureId)}?accessToken=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" },
  );
  return parseJson<RecRoomCaptureResponse>(response);
}

export async function downloadRecRoomCapture(
  sessionId: string,
  accessToken: string,
  captureId: string,
): Promise<Blob> {
  const response = await fetch(
    `${sessionPath(sessionId)}/captures/${encodeURIComponent(captureId)}/image?accessToken=${encodeURIComponent(accessToken)}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    await parseJson(response);
  }
  return response.blob();
}
