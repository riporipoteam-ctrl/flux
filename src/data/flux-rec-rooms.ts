/**
 * Flux Rec room data — REAL data from the game backend.
 *
 * Public rooms come from the rooms worker:
 *   GET https://rooms.ripo-ripoteam.workers.dev/rooms/hot
 * Room thumbnails resolve against the img worker:
 *   https://img.ripo-ripoteam.workers.dev/{ImageName}
 *
 * When a Flux Social account is linked to a Flux Rec game account, the
 * accounts worker serves the player's own rooms and photos:
 *   GET {base}/fluxsocial/rooms  (Bearer website session token)
 *   GET {base}/fluxsocial/photos (Bearer website session token)
 */

import { getFluxRecApiBase } from "@/services/fluxrec-pairing";

export interface FluxRecRoom {
  id: string;
  roomId: number;
  name: string;
  description: string;
  imageUrl: string | null;
  maxPlayers: number;
  isRRO: boolean;
  tags: string[];
  visits: number;
  cheers: number;
  favorites: number;
}

export interface FluxRecPhoto {
  id: string;
  url: string;
  caption: string;
  createdAt?: string | null;
}

const ROOMS_API = "https://rooms.ripo-ripoteam.workers.dev";
const IMG_API = "https://img.ripo-ripoteam.workers.dev";

function toRoom(r: Record<string, unknown>): FluxRecRoom {
  const roomId = Number(r.RoomId ?? r.roomId ?? r.id ?? 0);
  const imageName = String(r.ImageName ?? r.imageName ?? "");
  const rawTags = (r.Tags ?? r.tags ?? []) as Array<{ Tag?: string } | string>;
  const tags = rawTags
    .map((t) => (typeof t === "string" ? t : t.Tag ?? ""))
    .filter((t) => t && t.toLowerCase() !== "rro");
  const stats = (r.Stats ?? r.stats ?? {}) as Record<string, unknown>;
  return {
    id: String(roomId || r.id || Math.random().toString(36).slice(2)),
    roomId,
    name: String(r.Name ?? r.name ?? "Untitled room"),
    description: String(r.Description ?? r.description ?? ""),
    imageUrl: imageName ? `${IMG_API}/${imageName}` : null,
    maxPlayers: Number(r.MaxPlayers ?? r.maxPlayers ?? 0),
    isRRO: Boolean(r.IsRRO ?? r.isRRO ?? false),
    tags,
    visits: Number(stats.VisitCount ?? stats.visitCount ?? 0),
    cheers: Number(stats.CheerCount ?? stats.cheerCount ?? 0),
    favorites: Number(stats.FavoriteCount ?? stats.favoriteCount ?? 0),
  };
}

/** Public Flux Rec rooms — live from the game backend. */
export async function fetchFluxRecRooms(): Promise<FluxRecRoom[]> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${ROOMS_API}/rooms/hot`, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.Results ?? data?.rooms ?? [];
    if (!Array.isArray(list)) return [];
    return list.map(toRoom);
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

async function authedGet<T>(path: string, token: string): Promise<T | null> {
  const base = getFluxRecApiBase();
  if (!base) return null;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function pickList(data: unknown, keys: string[]): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const k of keys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v)) return v as Array<Record<string, unknown>>;
    }
  }
  return [];
}

/** The linked game account's own rooms. */
export async function fetchLinkedRooms(token: string): Promise<FluxRecRoom[]> {
  const data = await authedGet<unknown>("/fluxsocial/rooms", token);
  return pickList(data, ["rooms", "Rooms", "results", "Results"]).map(toRoom);
}

/** Photos the linked game account took in game. */
export async function fetchLinkedPhotos(token: string): Promise<FluxRecPhoto[]> {
  const data = await authedGet<unknown>("/fluxsocial/photos", token);
  return pickList(data, ["photos", "Photos", "results", "Results"]).map(
    (p, i) => ({
      id: String(p.id ?? p.Id ?? p.photoId ?? `photo-${i}`),
      url: String(
        p.url ?? p.Url ?? p.imageUrl ?? p.ImageUrl ?? p.src ?? ""
      ),
      caption: String(p.caption ?? p.Caption ?? p.title ?? p.Title ?? ""),
      createdAt: (p.createdAt ?? p.CreatedAt ?? null) as string | null,
    })
  ).filter((p) => p.url);
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
