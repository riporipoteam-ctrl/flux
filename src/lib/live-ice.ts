import { getFluxIceServers } from "@/lib/webrtc";

const OPEN_RELAY_HOST = "staticauth.openrelay.metered.ca";
const OPEN_RELAY_SECRET = "openrelayprojectsecret";

async function hmacSha1Base64(secret: string, message: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Secure Web Crypto is unavailable.");
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function openRelayServers(): Promise<RTCIceServer[]> {
  const expires = String(Math.floor(Date.now() / 1000) + 60 * 60);
  const credential = await hmacSha1Base64(OPEN_RELAY_SECRET, expires);
  return [
    {
      urls: [
        `turn:${OPEN_RELAY_HOST}:80?transport=udp`,
        `turn:${OPEN_RELAY_HOST}:80?transport=tcp`,
        `turn:${OPEN_RELAY_HOST}:443?transport=tcp`,
        `turns:${OPEN_RELAY_HOST}:443?transport=tcp`,
      ],
      username: expires,
      credential,
    },
  ];
}

export async function getReliableLiveIceServers(): Promise<RTCIceServer[]> {
  const configured = getFluxIceServers();
  const hasConfiguredTurn = configured.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => /^turns?:/i.test(url));
  });
  if (hasConfiguredTurn) return configured;
  try {
    return [...configured, ...await openRelayServers()];
  } catch (error) {
    console.warn("Flux could not prepare the TURN fallback", error);
    return configured;
  }
}

export async function createReliableLivePeer(): Promise<RTCPeerConnection> {
  return new RTCPeerConnection({
    iceServers: await getReliableLiveIceServers(),
    iceCandidatePoolSize: 8,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceTransportPolicy: "all",
  });
}

export async function limitLiveSender(sender: RTCRtpSender, viewerCount: number): Promise<void> {
  if (!sender.track || sender.track.kind !== "video") return;
  try {
    const parameters = sender.getParameters();
    if (!parameters.encodings?.length) parameters.encodings = [{}];
    parameters.encodings[0].maxBitrate = viewerCount >= 5 ? 550_000 : viewerCount >= 3 ? 750_000 : 1_150_000;
    parameters.encodings[0].maxFramerate = viewerCount >= 4 ? 20 : 24;
    await sender.setParameters(parameters);
  } catch (error) {
    console.warn("Flux could not tune the live sender", error);
  }
}
