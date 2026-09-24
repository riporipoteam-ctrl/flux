/**
 * Flux Rec room data.
 *
 * `fetchFluxRecRooms` tries the live game API first and falls back to the
 * bundled catalog so the page always renders, even offline.
 */

export interface FluxRecRoomPhoto {
  id: string;
  caption: string;
  author: string;
  /** CSS gradient used as the photo thumbnail (real photos come from the game later). */
  gradient: string;
}

export interface FluxRecRoom {
  id: string;
  name: string;
  description: string;
  visits: number;
  cheers: number;
  playersNow: number;
  maxPlayers: number;
  tags: string[];
  isRRO: boolean;
  gradient: string;
  photos: FluxRecRoomPhoto[];
}

const G = (a: string, b: string) => `linear-gradient(135deg, ${a}, ${b})`;

export const FLUX_REC_ROOMS: FluxRecRoom[] = [
  {
    id: "rec-center",
    name: "Rec Center",
    description:
      "The social hub of Flux Rec. Meet players, browse the store, check challenges and hop into any game from here.",
    visits: 128400, cheers: 45200, playersNow: 312, maxPlayers: 40,
    tags: ["Social", "Hub"], isRRO: true,
    gradient: G("#f97316", "#fbbf24"),
    photos: [
      { id: "rc-1", caption: "Sunset at the Rec Center doors", author: "@ripo6000", gradient: G("#fb923c", "#f43f5e") },
      { id: "rc-2", caption: "Squad night", author: "@fluxfan", gradient: G("#fbbf24", "#f97316") },
      { id: "rc-3", caption: "New fit check", author: "@pixelpete", gradient: G("#f59e0b", "#ef4444") },
    ],
  },
  {
    id: "paintball",
    name: "Paintball",
    description:
      "Classic team paintball. Capture the flag, defend your base and cover your teammates in paint.",
    visits: 96400, cheers: 31100, playersNow: 148, maxPlayers: 12,
    tags: ["PvP", "Shooter"], isRRO: true,
    gradient: G("#16a34a", "#65a30d"),
    photos: [
      { id: "pb-1", caption: "Last-second flag capture!", author: "@sharpshooter", gradient: G("#22c55e", "#166534") },
      { id: "pb-2", caption: "Defending the fort", author: "@ripo6000", gradient: G("#4ade80", "#15803d") },
    ],
  },
  {
    id: "laser-tag",
    name: "Laser Tag",
    description:
      "Fast arena laser tag with power-ups. Low gravity zones, teleporters and pure chaos.",
    visits: 88100, cheers: 28900, playersNow: 121, maxPlayers: 12,
    tags: ["PvP", "Arena"], isRRO: true,
    gradient: G("#7c3aed", "#2563eb"),
    photos: [
      { id: "lt-1", caption: "Neon arena vibes", author: "@neoninja", gradient: G("#8b5cf6", "#3b82f6") },
      { id: "lt-2", caption: "Triple tag streak", author: "@fluxfan", gradient: G("#6d28d9", "#1d4ed8") },
    ],
  },
  {
    id: "dodgeball",
    name: "Dodgeball",
    description:
      "Dodge, duck, dip, dive and dodge. Eliminate the other team one throw at a time.",
    visits: 74200, cheers: 24600, playersNow: 96, maxPlayers: 10,
    tags: ["PvP", "Sports"], isRRO: true,
    gradient: G("#ef4444", "#f97316"),
    photos: [
      { id: "db-1", caption: "Dodge of the century", author: "@pixelpete", gradient: G("#f87171", "#fb923c") },
    ],
  },
  {
    id: "golden-trophy",
    name: "Quest for the Golden Trophy",
    description:
      "Team up for a co-op dungeon crawl through goblins, traps and bosses to claim the Golden Trophy.",
    visits: 69800, cheers: 27400, playersNow: 84, maxPlayers: 4,
    tags: ["Co-op", "Quest"], isRRO: true,
    gradient: G("#b45309", "#fbbf24"),
    photos: [
      { id: "gt-1", caption: "Boss down, trophy ours", author: "@ripo6000", gradient: G("#d97706", "#fde68a") },
      { id: "gt-2", caption: "Full squad clear", author: "@dungeoneer", gradient: G("#92400e", "#f59e0b") },
    ],
  },
  {
    id: "rec-rally",
    name: "Rec Rally",
    description:
      "Six-player off-road rally racing. Boost, bump and powerslide your way to the finish line.",
    visits: 41500, cheers: 15200, playersNow: 47, maxPlayers: 6,
    tags: ["Racing", "PvP"], isRRO: true,
    gradient: G("#0ea5e9", "#22d3ee"),
    photos: [
      { id: "rr-1", caption: "Photo finish!", author: "@speedster", gradient: G("#38bdf8", "#22d3ee") },
    ],
  },
  {
    id: "charades",
    name: "3D Charades",
    description:
      "Act it out with the maker pen in 3D while your team guesses. Hilarious every single time.",
    visits: 38900, cheers: 16800, playersNow: 38, maxPlayers: 10,
    tags: ["Party", "Social"], isRRO: true,
    gradient: G("#ec4899", "#8b5cf6"),
    photos: [
      { id: "ch-1", caption: "How was this a toaster??", author: "@fluxfan", gradient: G("#f472b6", "#a78bfa") },
    ],
  },
  {
    id: "showdown",
    name: "Showdown",
    description:
      "Wild west quick-draw duels. Face off at high noon — fastest draw wins the street.",
    visits: 21400, cheers: 9800, playersNow: 22, maxPlayers: 8,
    tags: ["PvP", "Western"], isRRO: true,
    gradient: G("#78350f", "#dc2626"),
    photos: [
      { id: "sd-1", caption: "High noon standoff", author: "@ripo6000", gradient: G("#92400e", "#ef4444") },
    ],
  },
  {
    id: "disc-golf",
    name: "Disc Golf",
    description:
      "Chill 18-hole disc golf across floating islands. Perfect for hanging out and talking.",
    visits: 18700, cheers: 7400, playersNow: 15, maxPlayers: 8,
    tags: ["Sports", "Chill"], isRRO: true,
    gradient: G("#059669", "#34d399"),
    photos: [],
  },
];

const GAME_API = "https://api.ripo-ripoteam.workers.dev";

/** Try the live game API; always resolves to the bundled catalog on any failure. */
export async function fetchFluxRecRooms(): Promise<FluxRecRoom[]> {
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${GAME_API}/api/rooms/v1/featured`, { signal: ctrl.signal });
    window.clearTimeout(timer);
    if (!res.ok) return FLUX_REC_ROOMS;
    const data = await res.json();
    const list = Array.isArray(data) ? data : data?.rooms;
    if (!Array.isArray(list) || list.length === 0) return FLUX_REC_ROOMS;
    return list.map((r: Record<string, unknown>, i: number) => ({
      id: String(r.id ?? r.RoomId ?? `room-${i}`),
      name: String(r.name ?? r.Name ?? "Untitled room"),
      description: String(r.description ?? r.Description ?? "A Flux Rec room."),
      visits: Number(r.visits ?? r.VisitCount ?? 0),
      cheers: Number(r.cheers ?? r.CheerCount ?? 0),
      playersNow: Number(r.playersNow ?? r.CurrentPlayers ?? 0),
      maxPlayers: Number(r.maxPlayers ?? r.MaxPlayers ?? 12),
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      isRRO: Boolean(r.isRRO ?? true),
      gradient: G("#1d9bf0", "#7c3aed"),
      photos: [],
    }));
  } catch {
    return FLUX_REC_ROOMS;
  }
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}
