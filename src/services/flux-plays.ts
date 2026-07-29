import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { stripUndefined } from "@/lib/firestore-safe";
import type { UserProfile } from "@/types";

export type FluxPlayMode = "sandbox" | "obby" | "hangout" | "adventure";

export interface FluxPlayGame {
  id: string;
  title: string;
  description: string;
  creatorUid: string | null;
  creatorName: string;
  creatorUsername?: string | null;
  thumbnailUrl: string;
  tags: string[];
  mode: FluxPlayMode;
  isOfficial: boolean;
  isPublic: boolean;
  allowBuild: boolean;
  plays: number;
  likes: number;
  activePlayers?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FluxWorldPlayer {
  uid: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  updatedAt?: unknown;
}

export interface FluxWorldBlock {
  id: string;
  x: number;
  y: number;
  z: number;
  color: string;
  material: "glass" | "metal" | "stone" | "grass";
  creatorUid: string;
  createdAt?: unknown;
}

const builtIn = (
  id: string,
  title: string,
  description: string,
  thumbnailUrl: string,
  tags: string[],
  mode: FluxPlayMode,
  plays: number,
  likes: number,
  allowBuild = false
): FluxPlayGame => ({
  id,
  title,
  description,
  creatorUid: null,
  creatorName: "Ripo Team",
  creatorUsername: "RipoTeam",
  thumbnailUrl,
  tags,
  mode,
  isOfficial: true,
  isPublic: true,
  allowBuild,
  plays,
  likes,
});

export const BUILTIN_FLUX_GAMES: FluxPlayGame[] = [
  builtIn(
    "flux-world",
    "Flux World",
    "A shared 3D social world. Explore, build together and make the world yours.",
    "/game-thumbs/flux-plays-hero.png",
    ["featured", "social", "building"],
    "sandbox",
    12840,
    2840,
    true
  ),
  builtIn(
    "sky-islands",
    "Sky Islands",
    "Leap between floating islands and discover hidden crystal portals.",
    "/game-thumbs/flux-farming-hero.png",
    ["adventure", "exploration"],
    "adventure",
    6280,
    1120
  ),
  builtIn(
    "neon-obby",
    "Neon Obby",
    "A fast, glowing obstacle course made for desktop and touch controls.",
    "/game-thumbs/FluxRecPoster.png",
    ["obby", "speedrun"],
    "obby",
    4820,
    941
  ),
  builtIn(
    "creator-plaza",
    "Creator Plaza",
    "Meet builders, test inventions and plan your next Flux Plays world.",
    "/game-thumbs/TE4HqcYfvEyd30tWPteUYQ.png",
    ["social", "creator"],
    "hangout",
    3470,
    702,
    true
  ),
];

function mapGame(id: string, data: Record<string, unknown>): FluxPlayGame {
  return {
    id,
    title: String(data.title || "Untitled World"),
    description: String(data.description || "A community-made Flux Plays world."),
    creatorUid: (data.creatorUid as string) || null,
    creatorName: String(data.creatorName || "Flux Creator"),
    creatorUsername: (data.creatorUsername as string) || null,
    thumbnailUrl: String(data.thumbnailUrl || "/game-thumbs/flux-plays-hero.png"),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : ["community"],
    mode: (data.mode as FluxPlayMode) || "sandbox",
    isOfficial: !!data.isOfficial,
    isPublic: data.isPublic !== false,
    allowBuild: data.allowBuild !== false,
    plays: Number(data.plays || 0),
    likes: Number(data.likes || 0),
    activePlayers: Number(data.activePlayers || 0),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listFluxPlayGames(max = 48): Promise<FluxPlayGame[]> {
  try {
    const snap = await getDocs(
      query(collection(db, "fluxPlayGames"), orderBy("plays", "desc"), limit(max))
    );
    const community = snap.docs
      .map((item) => mapGame(item.id, item.data()))
      .filter((game) => game.isPublic);
    return [...BUILTIN_FLUX_GAMES, ...community];
  } catch {
    try {
      const snap = await getDocs(query(collection(db, "fluxPlayGames"), limit(max)));
      return [
        ...BUILTIN_FLUX_GAMES,
        ...snap.docs
          .map((item) => mapGame(item.id, item.data()))
          .filter((game) => game.isPublic),
      ];
    } catch {
      return BUILTIN_FLUX_GAMES;
    }
  }
}

export async function getFluxPlayGame(gameId: string): Promise<FluxPlayGame | null> {
  const official = BUILTIN_FLUX_GAMES.find((game) => game.id === gameId);
  if (official) return official;
  try {
    const snap = await getDoc(doc(db, "fluxPlayGames", gameId));
    return snap.exists() ? mapGame(snap.id, snap.data()) : null;
  } catch {
    return null;
  }
}

export async function createFluxPlayGame(
  profile: UserProfile,
  input: {
    title: string;
    description: string;
    mode: FluxPlayMode;
    thumbnailUrl?: string;
    allowBuild?: boolean;
  }
): Promise<string> {
  const result = await addDoc(
    collection(db, "fluxPlayGames"),
    stripUndefined({
      title: input.title.trim(),
      description: input.description.trim(),
      creatorUid: profile.uid,
      creatorName: profile.displayName,
      creatorUsername: profile.username,
      thumbnailUrl: input.thumbnailUrl || "/game-thumbs/flux-plays-hero.png",
      tags: [input.mode, "community"],
      mode: input.mode,
      isOfficial: false,
      isPublic: true,
      allowBuild: input.allowBuild !== false,
      plays: 0,
      likes: 0,
      activePlayers: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return result.id;
}

export async function registerFluxPlay(gameId: string): Promise<void> {
  if (BUILTIN_FLUX_GAMES.some((game) => game.id === gameId)) return;
  try {
    await updateDoc(doc(db, "fluxPlayGames", gameId), {
      plays: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // A launch should never be blocked by analytics.
  }
}

export function fluxPlayerColor(uid: string): string {
  const colors = ["#6d5dfc", "#0ea5e9", "#ec4899", "#22c55e", "#f59e0b", "#14b8a6"];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

export async function joinFluxWorld(
  gameId: string,
  profile: UserProfile,
  position?: Partial<Pick<FluxWorldPlayer, "x" | "y" | "z" | "yaw">>
): Promise<void> {
  await setDoc(
    doc(db, "fluxPlayWorlds", gameId, "players", profile.uid),
    stripUndefined({
      uid: profile.uid,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      color: fluxPlayerColor(profile.uid),
      x: position?.x ?? 0,
      y: position?.y ?? 1.1,
      z: position?.z ?? 4,
      yaw: position?.yaw ?? 0,
      updatedAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

export async function updateFluxWorldPlayer(
  gameId: string,
  uid: string,
  position: Pick<FluxWorldPlayer, "x" | "y" | "z" | "yaw">
): Promise<void> {
  await updateDoc(doc(db, "fluxPlayWorlds", gameId, "players", uid), {
    ...position,
    updatedAt: serverTimestamp(),
  });
}

export async function leaveFluxWorld(gameId: string, uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "fluxPlayWorlds", gameId, "players", uid));
  } catch {
    // Best effort presence cleanup.
  }
}

export function subscribeFluxWorldPlayers(
  gameId: string,
  onPlayers: (players: FluxWorldPlayer[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "fluxPlayWorlds", gameId, "players"),
    (snapshot) => {
      onPlayers(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            uid: item.id,
            username: data.username || "player",
            displayName: data.displayName || "Player",
            avatarUrl: data.avatarUrl || null,
            color: data.color || "#6d5dfc",
            x: Number(data.x || 0),
            y: Number(data.y || 1.1),
            z: Number(data.z || 0),
            yaw: Number(data.yaw || 0),
            updatedAt: data.updatedAt,
          } satisfies FluxWorldPlayer;
        })
      );
    },
    () => onPlayers([])
  );
}

export function subscribeFluxWorldBlocks(
  gameId: string,
  onBlocks: (blocks: FluxWorldBlock[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, "fluxPlayWorlds", gameId, "blocks"),
    (snapshot) => {
      onBlocks(
        snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            x: Number(data.x || 0),
            y: Number(data.y || 0.5),
            z: Number(data.z || 0),
            color: data.color || "#6d5dfc",
            material: data.material || "glass",
            creatorUid: data.creatorUid || "",
            createdAt: data.createdAt,
          } satisfies FluxWorldBlock;
        })
      );
    },
    () => onBlocks([])
  );
}

function blockId(x: number, y: number, z: number): string {
  const safe = (value: number) => String(Math.round(value * 2)).replace("-", "n");
  return `${safe(x)}_${safe(y)}_${safe(z)}`;
}

export async function placeFluxWorldBlock(
  gameId: string,
  block: Omit<FluxWorldBlock, "id" | "createdAt">
): Promise<void> {
  const id = blockId(block.x, block.y, block.z);
  await setDoc(
    doc(db, "fluxPlayWorlds", gameId, "blocks", id),
    stripUndefined({ ...block, createdAt: serverTimestamp() }),
    { merge: true }
  );
}

export async function removeFluxWorldBlock(gameId: string, blockIdValue: string): Promise<void> {
  await deleteDoc(doc(db, "fluxPlayWorlds", gameId, "blocks", blockIdValue));
}
