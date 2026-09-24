/**
 * Flux Rec ↔ Flux Social pairing client.
 *
 * Talks to the accounts worker's Flux Social endpoints:
 *   POST {base}/fluxsocial/exchange { code }        → website session token
 *   GET  {base}/fluxsocial/me        (Bearer token) → linked account + privacy
 *   GET  {base}/fluxsocial/status    (Bearer token) → { linked, privacy }
 *   POST {base}/fluxsocial/unlink    (Bearer token) → revoke session
 *   GET  {base}/fluxsocial/privacy   (Bearer token) → visibility toggles
 *   POST {base}/fluxsocial/privacy   (Bearer token) → update visibility toggles
 *
 * The accounts worker base URL comes from NEXT_PUBLIC_FLUXREC_API.
 * The session token is kept in localStorage — it's an opaque, server-revocable
 * session (unlink kills it instantly), so no cookies/CSRF dance needed.
 */

export interface FluxSocialPrivacy {
  showProfile: boolean;
  showRooms: boolean;
  showPhotos: boolean;
  showInventions: boolean;
}

export interface FluxSocialLinkedAccount {
  accountId: number;
  username: string;
  displayName: string;
  profileImage?: string | null;
  privacy: FluxSocialPrivacy;
}

export interface FluxSocialExchangeResult {
  token: string;
  accountId: number;
  username: string;
  displayName: string;
  linkedAt: string;
}

/** Machine-readable pairing failure reason. */
export type FluxPairingErrorCode =
  | "not_configured" // NEXT_PUBLIC_FLUXREC_API missing
  | "bad_code" // 400 — unknown or malformed code
  | "expired_code" // 410 — code expired (single-use, 10 min TTL)
  | "throttled" // 429 — too many exchange attempts from this IP
  | "unauthorized" // 401 — session revoked/expired/invalid
  | "network" // fetch threw or backend unreachable
  | "server"; // other unexpected status

export class FluxPairingError extends Error {
  readonly code: FluxPairingErrorCode;
  readonly status: number | null;

  constructor(code: FluxPairingErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = "FluxPairingError";
    this.code = code;
    this.status = status;
  }
}

export const FLUX_TOKEN_STORAGE_KEY = "fluxrec.link.token";
/** Legacy key from the simulation era — stores the raw code, migrated away. */
const LEGACY_CODE_STORAGE_KEY = "fluxrec.linked";

/** Accounts worker base URL, e.g. https://accounts.fluxrec.net — no trailing slash. */
export function getFluxRecApiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_FLUXREC_API?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function requireBase(): string {
  const base = getFluxRecApiBase();
  if (!base) {
    throw new FluxPairingError(
      "not_configured",
      "The Flux Rec backend isn't configured yet (NEXT_PUBLIC_FLUXREC_API). Linking ships with the backend update."
    );
  }
  return base;
}

function mapHttpError(status: number, context: "exchange" | "session"): FluxPairingError {
  if (context === "exchange") {
    if (status === 400) {
      return new FluxPairingError(
        "bad_code",
        "That code wasn't recognized. Check the 6-digit code in-game (Settings → Connect Flux account) and try again.",
        status
      );
    }
    if (status === 410) {
      return new FluxPairingError(
        "expired_code",
        "This code expired. Generate a fresh one in Flux Rec (Settings → Connect Flux account).",
        status
      );
    }
    if (status === 429) {
      return new FluxPairingError(
        "throttled",
        "Too many attempts — wait a minute and try again.",
        status
      );
    }
  }
  if (status === 401) {
    return new FluxPairingError(
      "unauthorized",
      "This Flux session is no longer valid. Link again with a fresh in-game code.",
      status
    );
  }
  return new FluxPairingError("server", "The Flux Rec backend returned an unexpected response. Try again in a bit.", status);
}

async function request<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; context: "exchange" | "session" }
): Promise<T> {
  const base = requireBase();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new FluxPairingError(
      "network",
      "Couldn't reach the Flux Rec backend. Check your connection and try again."
    );
  }
  if (!res.ok) throw mapHttpError(res.status, opts.context);
  return (await res.json()) as T;
}

/**
 * Exchange the 6-digit in-game pairing code for a website session token.
 * The code is single-use — it burns whether it succeeds or was expired.
 */
export async function exchangePairingCode(code: string): Promise<FluxSocialExchangeResult> {
  const clean = code.trim();
  if (!/^\d{6}$/.test(clean)) {
    throw new FluxPairingError(
      "bad_code",
      "Enter the 6-digit code shown in the game (Settings → Connect Flux account)."
    );
  }
  return request<FluxSocialExchangeResult>("/fluxsocial/exchange", {
    method: "POST",
    body: { code: clean },
    context: "exchange",
  });
}

/** Validate the stored session token — call on page load. */
export async function getFluxSocialMe(token: string): Promise<FluxSocialLinkedAccount> {
  return request<FluxSocialLinkedAccount>("/fluxsocial/me", {
    token,
    context: "session",
  });
}

/** Lightweight link status (accepts either game JWT or website token). */
export async function getFluxSocialStatus(token: string): Promise<{ linked: boolean; privacy: FluxSocialPrivacy }> {
  return request("/fluxsocial/status", { token, context: "session" });
}

/** Revoke the website session — instant, idempotent. */
export async function unlinkFluxSocial(token: string): Promise<void> {
  await request<{ success: boolean }>("/fluxsocial/unlink", {
    method: "POST",
    token,
    context: "session",
  });
}

export async function getFluxSocialPrivacy(token: string): Promise<FluxSocialPrivacy> {
  return request<FluxSocialPrivacy>("/fluxsocial/privacy", { token, context: "session" });
}

export async function updateFluxSocialPrivacy(
  token: string,
  patch: Partial<FluxSocialPrivacy>
): Promise<FluxSocialPrivacy> {
  return request<FluxSocialPrivacy>("/fluxsocial/privacy", {
    method: "POST",
    token,
    body: patch,
    context: "session",
  });
}

// ---- localStorage helpers ----------------------------------------------------

function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function readStoredFluxToken(): string | null {
  if (!storageAvailable()) return null;
  try {
    // Clean up the simulation-era key on the way through.
    const legacy = window.localStorage.getItem(LEGACY_CODE_STORAGE_KEY);
    if (legacy) window.localStorage.removeItem(LEGACY_CODE_STORAGE_KEY);
    return window.localStorage.getItem(FLUX_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeFluxToken(token: string): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(FLUX_TOKEN_STORAGE_KEY, token);
    window.localStorage.removeItem(LEGACY_CODE_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function clearStoredFluxToken(): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(FLUX_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CODE_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}
