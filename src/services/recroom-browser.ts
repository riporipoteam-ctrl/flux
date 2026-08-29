import { auth } from "@/lib/firebase";
import { loadRecRoomRevivalIdentity } from "@/services/recroom-revival";

const DEFAULT_RECROOM_BROKER_URL = "https://echoxr-ripoteam-cloud-pc.hf.space";
const TARGET_BUILD_ID = "recroom-2021-08-25";
const SESSION_CREATE_WAIT_MS = 10 * 60_000;
const SESSION_CREATE_POLL_MS = 1_500;

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
  streamReady?: boolean;
  gameReady?: boolean;
  interactionRequired?: string | null;
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

function authHeaders(firebaseIdToken: string, revivalUserId?: string): HeadersInit {
  return {
    authorization: `Bearer ${firebaseIdToken}`,
    ...(revivalUserId ? { "x-flux-revival-user-id": revivalUserId } : {}),
  };
}

function sessionPath(sessionId: string, accessToken?: string) {
  const encodedSession = encodeURIComponent(sessionId);
  const suffix = accessToken ? `?accessToken=${encodeURIComponent(accessToken)}` : "";
  return `${getRecRoomBrokerUrl()}/api/recroom-public/sessions/${encodedSession}${suffix}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runtimeFromStatus(status: RecRoomBrokerStatus): RecRoomVmRuntimeStatus | undefined {
  return status.serverRuntime || status.vmRuntime || status.wineRuntime || status.kvmRuntime;
}

function runtimeStatusDetail(status: RecRoomBrokerStatus) {
  const runtime = runtimeFromStatus(status);
  return (
    runtime?.reason ||
    runtime?.warning ||
    status.error ||
    status.detail ||
    "RipoTeamServer is restoring the Aug 25, 2021 Rec Room server image."
  );
}

function isTransientRuntimeMessage(message: string) {
  const value = message.toLowerCase();
  return [
    "game image has not been installed",
    "client is not installed",
    "server rec room client is not installed",
    "runtime is still preparing",
    "does not currently have a game-ready rec room runtime slot",
    "game-ready runtime slot",
    "no free capacity",
    "sandbox slot",
    "service returned http 409",
    "service returned http 425",
    "service returned http 502",
    "service returned http 503",
    "service returned http 504",
    "failed to fetch",
    "networkerror",
    "load failed",
  ].some((part) => value.includes(part));
}

export async function getRecRoomBrokerStatus(): Promise<RecRoomBrokerStatus> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/status`, { cache: "no-store" });
  return parseJson<RecRoomBrokerStatus>(response);
}

export async function startRecRoomClientInstall(firebaseIdToken: string, url: string, sha256?: string): Promise<RecRoomClientInstallStatus> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/client-install`, {
    method: "POST",
    cache: "no-store",
    headers: { ...authHeaders(firebaseIdToken), "content-type": "application/json" },
    body: JSON.stringify({ url, sha256: sha256?.trim() || "" }),
  });
  return parseJson<RecRoomClientInstallStatus>(response);
}

export async function getRecRoomClientInstall(firebaseIdToken: string, jobId: string): Promise<RecRoomClientInstallStatus> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/client-install/${encodeURIComponent(jobId)}`, {
    cache: "no-store",
    headers: authHeaders(firebaseIdToken),
  });
  return parseJson<RecRoomClientInstallStatus>(response);
}

export async function createRecRoomHostPairing(firebaseIdToken: string): Promise<RecRoomHostPairingResponse> {
  const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/host-pairing`, {
    method: "POST",
    cache: "no-store",
    headers: { ...authHeaders(firebaseIdToken), "content-type": "application/json" },
    body: "{}",
  });
  return parseJson<RecRoomHostPairingResponse>(response);
}

export async function createRecRoomSession(firebaseIdToken: string): Promise<RecRoomPlayResponse> {
  const deadline = Date.now() + SESSION_CREATE_WAIT_MS;
  let lastTransient = "RipoTeamServer is restoring the Aug 25, 2021 Rec Room server image.";
  const currentUser = auth.currentUser;
  const revivalIdentity = currentUser ? await loadRecRoomRevivalIdentity(currentUser.uid).catch(() => null) : null;
  const revivalUserId = revivalIdentity?.revivalUserId || null;

  while (Date.now() < deadline) {
    try {
      // Do not gate Start on a cached readiness flag. The broker is authoritative
      // for allocation and may be able to provision the runtime between status
      // polls. This also makes server-side diagnostics reach the player instead
      // of hiding them behind a client pre-flight loop.
      const response = await fetch(`${getRecRoomBrokerUrl()}/api/recroom-public/sessions`, {
        method: "POST",
        cache: "no-store",
        headers: {
          ...authHeaders(firebaseIdToken, revivalUserId || undefined),
          "content-type": "application/json",
          "x-flux-recroom-client": "v12-session-direct",
        },
        body: JSON.stringify({
          buildId: TARGET_BUILD_ID,
          fluxUserId: currentUser?.uid || null,
          revivalUserId,
          identityVersion: revivalIdentity?.version || 1,
        }),
      });
      return await parseJson<RecRoomPlayResponse>(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isTransientRuntimeMessage(message)) throw error;
      lastTransient = message;
    }

    // Refresh the status only after an allocation attempt. This keeps status
    // informative while ensuring Start always reaches the actual broker.
    try {
      const status = await getRecRoomBrokerStatus();
      lastTransient = runtimeStatusDetail(status);
    } catch {
      // Keep the most recent broker error as the visible retry reason.
    }
    await delay(SESSION_CREATE_POLL_MS);
  }

  throw new Error(`RipoTeamServer could not start the Rec Room runtime within ten minutes. ${lastTransient}`);
}

export async function getRecRoomSession(sessionId: string, accessToken: string): Promise<RecRoomPlayResponse> {
  const response = await fetch(sessionPath(sessionId, accessToken), { cache: "no-store" });
  return parseJson<RecRoomPlayResponse>(response);
}

export async function releaseRecRoomSession(sessionId: string, accessToken: string): Promise<void> {
  const response = await fetch(`${sessionPath(sessionId)}/release?accessToken=${encodeURIComponent(accessToken)}`, {
    method: "POST",
    cache: "no-store",
    keepalive: true,
  });
  if (!response.ok && response.status !== 404) await parseJson(response);
}

export function releaseRecRoomSessionOnPageExit(sessionId: string, accessToken: string) {
  const url = `${sessionPath(sessionId)}/release?accessToken=${encodeURIComponent(accessToken)}`;
  try {
    void fetch(url, { method: "POST", cache: "no-store", keepalive: true, mode: "cors" });
  } catch {
    // Backend expiry remains the safety net.
  }
}

export async function requestRecRoomCapture(sessionId: string, accessToken: string): Promise<RecRoomCaptureResponse> {
  const response = await fetch(`${sessionPath(sessionId)}/captures?accessToken=${encodeURIComponent(accessToken)}`, { method: "POST", cache: "no-store" });
  return parseJson<RecRoomCaptureResponse>(response);
}

export async function getRecRoomCapture(sessionId: string, accessToken: string, captureId: string): Promise<RecRoomCaptureResponse> {
  const response = await fetch(`${sessionPath(sessionId)}/captures/${encodeURIComponent(captureId)}?accessToken=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
  return parseJson<RecRoomCaptureResponse>(response);
}

export async function downloadRecRoomCapture(sessionId: string, accessToken: string, captureId: string): Promise<Blob> {
  const response = await fetch(`${sessionPath(sessionId)}/captures/${encodeURIComponent(captureId)}/image?accessToken=${encodeURIComponent(accessToken)}`, { cache: "no-store" });
  if (!response.ok) await parseJson(response);
  return response.blob();
}
