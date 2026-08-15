import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

const TARGET_BUILD_DATE = "2022-05-19";
const TARGET_BUILD_ID = "8751857";
const TARGET_MANIFEST_ID = "6337851004861751095";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_EMAIL = "ripo.ripoteam@gmail.com";

type FluxIdentity = {
  uid: string;
  email: string | null;
  displayName: string;
  username: string;
  accountId: number;
  isAdmin: boolean;
};

function stableAccountId(uid: string): number {
  const digest = createHash("sha256").update(uid).digest();
  return 100_000 + (digest.readUInt32BE(0) % 899_000_000);
}

function sessionHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function bearer(value: string | undefined): string {
  if (!value?.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
}

function usernameFromToken(token: DecodedIdToken): string {
  const stem = token.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "") || "player";
  return stem.slice(0, 20) || "player";
}

async function ensureFluxPlayer(token: DecodedIdToken): Promise<FluxIdentity> {
  const db = getFirestore();
  const ref = db.collection("recroomPlayers").doc(token.uid);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() || {} : {};
  const email = token.email || null;
  const accountId = Number(existing.accountId) || stableAccountId(token.uid);
  const username = String(existing.username || usernameFromToken(token)).slice(0, 20);
  const displayName = String(existing.displayName || token.name || username).slice(0, 32);
  const isAdmin = email?.toLowerCase() === ADMIN_EMAIL;

  await ref.set({
    accountId,
    username,
    displayName,
    email,
    isAdmin,
    level: Number(existing.level) || 1,
    xp: Number(existing.xp) || 0,
    tokens: existing.tokens == null ? 500 : Number(existing.tokens),
    updatedAt: FieldValue.serverTimestamp(),
    ...(snap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  }, { merge: true });

  return { uid: token.uid, email, displayName, username, accountId, isAdmin };
}

async function createGameSession(identity: FluxIdentity) {
  const db = getFirestore();
  const token = randomBytes(32).toString("base64url");
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  await db.collection("recroomSessions").doc(sessionHash(token)).set({
    uid: identity.uid,
    accountId: identity.accountId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs,
  });
  return { token, expiresAtMs };
}

async function identityFromSession(raw: string): Promise<FluxIdentity | null> {
  if (!raw) return null;
  const db = getFirestore();
  const session = await db.collection("recroomSessions").doc(sessionHash(raw)).get();
  if (!session.exists) return null;
  const sessionData = session.data() || {};
  if (Number(sessionData.expiresAtMs) < Date.now()) return null;
  const uid = String(sessionData.uid || "");
  if (!uid) return null;
  const player = await db.collection("recroomPlayers").doc(uid).get();
  if (!player.exists) return null;
  const data = player.data() || {};
  return {
    uid,
    email: typeof data.email === "string" ? data.email : null,
    displayName: String(data.displayName || data.username || "Flux player"),
    username: String(data.username || "player"),
    accountId: Number(data.accountId) || stableAccountId(uid),
    isAdmin: Boolean(data.isAdmin),
  };
}

async function playerState(uid: string): Promise<Record<string, unknown>> {
  const snap = await getFirestore().collection("recroomPlayers").doc(uid).get();
  return snap.exists ? (snap.data() || {}) : {};
}

async function savePlayerState(uid: string, patch: Record<string, unknown>) {
  const allowed = new Set([
    "displayName", "username", "level", "xp", "tokens", "outfit", "settings",
    "inventory", "dormRoomId", "avatar", "avatarCustomization", "lastRoomId",
  ]);
  const safe = Object.fromEntries(Object.entries(patch).filter(([key]) => allowed.has(key)));
  await getFirestore().collection("recroomPlayers").doc(uid).set({
    ...safe,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return safe;
}

function accountShape(identity: FluxIdentity, state: Record<string, unknown> = {}) {
  const createdAt = state.createdAt instanceof Timestamp ? state.createdAt.toDate().toISOString() : null;
  return {
    uid: identity.uid,
    accountId: identity.accountId,
    username: identity.username,
    displayName: identity.displayName,
    profileImage: "",
    junior: false,
    platforms: ["Steam"],
    createdAt,
    isAdmin: identity.isAdmin,
    level: Number(state.level) || 1,
    xp: Number(state.xp) || 0,
    tokens: state.tokens == null ? 500 : Number(state.tokens),
  };
}

function runtimeConfig() {
  return {
    service: "Flux Rec Room compatibility gateway",
    buildDate: TARGET_BUILD_DATE,
    buildId: TARGET_BUILD_ID,
    manifestId: TARGET_MANIFEST_ID,
    photon: {
      configured: Boolean(process.env.RECROOM_PHOTON_APP_ID),
      appVersion: process.env.RECROOM_PHOTON_APP_VERSION || "flux-recroom-2022",
      region: process.env.RECROOM_PHOTON_REGION || "eu",
    },
  };
}

function normalizedPath(rawUrl: string): string {
  const pathname = new URL(rawUrl, "https://flux.invalid").pathname;
  // Cloud Functions may expose either /<route> or /recroomGateway/<route>
  return pathname.replace(/^\/recroomGateway(?=\/|$)/, "") || "/";
}

export const recroomGateway = onRequest({
  region: "europe-west1",
  cors: true,
  timeoutSeconds: 60,
  memory: "512MiB",
  maxInstances: 20,
}, async (request, response) => {
  response.set("Cache-Control", "no-store");
  response.set("X-Flux-RecRoom-Build", TARGET_BUILD_ID);
  const path = normalizedPath(request.originalUrl || request.url);
  const method = request.method.toUpperCase();

  try {
    if ((path === "/" || path === "/flux/health") && (method === "GET" || method === "HEAD")) {
      response.status(200).json({ ok: true, now: new Date().toISOString(), ...runtimeConfig() });
      return;
    }
    if (path === "/flux/config" && method === "GET") {
      response.json(runtimeConfig());
      return;
    }

    if (path === "/flux/auth/firebase" && method === "POST") {
      const body = (request.body || {}) as { idToken?: string };
      const idToken = String(body.idToken || bearer(request.headers.authorization));
      if (!idToken) {
        response.status(400).json({ ok: false, error: "Firebase ID token required" });
        return;
      }
      const decoded = await getAuth().verifyIdToken(idToken, true);
      const identity = await ensureFluxPlayer(decoded);
      const session = await createGameSession(identity);
      response.json({
        ok: true,
        uid: identity.uid,
        sessionToken: session.token,
        expiresAtMs: session.expiresAtMs,
        account: accountShape(identity, await playerState(identity.uid)),
      });
      return;
    }

    const sessionToken = bearer(request.headers.authorization);
    const identity = await identityFromSession(sessionToken);
    if (!identity) {
      response.status(401).json({ ok: false, error: "Flux Rec Room session is missing or expired" });
      return;
    }

    if (path === "/flux/player/state" && method === "GET") {
      const state = await playerState(identity.uid);
      response.json({ ok: true, account: accountShape(identity, state), state });
      return;
    }
    if (path === "/flux/player/state" && (method === "PATCH" || method === "POST")) {
      const patch = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
      response.json({ ok: true, saved: await savePlayerState(identity.uid, patch) });
      return;
    }

    if (path === "/api/config/v2" && method === "GET") {
      response.json({ Environment: "Flux", BuildId: TARGET_BUILD_ID, BuildDate: TARGET_BUILD_DATE, AllowUnsupportedVersion: true });
      return;
    }

    if (path === "/Accounts/account/me" && method === "GET") {
      response.json(accountShape(identity, await playerState(identity.uid)));
      return;
    }
    if (path === "/Accounts/account/bulk" && method === "GET") {
      response.json([accountShape(identity, await playerState(identity.uid))]);
      return;
    }

    if (path === "/Matchmaking/player/login" && method === "POST") {
      response.json({ success: true, accountId: identity.accountId, playerId: identity.accountId, statusVisibility: 0, platform: "Steam" });
      return;
    }
    if (path === "/Matchmaking/player/logout" && method === "POST") {
      response.json({ success: true });
      return;
    }
    if (path === "/Matchmaking/player/heartbeat" && method === "POST") {
      response.json({ success: true, playerId: identity.accountId, serverTime: Date.now() });
      return;
    }
    if (path === "/Matchmaking/player" && method === "GET") {
      response.json({ accountId: identity.accountId, playerId: identity.accountId, isOnline: true });
      return;
    }

    if (path === "/Room_server/dormroom/me" && method === "GET") {
      const state = await playerState(identity.uid);
      const roomId = Number(state.dormRoomId) || identity.accountId + 1_000_000_000;
      response.json({
        RoomId: roomId,
        Name: `DormRoom_${identity.accountId}`,
        Description: "Flux private dorm room",
        CreatorAccountId: identity.accountId,
        IsDormRoom: true,
        MaxPlayerCalculationMode: 0,
        MaxPlayers: 1,
        Accessibility: 1,
        SupportsScreens: true,
        SupportsWalkVR: true,
        SupportsTeleportVR: true,
      });
      return;
    }

    if (path === "/Room_server/photon_access_token" && method === "GET") {
      const appId = process.env.RECROOM_PHOTON_APP_ID || "";
      if (!appId) {
        response.status(503).json({ error: "Photon is not configured on this deployment", code: "PHOTON_NOT_CONFIGURED" });
        return;
      }
      response.json({
        AppId: appId,
        AppVersion: process.env.RECROOM_PHOTON_APP_VERSION || "flux-recroom-2022",
        Region: process.env.RECROOM_PHOTON_REGION || "eu",
        UserId: String(identity.accountId),
        Token: "",
      });
      return;
    }

    if (path === "/Matchmaking/matchmake/dorm" && method === "POST") {
      response.json({
        success: true,
        roomId: identity.accountId + 1_000_000_000,
        roomInstanceId: `flux-dorm-${identity.accountId}`,
        photon: {
          configured: Boolean(process.env.RECROOM_PHOTON_APP_ID),
          region: process.env.RECROOM_PHOTON_REGION || "eu",
        },
      });
      return;
    }

    const emptyArrayRoutes = new Set([
      "/api/relationships/v2/get",
      "/api/messages/v2/get",
      "/Room_server/featuredrooms/current",
      "/Room_server/rooms/hot",
      "/Room_server/rooms/ownedby/me",
      "/Room_server/rooms/visitedby/me",
      "/api/rooms/v1/filters",
      "/api/inventions/v2/mine",
      "/outfits/me/saved",
      "/clubs/club/mine/member",
      "/clubs/subscription/mine/member",
      "/Commerce/api/catalog/v1/all",
      "/api/gameconfigs/v1/all",
      "/api/playerevents/v1/all",
    ]);
    if (emptyArrayRoutes.has(path) && method === "GET") {
      response.json([]);
      return;
    }
    if (path === "/api/communityboard/v2/current" && method === "GET") {
      response.json({ entries: [] });
      return;
    }
    if (path === "/api/sanitize/v1/isPure" && method === "GET") {
      response.json({ isPure: true });
      return;
    }
    if (path === "/api/sanitize/v1" && method === "POST") {
      response.json(request.body || {});
      return;
    }

    const traceId = randomUUID();
    console.warn("Unimplemented Rec Room 2022 endpoint", {
      traceId,
      method,
      path,
      query: request.query,
      contentType: request.headers["content-type"],
    });
    response.set("X-Flux-Trace-Id", traceId).status(501).json({
      ok: false,
      error: "Rec Room 2022 compatibility endpoint not implemented yet",
      traceId,
      method,
      path,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const lowered = message.toLowerCase();
    const authFailure = lowered.includes("id token") || lowered.includes("auth/") || lowered.includes("token has") || lowered.includes("expired");
    if (!authFailure) console.error("Rec Room gateway request failed", { method, path, error });
    response.status(authFailure ? 401 : 500).json({ ok: false, error: authFailure ? "Flux authentication failed." : "Rec Room gateway request failed." });
  }
});
