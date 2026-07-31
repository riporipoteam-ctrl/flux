import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type GeneratedProjectKind = "game" | "website";
export type StudioObjectType = "rectangle" | "circle" | "text" | "button" | "image";

export interface StudioSceneObject {
  id: string;
  type: StudioObjectType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  text: string;
  textColor: string;
  fontSize: number;
  borderRadius: number;
  opacity: number;
  imageUrl?: string;
  locked?: boolean;
  hidden?: boolean;
}

export interface StudioScene {
  background: string;
  width: number;
  height: number;
  objects: StudioSceneObject[];
}

export interface StudioRevision {
  id: string;
  label: string;
  code: string;
  scene?: StudioScene;
  createdAt: number;
}

export interface StudioAssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface GeneratedProject {
  id: string;
  ownerId: string;
  kind: GeneratedProjectKind;
  title: string;
  description: string;
  hashtags: string[];
  code: string;
  thumbnail: string;
  thumbnailFileName?: string | null;
  multiplayer: boolean;
  maxPlayers: number;
  selectedAssetIds: string[];
  assistantHistory?: StudioAssistantMessage[];
  revisions?: StudioRevision[];
  scene?: StudioScene;
  createdAt: number;
  updatedAt: number;
  publishedId?: string | null;
}

export interface PublishedCommunityGame {
  id: string;
  authorId: string;
  title: string;
  description: string;
  hashtags: string[];
  code: string;
  thumbnail: string;
  multiplayer: boolean;
  maxPlayers: number;
  visits: number;
  cheers: number;
  createdAt: unknown;
  updatedAt: unknown;
}

const STORAGE_KEY = "flux-studio-projects-v2";

function browserStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function createDefaultScene(): StudioScene {
  return {
    background: "#0b1020",
    width: 960,
    height: 540,
    objects: [
      {
        id: `text-${Date.now()}`,
        type: "text",
        name: "Title",
        x: 220,
        y: 92,
        width: 520,
        height: 80,
        rotation: 0,
        fill: "transparent",
        text: "My Flux Game",
        textColor: "#ffffff",
        fontSize: 48,
        borderRadius: 0,
        opacity: 1,
      },
      {
        id: `button-${Date.now() + 1}`,
        type: "button",
        name: "Play button",
        x: 350,
        y: 380,
        width: 260,
        height: 72,
        rotation: 0,
        fill: "#ffffff",
        text: "Play",
        textColor: "#111111",
        fontSize: 24,
        borderRadius: 36,
        opacity: 1,
      },
    ],
  };
}

function normalizeObject(value: StudioSceneObject, index: number): StudioSceneObject {
  const type: StudioObjectType = ["rectangle", "circle", "text", "button", "image"].includes(value.type) ? value.type : "rectangle";
  return {
    id: value.id || `object-${Date.now()}-${index}`,
    type,
    name: value.name || `${type} ${index + 1}`,
    x: clamp(Number(value.x || 0), 0, 1920),
    y: clamp(Number(value.y || 0), 0, 1080),
    width: clamp(Number(value.width || 120), 20, 1920),
    height: clamp(Number(value.height || 80), 12, 1080),
    rotation: clamp(Number(value.rotation || 0), -180, 180),
    fill: value.fill || "#ffffff",
    text: value.text || "",
    textColor: value.textColor || "#111111",
    fontSize: clamp(Number(value.fontSize || 20), 8, 160),
    borderRadius: clamp(Number(value.borderRadius || 0), 0, 500),
    opacity: clamp(Number(value.opacity ?? 1), .1, 1),
    imageUrl: value.imageUrl || "",
    locked: value.locked === true,
    hidden: value.hidden === true,
  };
}

function normalizeScene(scene?: StudioScene): StudioScene {
  const fallback = createDefaultScene();
  if (!scene) return fallback;
  return {
    background: scene.background || fallback.background,
    width: clamp(Number(scene.width || 960), 320, 1920),
    height: clamp(Number(scene.height || 540), 240, 1080),
    objects: Array.isArray(scene.objects) ? scene.objects.slice(0, 100).map(normalizeObject) : fallback.objects,
  };
}

function normalizeProject(project: GeneratedProject): GeneratedProject {
  return {
    ...project,
    title: project.title || "Untitled project",
    description: project.description || "",
    hashtags: Array.isArray(project.hashtags) ? project.hashtags : [],
    selectedAssetIds: Array.isArray(project.selectedAssetIds) ? project.selectedAssetIds : [],
    assistantHistory: Array.isArray(project.assistantHistory) ? project.assistantHistory.slice(-80) : [],
    revisions: Array.isArray(project.revisions) ? project.revisions.slice(-30).map((revision) => ({ ...revision, scene: revision.scene ? normalizeScene(revision.scene) : undefined })) : [],
    scene: normalizeScene(project.scene),
    thumbnailFileName: project.thumbnailFileName || null,
    multiplayer: project.multiplayer === true,
    maxPlayers: Math.max(1, Math.min(50, Number(project.maxPlayers || 1))),
    createdAt: Number(project.createdAt || Date.now()),
    updatedAt: Number(project.updatedAt || Date.now()),
  };
}

export function listLocalProjects(): GeneratedProject[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || "[]") as GeneratedProject[];
    return Array.isArray(value) ? value.map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function getLocalProject(id: string): GeneratedProject | null {
  return listLocalProjects().find((project) => project.id === id) || null;
}

export function saveLocalProject(project: GeneratedProject): GeneratedProject {
  const storage = browserStorage();
  const next = normalizeProject({ ...project, updatedAt: Date.now() });
  if (!storage) return next;
  const projects = listLocalProjects();
  const index = projects.findIndex((item) => item.id === next.id);
  if (index >= 0) projects[index] = next;
  else projects.unshift(next);
  storage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, 30)));
  window.dispatchEvent(new CustomEvent("flux-studio-projects-updated"));
  return next;
}

export function createProjectRevision(project: GeneratedProject, label: string): GeneratedProject {
  const revision: StudioRevision = {
    id: `revision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim().slice(0, 80) || "Saved revision",
    code: project.code,
    scene: project.scene ? structuredClone(project.scene) : undefined,
    createdAt: Date.now(),
  };
  return saveLocalProject({ ...project, revisions: [...(project.revisions || []), revision].slice(-30) });
}

export function restoreProjectRevision(project: GeneratedProject, revisionId: string): GeneratedProject {
  const revision = project.revisions?.find((item) => item.id === revisionId);
  if (!revision) return project;
  return saveLocalProject({ ...project, code: revision.code, scene: revision.scene ? structuredClone(revision.scene) : project.scene });
}

export function deleteLocalProject(id: string): void {
  const storage = browserStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(listLocalProjects().filter((project) => project.id !== id)));
  window.dispatchEvent(new CustomEvent("flux-studio-projects-updated"));
}

export async function publishCommunityGame(project: GeneratedProject): Promise<string> {
  if (project.kind !== "game") throw new Error("Only games can be published to Flux Games.");
  if (!project.ownerId) throw new Error("Sign in before publishing.");
  const id = project.publishedId || `community-${project.id}`;
  const ref = doc(db, "publishedRooms", id);
  const existing = await getDoc(ref);
  const payload = {
    authorId: project.ownerId,
    isOfficial: false,
    isPrivate: false,
    kind: "studio-game",
    title: project.title.trim().slice(0, 80) || "Untitled Flux Game",
    description: project.description.trim().slice(0, 600),
    hashtags: project.hashtags.slice(0, 12),
    sourceCode: project.code,
    thumbnail: project.thumbnail,
    thumbnailFileName: project.thumbnailFileName || null,
    multiplayer: project.multiplayer,
    maxPlayers: Math.max(1, Math.min(50, project.maxPlayers || 1)),
    selectedAssetIds: project.selectedAssetIds.slice(0, 100),
    scene: project.scene || null,
    visits: existing.exists() ? Number(existing.data().visits || 0) : 0,
    cheers: existing.exists() ? Number(existing.data().cheers || 0) : 0,
    createdAt: existing.exists() ? existing.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
  saveLocalProject({ ...project, publishedId: id });
  return id;
}

export async function getPublishedCommunityGame(id: string): Promise<PublishedCommunityGame | null> {
  const snap = await getDoc(doc(db, "publishedRooms", id));
  if (!snap.exists() || snap.data().kind !== "studio-game") return null;
  const data = snap.data();
  return {
    id: snap.id,
    authorId: String(data.authorId || ""),
    title: String(data.title || "Untitled game"),
    description: String(data.description || ""),
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    code: String(data.sourceCode || ""),
    thumbnail: String(data.thumbnail || ""),
    multiplayer: data.multiplayer === true,
    maxPlayers: Number(data.maxPlayers || 1),
    visits: Number(data.visits || 0),
    cheers: Number(data.cheers || 0),
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function listPublishedCommunityGames(max = 36): Promise<PublishedCommunityGame[]> {
  const snap = await getDocs(collection(db, "publishedRooms"));
  return snap.docs
    .filter((item) => item.data().kind === "studio-game" && item.data().isPrivate !== true)
    .slice(0, Math.max(1, Math.min(max, 60)))
    .map((item) => {
      const data = item.data();
      return {
        id: item.id,
        authorId: String(data.authorId || ""),
        title: String(data.title || "Untitled game"),
        description: String(data.description || ""),
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
        code: String(data.sourceCode || ""),
        thumbnail: String(data.thumbnail || ""),
        multiplayer: data.multiplayer === true,
        maxPlayers: Number(data.maxPlayers || 1),
        visits: Number(data.visits || 0),
        cheers: Number(data.cheers || 0),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    })
    .sort((a, b) => b.visits - a.visits || b.cheers - a.cheers);
}

export async function recordCommunityGameVisit(id: string): Promise<void> {
  await updateDoc(doc(db, "publishedRooms", id), { visits: increment(1), updatedAt: serverTimestamp() }).catch(() => undefined);
}

export async function cheerCommunityGame(id: string): Promise<void> {
  await updateDoc(doc(db, "publishedRooms", id), { cheers: increment(1), updatedAt: serverTimestamp() });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
