const DEFAULT_RECROOM_BROKER_URL = "https://echoxr-ripoteam-cloud-pc.hf.space";
const TARGET_BUILD_ID = "recroom-2022-05-19";

export interface RecRoomVmRuntimeStatus {
  provider?: string;
  supported?: boolean;
  readyForGame?: boolean;
  exactBuild?: boolean;
  reason?: string | null;
  warning?: string | null;
  runningVms?: number;
  maxVms?: number;
  runningSandboxes?: number;
  maxSandboxes?: number;
  baseImage?: string;
  clientDir?: string;
  targetBuild?: string;
  targetManifest?: string;
  targetFingerprint?: string;
  clientFingerprint?: {
    ok?: boolean;
    buildId?: string;
    manifestId?: string;
    manifestPresent?: boolean;
    mismatches?: string[];
  };
  graphics?: string;
  checks?: Record<string, boolean | string>;
}

export interface RecRoomBrokerStatus {
  ok?: boolean;
  targetBuild?: string;
  configured?: boolean;
  onlineHosts?: number;
  sessions?: number;
  mode?: string;
  vmReadyForGame?: boolean;
  runtimeReadyForGame?: boolean;
  vmRuntime?: RecRoomVmRuntimeStatus;
  serverRuntime?: RecRoomVmRuntimeStatus;
  wineRuntime?: RecRoomVmRuntimeStatus;
  kvmRuntime?: RecRoomVmRuntimeStatus;
  error?: string;
  detail?: string;
}

export interface RecRoomHostPairingResponse {
  ok?: boolean;
  pairingCode?: string;
  expiresAtMs?: number;
  error?: string;
  detail?: string;
}

export interface RecRoomPlayResponse {
  ok?: boolean;
  mode?: string;
  state?: string;
  phase?: string;
  progress?: number;
  provider?: string;
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

export interface RecRoomClientInstallStatus {
  ok?: boolean;
  jobId?: string;
  state?: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  exactBuild?: boolean;
  buildId?: string;
  manifestId?: string;
  fingerprintSha256?: string;
  targetBuild?: string;
  targetManifest?: string;
  targetFingerprint?: string;
  installed?: boolean;
  expectedSha256?: boolean;
  actualSha256?: string;
  createdAtMs?: number;
  updatedAtMs?: number;
  error?: string | null;
  capability?: RecRoomVmRuntimeStatus;
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

function authHeaders(firebaseIdToken: string): HeadersInit {
  return { authorization: `Bearer ${firebaseIdToken}` };
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

export async function startRecRoomClientInstall(
  firebaseIdToken: string,
  url: string,
  sha256?: string,
): Promise<RecRoomClientInstallStatus> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/client-install`, {
    method: "POST",
    cache: "no-store",
    headers: {
      ...authHeaders(firebaseIdToken),
      "content-type": "application/json",
    },
    body: JSON.stringify({ url, sha256: sha256?.trim() || "" }),
  });
  return parseJson<RecRoomClientInstallStatus>(response);
}

export async function getRecRoomClientInstall(
  firebaseIdToken: string,
  jobId: string,
): Promise<RecRoomClientInstallStatus> {
  const response = await fetch(
    `${getRecRoomBrokerUrl()}/api/recroom-public/client-install/${encodeURIComponent(jobId)}`,
    {
      cache: "no-store",
      headers: authHeaders(firebaseIdToken),
    },
  );
  return parseJson<RecRoomClientInstallStatus>(response);
}

export async function createRecRoomHostPairing(firebaseIdToken: string): Promise<RecRoomHostPairingResponse> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/host-pairing`, {
    method: "POST",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${firebaseIdToken}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  return parseJson<RecRoomHostPairingResponse>(response);
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
  const response = await fetch(
    `${sessionPath(sessionId)}/release?accessToken=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    },
  );
  if (!response.ok && response.status !== 404) {
    await parseJson(response);
  }
}

/** Best-effort disposable runtime teardown for page close / navigation. */
export function releaseRecRoomSessionOnPageExit(sessionId: string, accessToken: string) {
  const url = `${sessionPath(sessionId)}/release?accessToken=${encodeURIComponent(accessToken)}`;
  try {
    void fetch(url, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
      mode: "cors",
    });
  } catch {
    // The backend also expires abandoned sessions as a final safety net.
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
