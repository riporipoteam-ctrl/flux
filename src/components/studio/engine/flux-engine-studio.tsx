"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Box,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Clipboard,
  CloudUpload,
  Code2,
  Command,
  Copy,
  Cylinder,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Flashlight,
  Focus,
  FolderOpen,
  Globe2,
  History,
  Image as ImageIcon,
  Keyboard,
  Layers3,
  Lightbulb,
  ListTree,
  Loader2,
  Lock,
  MapPin,
  Maximize2,
  Menu,
  Minus,
  MousePointer2,
  Move3d,
  Mountain,
  Package,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Plus,
  Redo2,
  Rocket,
  Rotate3d,
  Save,
  Scaling,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sun,
  Terminal,
  Trash2,
  Triangle,
  Undo2,
  Unlock,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EngineViewportV2, type EngineViewportHandle } from "@/components/studio/engine/engine-viewport-v2";
import {
  createDefaultEngineProject,
  createEngineNode,
  createEngineVersion,
  deleteEngineProject,
  duplicateEngineProject,
  generateEngineGameHtml,
  getActiveEngineProject,
  instantiateEnginePrefab,
  listEnginePrefabs,
  listEngineProjects,
  parseEngineProject,
  publishEngineProject,
  restoreEngineVersion,
  saveEnginePrefab,
  saveEngineProject,
  serializeEngineProject,
} from "@/services/flux-engine-projects";
import { FLUX_ENGINE_FEATURES } from "@/data/flux-engine-features";
import type {
  EngineCameraView,
  EngineConsoleEntry,
  EngineNode,
  EngineNodeKind,
  EnginePanel,
  EnginePrefab,
  EngineVector3,
  FluxEngineProject,
  TransformMode,
} from "@/types/flux-engine";

const TOOL_ITEMS: Array<{ mode: TransformMode; label: string; icon: LucideIcon; key: string }> = [
  { mode: "select", label: "Select", icon: MousePointer2, key: "Q" },
  { mode: "move", label: "Move", icon: Move3d, key: "W" },
  { mode: "rotate", label: "Rotate", icon: Rotate3d, key: "E" },
  { mode: "scale", label: "Scale", icon: Scaling, key: "R" },
];

const CREATE_ITEMS: Array<{ kind: EngineNodeKind; label: string; icon: LucideIcon }> = [
  { kind: "box", label: "Box", icon: Box },
  { kind: "sphere", label: "Sphere", icon: Circle },
  { kind: "cylinder", label: "Cylinder", icon: Cylinder },
  { kind: "cone", label: "Cone", icon: Triangle },
  { kind: "plane", label: "Plane", icon: Square },
  { kind: "ground", label: "Ground", icon: Maximize2 },
  { kind: "terrain", label: "Terrain", icon: Mountain },
  { kind: "spawn", label: "Spawn", icon: MapPin },
  { kind: "directional-light", label: "Sun", icon: Sun },
  { kind: "point-light", label: "Point light", icon: Lightbulb },
  { kind: "spot-light", label: "Spot light", icon: Flashlight },
];

const PANEL_ITEMS: Array<{ panel: EnginePanel; label: string; icon: LucideIcon }> = [
  { panel: "console", label: "Console", icon: Terminal },
  { panel: "scripts", label: "Scripts", icon: Code2 },
  { panel: "assets", label: "Assets", icon: Package },
  { panel: "versions", label: "Versions", icon: History },
  { panel: "settings", label: "World", icon: Settings },
];

function cloneProject(project: FluxEngineProject): FluxEngineProject {
  return JSON.parse(JSON.stringify(project)) as FluxEngineProject;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function FluxEngineStudio() {
  const { user } = useAuth();
  const viewportRef = useRef<EngineViewportHandle>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const pastRef = useRef<FluxEngineProject[]>([]);
  const futureRef = useRef<FluxEngineProject[]>([]);
  const runtimeSnapshotRef = useRef<FluxEngineProject | null>(null);
  const clipboardRef = useRef<EngineNode | null>(null);
  const [project, setProject] = useState<FluxEngineProject | null>(null);
  const [projects, setProjects] = useState<FluxEngineProject[]>([]);
  const [prefabs, setPrefabs] = useState<EnginePrefab[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<TransformMode>("move");
  const [runtimeState, setRuntimeState] = useState<"edit" | "playing" | "paused">("edit");
  const [panel, setPanel] = useState<EnginePanel>("console");
  const [consoleEntries, setConsoleEntries] = useState<EngineConsoleEntry[]>([]);
  const [hierarchySearch, setHierarchySearch] = useState("");
  const [commandText, setCommandText] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<"hierarchy" | "inspector" | "create" | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Saved");
  const [leftWidth, setLeftWidth] = useState(248);
  const [rightWidth, setRightWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(190);
  const selected = useMemo(() => project?.nodes.find((node) => node.id === selectedId) || null, [project, selectedId]);

  const log = useCallback((level: EngineConsoleEntry["level"], message: string) => {
    setConsoleEntries((entries) => [...entries, { id: uid("log"), level, message, createdAt: Date.now() }].slice(-250));
  }, []);

  const refreshLists = useCallback(() => {
    setProjects(listEngineProjects());
    setPrefabs(listEnginePrefabs());
  }, []);

  useEffect(() => {
    if (!user) return;
    const active = getActiveEngineProject(user.uid);
    setProject(active);
    setSelectedId(active.nodes.find((node) => node.kind === "box")?.id || active.nodes[0]?.id || null);
    refreshLists();
    log("info", `Opened ${active.name}.`);
  }, [log, refreshLists, user]);

  useEffect(() => {
    if (!project || runtimeState !== "edit") return;
    setSaveLabel("Saving…");
    const timer = window.setTimeout(() => {
      setSaving(true);
      const saved = saveEngineProject(project);
      setProject((current) => current?.id === saved.id ? { ...current, updatedAt: saved.updatedAt } : current);
      setSaving(false);
      setSaveLabel("Saved");
      refreshLists();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [project?.name, project?.description, project?.nodes, project?.settings, project?.tags, refreshLists, runtimeState]);

  const commit = useCallback((updater: (current: FluxEngineProject) => FluxEngineProject, track = true) => {
    setProject((current) => {
      if (!current) return current;
      const next = updater(current);
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      if (track && runtimeState === "edit") {
        pastRef.current = [...pastRef.current.slice(-59), cloneProject(current)];
        futureRef.current = [];
      }
      return { ...next, updatedAt: Date.now() };
    });
  }, [runtimeState]);

  const updateNode = useCallback((id: string, patch: Partial<EngineNode>, track = true) => {
    commit((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) }), track);
  }, [commit]);

  const updateNodeTransform = useCallback((id: string, patch: Pick<EngineNode, "position" | "rotation" | "scale">) => {
    updateNode(id, patch, true);
  }, [updateNode]);

  const updateRuntimeTransform = useCallback((id: string, patch: Pick<EngineNode, "position" | "rotation" | "scale">) => {
    updateNode(id, patch, false);
  }, [updateNode]);

  const addNode = useCallback((kind: EngineNodeKind, options?: Partial<EngineNode>) => {
    if (!project || runtimeState !== "edit") return;
    const node = { ...createEngineNode(kind), ...options } as EngineNode;
    const sameKind = project.nodes.filter((item) => item.kind === kind).length;
    node.name = options?.name || `${node.name}${sameKind ? ` ${sameKind + 1}` : ""}`;
    commit((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
    setMode("move");
    setCreateOpen(false);
    setMobilePanel(null);
    log("success", `Created ${node.name}.`);
  }, [commit, log, project, runtimeState]);

  const deleteSelected = useCallback(() => {
    if (!selected || selected.locked || runtimeState !== "edit") return;
    commit((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== selected.id).map((node) => node.parentId === selected.id ? { ...node, parentId: null } : node),
      settings: current.settings.playerNodeId === selected.id ? { ...current.settings, playerNodeId: null } : current.settings,
    }));
    setSelectedId(null);
    log("info", `Deleted ${selected.name}.`);
  }, [commit, log, runtimeState, selected]);

  const duplicateSelected = useCallback(() => {
    if (!selected || runtimeState !== "edit") return;
    const duplicate: EngineNode = cloneProject({ ...project!, nodes: [selected] }).nodes[0];
    duplicate.id = uid(selected.kind);
    duplicate.name = `${selected.name} Copy`.slice(0, 80);
    duplicate.position = { x: selected.position.x + 1, y: selected.position.y, z: selected.position.z + 1 };
    duplicate.parentId = selected.parentId;
    commit((current) => ({ ...current, nodes: [...current.nodes, duplicate] }));
    setSelectedId(duplicate.id);
    log("success", `Duplicated ${selected.name}.`);
  }, [commit, log, project, runtimeState, selected]);

  const copySelected = useCallback(() => {
    if (!selected) return;
    clipboardRef.current = JSON.parse(JSON.stringify(selected)) as EngineNode;
    toast.success("Object copied");
  }, [selected]);

  const pasteObject = useCallback(() => {
    if (!clipboardRef.current || runtimeState !== "edit") return;
    const node = JSON.parse(JSON.stringify(clipboardRef.current)) as EngineNode;
    node.id = uid(node.kind);
    node.name = `${node.name} Copy`.slice(0, 80);
    node.position.x += 1;
    node.position.z += 1;
    commit((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  }, [commit, runtimeState]);

  const undo = useCallback(() => {
    if (runtimeState !== "edit") return;
    const previous = pastRef.current.at(-1);
    if (!previous || !project) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [cloneProject(project), ...futureRef.current.slice(0, 59)];
    setProject(cloneProject(previous));
    if (selectedId && !previous.nodes.some((node) => node.id === selectedId)) setSelectedId(null);
  }, [project, runtimeState, selectedId]);

  const redo = useCallback(() => {
    if (runtimeState !== "edit") return;
    const next = futureRef.current[0];
    if (!next || !project) return;
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-59), cloneProject(project)];
    setProject(cloneProject(next));
  }, [project, runtimeState]);

  const startPlay = useCallback(() => {
    if (!project || runtimeState === "playing") return;
    if (runtimeState === "paused") { setRuntimeState("playing"); return; }
    runtimeSnapshotRef.current = cloneProject(project);
    setRuntimeState("playing");
    setBottomOpen(true);
    setPanel("console");
  }, [project, runtimeState]);

  const pausePlay = useCallback(() => {
    if (runtimeState === "playing") setRuntimeState("paused");
    else if (runtimeState === "paused") setRuntimeState("playing");
  }, [runtimeState]);

  const stopPlay = useCallback(() => {
    if (runtimeState === "edit") return;
    if (runtimeSnapshotRef.current) setProject(cloneProject(runtimeSnapshotRef.current));
    runtimeSnapshotRef.current = null;
    setRuntimeState("edit");
    log("info", "Play mode stopped and edit state restored.");
  }, [log, runtimeState]);

  const createProject = useCallback(() => {
    if (!user) return;
    const next = saveEngineProject(createDefaultEngineProject(user.uid));
    setProject(next);
    setSelectedId(next.nodes[0]?.id || null);
    pastRef.current = [];
    futureRef.current = [];
    refreshLists();
    setProjectsOpen(false);
  }, [refreshLists, user]);

  const openProject = useCallback((next: FluxEngineProject) => {
    if (runtimeState !== "edit") stopPlay();
    setProject(next);
    setSelectedId(next.nodes[0]?.id || null);
    pastRef.current = [];
    futureRef.current = [];
    saveEngineProject(next);
    setProjectsOpen(false);
    log("info", `Opened ${next.name}.`);
  }, [log, runtimeState, stopPlay]);

  const removeProject = useCallback((id: string) => {
    if (!project || projects.length <= 1) return toast.error("Keep at least one project.");
    deleteEngineProject(id);
    const remaining = listEngineProjects();
    setProjects(remaining);
    if (project.id === id && remaining[0]) openProject(remaining[0]);
  }, [openProject, project, projects.length]);

  const cloneCurrentProject = useCallback(() => {
    if (!project) return;
    const next = duplicateEngineProject(project);
    refreshLists();
    openProject(next);
  }, [openProject, project, refreshLists]);

  const createVersion = useCallback(() => {
    if (!project) return;
    const label = window.prompt("Version name", `Version ${project.versions.length + 1}`);
    if (label === null) return;
    const next = createEngineVersion(project, label);
    setProject(next);
    refreshLists();
    log("success", `Created version ${label || next.versions.at(-1)?.label}.`);
  }, [log, project, refreshLists]);

  const restoreVersion = useCallback((versionId: string) => {
    if (!project) return;
    const next = restoreEngineVersion(project, versionId);
    setProject(next);
    setSelectedId(next.nodes[0]?.id || null);
    log("success", "Version restored.");
  }, [log, project]);

  const addPrefab = useCallback(() => {
    if (!user || !selected) return;
    const name = window.prompt("Prefab name", selected.name);
    if (name === null) return;
    saveEnginePrefab(user.uid, selected, name);
    refreshLists();
    toast.success("Prefab saved");
  }, [refreshLists, selected, user]);

  const insertPrefab = useCallback((prefab: EnginePrefab) => {
    const node = instantiateEnginePrefab(prefab);
    commit((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
    setMode("move");
  }, [commit]);

  const importModel = useCallback(async (file: File | null) => {
    if (!file || !project) return;
    if (!/\.(glb|gltf)$/i.test(file.name)) return toast.error("Choose a .glb or .gltf file.");
    let sourceUrl = "";
    if (file.size <= 3 * 1024 * 1024) sourceUrl = await readFileAsDataUrl(file);
    else {
      sourceUrl = URL.createObjectURL(file);
      toast.warning("Large model imported for this session. Use a smaller optimized GLB to preserve it after reload.");
    }
    const node = createEngineNode("model", file.name.replace(/\.(glb|gltf)$/i, ""));
    node.sourceUrl = sourceUrl;
    node.sourceName = file.name;
    node.position = { x: 0, y: 0, z: 0 };
    commit((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
    setMode("move");
  }, [commit, project]);

  const exportProject = useCallback(() => {
    if (!project) return;
    downloadText(`${slug(project.name)}.flux.json`, serializeEngineProject(project), "application/json");
    log("success", "Editable project JSON exported.");
  }, [log, project]);

  const importProject = useCallback(async (file: File | null) => {
    if (!file || !user) return;
    try {
      const next = saveEngineProject(parseEngineProject(await file.text(), user.uid));
      openProject(next);
      refreshLists();
      toast.success("Flux Engine project imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project file could not be imported.");
    }
  }, [openProject, refreshLists, user]);

  const exportGame = useCallback(() => {
    if (!project) return;
    downloadText(`${slug(project.name)}.html`, generateEngineGameHtml(project), "text/html");
    log("success", "Standalone browser game exported.");
  }, [log, project]);

  const captureThumbnail = useCallback(() => {
    const image = viewportRef.current?.capture();
    if (!image) return toast.error("The viewport could not be captured.");
    commit((current) => ({ ...current, thumbnail: image }), false);
    toast.success("Project thumbnail captured");
  }, [commit]);

  const publish = useCallback(async () => {
    if (!project || publishing) return;
    setPublishing(true);
    try {
      const thumbnail = project.thumbnail || viewportRef.current?.capture() || "";
      const publishedId = await publishEngineProject({ ...project, thumbnail });
      const next = saveEngineProject({ ...project, thumbnail, publishedId });
      setProject(next);
      toast.success("3D game published to Flux Games");
      log("success", `Published as ${publishedId}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publishing failed.");
      log("error", error instanceof Error ? error.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  }, [log, project, publishing]);

  const runCommand = useCallback((raw = commandText) => {
    const text = raw.trim().toLowerCase();
    if (!text) return;
    const color = raw.match(/#[0-9a-f]{6}/i)?.[0];
    const kind = CREATE_ITEMS.find((item) => text.includes(item.label.toLowerCase()))?.kind;
    if (/^(add|create|insert|make)\b/.test(text) && kind) addNode(kind, color ? { material: { ...createEngineNode(kind).material, color } } : undefined);
    else if (text.includes("duplicate")) duplicateSelected();
    else if (text.includes("delete") || text.includes("remove")) deleteSelected();
    else if (text.includes("center") && selected) updateNode(selected.id, { position: { x: 0, y: selected.position.y, z: 0 } });
    else if ((text.includes("bigger") || text.includes("larger")) && selected) updateNode(selected.id, { scale: multiplyVector(selected.scale, 1.25) });
    else if (text.includes("smaller") && selected) updateNode(selected.id, { scale: multiplyVector(selected.scale, 0.8) });
    else if (color && selected) updateNode(selected.id, { material: { ...selected.material, color } });
    else if (text === "play" || text.includes("start game")) startPlay();
    else if (text === "stop" || text.includes("stop game")) stopPlay();
    else if (text.includes("save version")) createVersion();
    else if (text.includes("focus")) viewportRef.current?.focusSelection();
    else {
      toast.error("Command not recognized");
      log("warning", `Unknown command: ${raw}`);
      return;
    }
    setCommandText("");
    setCommandOpen(false);
  }, [addNode, commandText, createVersion, deleteSelected, duplicateSelected, log, selected, startPlay, stopPlay, updateNode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); return; }
      if (typing) return;
      if (meta && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
      if (meta && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelected(); return; }
      if (meta && event.key.toLowerCase() === "c") { event.preventDefault(); copySelected(); return; }
      if (meta && event.key.toLowerCase() === "v") { event.preventDefault(); pasteObject(); return; }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelected(); return; }
      if (event.key.toLowerCase() === "q") setMode("select");
      if (event.key.toLowerCase() === "w") setMode("move");
      if (event.key.toLowerCase() === "e") setMode("rotate");
      if (event.key.toLowerCase() === "r") setMode("scale");
      if (event.key.toLowerCase() === "f") viewportRef.current?.focusSelection();
      if (event.key === "F6") { event.preventDefault(); runtimeState === "edit" ? startPlay() : stopPlay(); }
      if (event.key === "Escape") { setCommandOpen(false); setCreateOpen(false); setMobilePanel(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelected, deleteSelected, duplicateSelected, pasteObject, redo, runtimeState, startPlay, stopPlay, undo]);

  const resizePanel = useCallback((side: "left" | "right" | "bottom", event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialLeft = leftWidth;
    const initialRight = rightWidth;
    const initialBottom = bottomHeight;
    const move = (next: PointerEvent) => {
      if (side === "left") setLeftWidth(Math.min(420, Math.max(190, initialLeft + next.clientX - startX)));
      if (side === "right") setRightWidth(Math.min(460, Math.max(250, initialRight - next.clientX + startX)));
      if (side === "bottom") setBottomHeight(Math.min(420, Math.max(120, initialBottom - next.clientY + startY)));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [bottomHeight, leftWidth, rightWidth]);

  if (!project) return <div className="grid h-[100dvh] place-items-center bg-[#0b0d11] text-white"><div className="text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /><p className="mt-3 text-sm font-bold">Opening Flux Engine</p></div></div>;

  const filteredNodes = project.nodes.filter((node) => !hierarchySearch.trim() || `${node.name} ${node.tags.join(" ")}`.toLowerCase().includes(hierarchySearch.toLowerCase()));

  return (
    <main className="flux-engine-shell" style={{ "--engine-left": `${leftOpen ? leftWidth : 0}px`, "--engine-right": `${rightOpen ? rightWidth : 0}px`, "--engine-bottom": `${bottomOpen ? bottomHeight : 0}px` } as React.CSSProperties}>
      <header className="flux-engine-topbar">
        <div className="flux-engine-brand"><span className="flux-engine-mark">F</span><div><strong>Flux Engine</strong><small>3D Studio V1</small></div></div>
        <button type="button" className="flux-engine-project-button" onClick={() => setProjectsOpen(true)}><FolderOpen className="h-4 w-4" /><span className="truncate">{project.name}</span><ChevronDown className="h-3.5 w-3.5 opacity-45" /></button>
        <div className="flux-engine-save-state"><span className={cn(saving && "animate-pulse")} />{saveLabel}</div>
        <div className="flux-engine-top-tools">
          <IconButton label="Undo" onClick={undo} disabled={!pastRef.current.length || runtimeState !== "edit"}><Undo2 /></IconButton>
          <IconButton label="Redo" onClick={redo} disabled={!futureRef.current.length || runtimeState !== "edit"}><Redo2 /></IconButton>
          <span className="flux-engine-divider" />
          {TOOL_ITEMS.map(({ mode: itemMode, label, icon: Icon, key }) => <IconButton key={itemMode} label={`${label} (${key})`} active={mode === itemMode} onClick={() => setMode(itemMode)} disabled={runtimeState !== "edit"}><Icon /></IconButton>)}
          <IconButton label="Focus selection (F)" onClick={() => viewportRef.current?.focusSelection()} disabled={!selected}><Focus /></IconButton>
        </div>
        <div className="flux-engine-runtime-controls">
          {runtimeState === "edit" ? <button type="button" className="engine-play" onClick={startPlay}><Play className="h-4 w-4 fill-current" />Play</button> : <>
            <button type="button" className="engine-pause" onClick={pausePlay}>{runtimeState === "paused" ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}{runtimeState === "paused" ? "Resume" : "Pause"}</button>
            <button type="button" className="engine-stop" onClick={stopPlay}><Square className="h-3.5 w-3.5 fill-current" />Stop</button>
          </>}
        </div>
        <div className="flux-engine-actions">
          <IconButton label="Commands (Ctrl K)" onClick={() => setCommandOpen(true)}><Command /></IconButton>
          <button type="button" className="engine-publish" onClick={() => void publish()} disabled={publishing}>{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}Publish</button>
        </div>
      </header>

      <aside className="flux-engine-toolbar">
        <button type="button" className={cn("engine-tool", createOpen && "active")} onClick={() => setCreateOpen((value) => !value)}><Plus /><span>Create</span></button>
        <button type="button" className="engine-tool" onClick={() => modelInputRef.current?.click()}><Upload /><span>Import</span></button>
        <button type="button" className="engine-tool" onClick={() => { setPanel("assets"); setBottomOpen(true); }}><Package /><span>Assets</span></button>
        <button type="button" className="engine-tool" onClick={() => { setPanel("scripts"); setBottomOpen(true); }}><Code2 /><span>Script</span></button>
        <button type="button" className="engine-tool" onClick={() => { setPanel("settings"); setBottomOpen(true); }}><Globe2 /><span>World</span></button>
        <div className="flex-1" />
        <button type="button" className="engine-tool" onClick={() => setFeaturesOpen(true)}><Sparkles /><span>100</span></button>
        <button type="button" className="engine-tool lg:hidden" onClick={() => setMobilePanel("hierarchy")}><ListTree /><span>Tree</span></button>
        <button type="button" className="engine-tool lg:hidden" onClick={() => setMobilePanel("inspector")}><SlidersHorizontal /><span>Inspect</span></button>
      </aside>

      {createOpen ? <CreateMenu onCreate={addNode} onImport={() => modelInputRef.current?.click()} onClose={() => setCreateOpen(false)} /> : null}

      <section className={cn("flux-engine-hierarchy", !leftOpen && "collapsed")} style={{ width: leftOpen ? leftWidth : 0 }}>
        <PanelHeader icon={ListTree} title="Hierarchy" action={<button type="button" onClick={() => setLeftOpen(false)}><PanelLeft className="h-4 w-4" /></button>} />
        <div className="engine-search"><Search className="h-3.5 w-3.5" /><input value={hierarchySearch} onChange={(event) => setHierarchySearch(event.target.value)} placeholder="Search scene" /></div>
        <div className="engine-hierarchy-list">
          {filteredNodes.map((node) => <HierarchyRow key={node.id} node={node} active={node.id === selectedId} onSelect={() => setSelectedId(node.id)} onToggleVisibility={() => updateNode(node.id, { visible: !node.visible })} />)}
          {!filteredNodes.length ? <div className="engine-empty"><Search className="h-5 w-5" /><span>No objects match.</span></div> : null}
        </div>
        <div className="engine-hierarchy-footer"><span>{project.nodes.length} objects</span><button type="button" onClick={() => addNode("box")}><Plus className="h-3.5 w-3.5" />Object</button></div>
      </section>
      {leftOpen ? <div className="engine-resizer vertical left" onPointerDown={(event) => resizePanel("left", event)} /> : <button type="button" className="engine-panel-restore left" onClick={() => setLeftOpen(true)}><PanelLeft className="h-4 w-4" /></button>}

      <section className="flux-engine-stage">
        <div className="engine-viewport-bar">
          <div className="engine-view-tabs"><button type="button" className="active">Scene</button><button type="button" onClick={() => runtimeState === "edit" ? startPlay() : undefined}>Game</button></div>
          <div className="engine-camera-menu">
            {(["perspective", "top", "front", "right"] as EngineCameraView[]).map((view) => <button key={view} type="button" onClick={() => viewportRef.current?.setCameraView(view)}>{view}</button>)}
          </div>
          <div className="engine-viewport-actions"><button type="button" onClick={() => setLeftOpen((value) => !value)}><PanelLeft className="h-4 w-4" /></button><button type="button" onClick={() => setBottomOpen((value) => !value)}><PanelBottom className="h-4 w-4" /></button><button type="button" onClick={() => setRightOpen((value) => !value)}><PanelRight className="h-4 w-4" /></button></div>
        </div>
        <div className="engine-viewport-wrap">
          <EngineViewportV2 ref={viewportRef} project={project} selectedId={selectedId} transformMode={mode} runtimeState={runtimeState} onSelect={setSelectedId} onTransform={updateNodeTransform} onRuntimeTransform={updateRuntimeTransform} onLog={log} />
          {runtimeState !== "edit" ? <PlayOverlay onJump={() => viewportRef.current?.jumpPlayer()} /> : null}
        </div>
        {bottomOpen ? <><div className="engine-resizer horizontal" onPointerDown={(event) => resizePanel("bottom", event)} /><BottomDock panel={panel} onPanel={setPanel} project={project} selected={selected} consoleEntries={consoleEntries} prefabs={prefabs} onClearConsole={() => setConsoleEntries([])} onUpdateNode={updateNode} onInsertPrefab={insertPrefab} onCreateVersion={createVersion} onRestoreVersion={restoreVersion} onCapture={captureThumbnail} onExportProject={exportProject} onImportProject={() => projectInputRef.current?.click()} onExportGame={exportGame} onDuplicateProject={cloneCurrentProject} onUpdateProject={(patch) => commit((current) => ({ ...current, ...patch }))} onUpdateSettings={(patch) => commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }))} height={bottomHeight} /></> : null}
      </section>

      {rightOpen ? <><div className="engine-resizer vertical right" onPointerDown={(event) => resizePanel("right", event)} /><aside className="flux-engine-inspector" style={{ width: rightWidth }}><PanelHeader icon={SlidersHorizontal} title="Inspector" action={<button type="button" onClick={() => setRightOpen(false)}><PanelRight className="h-4 w-4" /></button>} />{selected ? <ObjectInspector node={selected} project={project} onUpdate={(patch, track) => updateNode(selected.id, patch, track)} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCopy={copySelected} onPrefab={addPrefab} /> : <WorldInspector project={project} onUpdate={(patch) => commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }))} />}</aside></> : <button type="button" className="engine-panel-restore right" onClick={() => setRightOpen(true)}><PanelRight className="h-4 w-4" /></button>}

      <footer className="flux-engine-statusbar"><span><Globe2 className="h-3 w-3" />WebGL</span><span>{project.nodes.length} objects</span><span>{selected ? selected.name : "No selection"}</span><span className="ml-auto">Snap {project.settings.snapEnabled ? `${project.settings.snapPosition}m` : "off"}</span><button type="button" onClick={() => setFeaturesOpen(true)}>100 features</button></footer>

      <input ref={modelInputRef} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" className="hidden" onChange={(event) => { void importModel(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
      <input ref={projectInputRef} type="file" accept=".json,.flux.json,application/json" className="hidden" onChange={(event) => { void importProject(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />

      {commandOpen ? <CommandPalette value={commandText} onChange={setCommandText} onRun={() => runCommand()} onClose={() => setCommandOpen(false)} onQuick={runCommand} /> : null}
      {projectsOpen ? <ProjectBrowser projects={projects} activeId={project.id} onOpen={openProject} onCreate={createProject} onDuplicate={cloneCurrentProject} onDelete={removeProject} onClose={() => setProjectsOpen(false)} /> : null}
      {featuresOpen ? <FeaturesModal onClose={() => setFeaturesOpen(false)} /> : null}
      {mobilePanel ? <MobileDrawer title={mobilePanel === "hierarchy" ? "Hierarchy" : mobilePanel === "create" ? "Create" : "Inspector"} onClose={() => setMobilePanel(null)}>{mobilePanel === "hierarchy" ? <div className="space-y-1">{filteredNodes.map((node) => <HierarchyRow key={node.id} node={node} active={node.id === selectedId} onSelect={() => { setSelectedId(node.id); setMobilePanel(null); }} onToggleVisibility={() => updateNode(node.id, { visible: !node.visible })} />)}</div> : mobilePanel === "create" ? <div className="grid grid-cols-3 gap-2">{CREATE_ITEMS.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" className="engine-create-tile" onClick={() => addNode(kind)}><Icon /><span>{label}</span></button>)}</div> : selected ? <ObjectInspector node={selected} project={project} onUpdate={(patch, track) => updateNode(selected.id, patch, track)} onDelete={deleteSelected} onDuplicate={duplicateSelected} onCopy={copySelected} onPrefab={addPrefab} /> : <WorldInspector project={project} onUpdate={(patch) => commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }))} />}</MobileDrawer> : null}
    </main>
  );
}

function IconButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("engine-icon-button", active && "active")}>{children}</button>;
}

function PanelHeader({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: React.ReactNode }) {
  return <div className="engine-panel-header"><Icon className="h-4 w-4" /><strong>{title}</strong><span className="flex-1" />{action}</div>;
}

function CreateMenu({ onCreate, onImport, onClose }: { onCreate: (kind: EngineNodeKind) => void; onImport: () => void; onClose: () => void }) {
  return <div className="engine-create-menu"><div className="flex items-center"><strong>Create object</strong><button type="button" className="ml-auto" onClick={onClose}><X className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-3 gap-2">{CREATE_ITEMS.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" className="engine-create-tile" onClick={() => onCreate(kind)}><Icon /><span>{label}</span></button>)}</div><button type="button" className="engine-import-tile" onClick={onImport}><Upload className="h-4 w-4" /><span><strong>Import GLB</strong><small>Optimized glTF model</small></span></button></div>;
}

function HierarchyRow({ node, active, onSelect, onToggleVisibility }: { node: EngineNode; active: boolean; onSelect: () => void; onToggleVisibility: () => void }) {
  const Icon = nodeIcon(node.kind);
  return <div className={cn("engine-hierarchy-row", active && "active")}><button type="button" className="engine-tree-chevron"><ChevronRight className="h-3 w-3" /></button><button type="button" className="engine-tree-main" onClick={onSelect}><Icon className="h-3.5 w-3.5" /><span>{node.name}</span></button>{node.locked ? <Lock className="h-3 w-3 opacity-35" /> : null}<button type="button" onClick={onToggleVisibility} className="engine-tree-action">{node.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button></div>;
}

function ObjectInspector({ node, project, onUpdate, onDelete, onDuplicate, onCopy, onPrefab }: { node: EngineNode; project: FluxEngineProject; onUpdate: (patch: Partial<EngineNode>, track?: boolean) => void; onDelete: () => void; onDuplicate: () => void; onCopy: () => void; onPrefab: () => void }) {
  const [section, setSection] = useState("transform");
  return <div className="engine-inspector-scroll">
    <div className="engine-object-title"><span className="engine-object-icon">{node.kind === "spawn" ? <MapPin /> : node.kind.includes("light") ? <Lightbulb /> : <Box />}</span><div className="min-w-0 flex-1"><input value={node.name} onChange={(event) => onUpdate({ name: event.target.value.slice(0, 80) })} /><small>{node.kind}</small></div><button type="button" onClick={() => onUpdate({ locked: !node.locked })}>{node.locked ? <Lock /> : <Unlock />}</button><button type="button" onClick={() => onUpdate({ visible: !node.visible })}>{node.visible ? <Eye /> : <EyeOff />}</button></div>
    <div className="engine-inspector-actions"><button type="button" onClick={onDuplicate}><Copy />Duplicate</button><button type="button" onClick={onCopy}><Clipboard />Copy</button><button type="button" onClick={onPrefab}><Package />Prefab</button><button type="button" className="danger" onClick={onDelete} disabled={node.locked}><Trash2 /></button></div>
    <InspectorSection id="transform" title="Transform" open={section === "transform"} onToggle={() => setSection(section === "transform" ? "" : "transform")}><VectorEditor label="Position" value={node.position} onChange={(position) => onUpdate({ position })} /><VectorEditor label="Rotation" value={node.rotation} step={0.05} onChange={(rotation) => onUpdate({ rotation })} /><VectorEditor label="Scale" value={node.scale} min={0.01} step={0.1} onChange={(scale) => onUpdate({ scale })} /></InspectorSection>
    <InspectorSection id="material" title="Material" open={section === "material"} onToggle={() => setSection(section === "material" ? "" : "material")}><ColorInput label="Color" value={node.material.color} onChange={(color) => onUpdate({ material: { ...node.material, color } })} /><ColorInput label="Emissive" value={node.material.emissive} onChange={(emissive) => onUpdate({ material: { ...node.material, emissive } })} /><RangeInput label="Opacity" value={node.material.opacity} min={0.05} max={1} step={0.05} onChange={(opacity) => onUpdate({ material: { ...node.material, opacity } })} /><RangeInput label="Roughness" value={node.material.roughness} min={0} max={1} step={0.05} onChange={(roughness) => onUpdate({ material: { ...node.material, roughness } })} /><Toggle label="Wireframe" checked={node.material.wireframe} onChange={(wireframe) => onUpdate({ material: { ...node.material, wireframe } })} /></InspectorSection>
    <InspectorSection id="physics" title="Physics" open={section === "physics"} onToggle={() => setSection(section === "physics" ? "" : "physics")}><Toggle label="Enable physics" checked={node.physics.enabled} onChange={(enabled) => onUpdate({ physics: { ...node.physics, enabled } })} /><Toggle label="Static body" checked={node.physics.static} onChange={(value) => onUpdate({ physics: { ...node.physics, static: value, mass: value ? 0 : Math.max(1, node.physics.mass) } })} /><NumberInput label="Mass" value={node.physics.mass} min={0} step={0.5} onChange={(mass) => onUpdate({ physics: { ...node.physics, mass } })} /><RangeInput label="Friction" value={node.physics.friction} min={0} max={1} step={0.05} onChange={(friction) => onUpdate({ physics: { ...node.physics, friction } })} /><RangeInput label="Bounce" value={node.physics.restitution} min={0} max={1} step={0.05} onChange={(restitution) => onUpdate({ physics: { ...node.physics, restitution } })} /></InspectorSection>
    <InspectorSection id="behavior" title="Behavior script" open={section === "behavior"} onToggle={() => setSection(section === "behavior" ? "" : "behavior")}><textarea className="engine-script-editor" value={node.script} onChange={(event) => onUpdate({ script: event.target.value.slice(0, 8000) })} placeholder={"spin y 1\nbob 0.5 2\npulse 0.8 1.2 2"} /><p className="engine-help-text">Safe commands: <code>spin axis speed</code>, <code>bob amount speed</code>, <code>pulse min max speed</code>.</p></InspectorSection>
    <InspectorSection id="advanced" title="Advanced" open={section === "advanced"} onToggle={() => setSection(section === "advanced" ? "" : "advanced")}><label className="engine-field"><span>Parent</span><select value={node.parentId || ""} onChange={(event) => onUpdate({ parentId: event.target.value || null })}><option value="">Scene root</option>{project.nodes.filter((item) => item.id !== node.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="engine-field"><span>Tags</span><input value={node.tags.join(", ")} onChange={(event) => onUpdate({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30) })} /></label><Toggle label="Cast shadows" checked={node.castShadow} onChange={(castShadow) => onUpdate({ castShadow })} /><Toggle label="Receive shadows" checked={node.receiveShadow} onChange={(receiveShadow) => onUpdate({ receiveShadow })} />{node.kind === "spawn" ? <button type="button" className={cn("engine-wide-action", project.settings.playerNodeId === node.id && "active")} onClick={() => { /* parent updates project through a node marker handled in World settings */ toast.info("Use World settings to choose the player spawn."); }}><MapPin className="h-4 w-4" />{project.settings.playerNodeId === node.id ? "Current player spawn" : "Set as player spawn"}</button> : null}</InspectorSection>
  </div>;
}

function WorldInspector({ project, onUpdate }: { project: FluxEngineProject; onUpdate: (patch: Partial<FluxEngineProject["settings"]>) => void }) {
  return <div className="engine-inspector-scroll"><div className="engine-world-heading"><Globe2 /><div><strong>World settings</strong><small>Lighting, gravity and viewport</small></div></div><ColorInput label="Background" value={project.settings.background} onChange={(background) => onUpdate({ background })} /><ColorInput label="Ambient color" value={project.settings.ambientColor} onChange={(ambientColor) => onUpdate({ ambientColor })} /><RangeInput label="Ambient light" value={project.settings.ambientIntensity} min={0} max={2} step={0.05} onChange={(ambientIntensity) => onUpdate({ ambientIntensity })} /><NumberInput label="Gravity" value={project.settings.gravity} step={0.1} onChange={(gravity) => onUpdate({ gravity })} /><Toggle label="Show grid" checked={project.settings.gridVisible} onChange={(gridVisible) => onUpdate({ gridVisible })} /><NumberInput label="Grid size" value={project.settings.gridSize} min={0.25} step={0.25} onChange={(gridSize) => onUpdate({ gridSize })} /><Toggle label="Transform snapping" checked={project.settings.snapEnabled} onChange={(snapEnabled) => onUpdate({ snapEnabled })} /><NumberInput label="Position snap" value={project.settings.snapPosition} min={0.01} step={0.1} onChange={(snapPosition) => onUpdate({ snapPosition })} /><NumberInput label="Rotation snap" value={project.settings.snapRotation} min={1} step={1} onChange={(snapRotation) => onUpdate({ snapRotation })} /><Toggle label="Fog" checked={project.settings.fogEnabled} onChange={(fogEnabled) => onUpdate({ fogEnabled })} />{project.settings.fogEnabled ? <><ColorInput label="Fog color" value={project.settings.fogColor} onChange={(fogColor) => onUpdate({ fogColor })} /><RangeInput label="Fog density" value={project.settings.fogDensity} min={0.001} max={0.08} step={0.001} onChange={(fogDensity) => onUpdate({ fogDensity })} /></> : null}<label className="engine-field"><span>Player spawn</span><select value={project.settings.playerNodeId || ""} onChange={(event) => onUpdate({ playerNodeId: event.target.value || null })}><option value="">None</option>{project.nodes.filter((node) => node.kind === "spawn" || node.physics.enabled).map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select></label></div>;
}

function InspectorSection({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className="engine-inspector-section" data-section={id}><button type="button" onClick={onToggle}><ChevronRight className={cn("h-3.5 w-3.5 transition", open && "rotate-90")} /><strong>{title}</strong></button>{open ? <div className="engine-inspector-content">{children}</div> : null}</section>;
}

function VectorEditor({ label, value, min, step = 0.1, onChange }: { label: string; value: EngineVector3; min?: number; step?: number; onChange: (value: EngineVector3) => void }) {
  return <div className="engine-vector"><span>{label}</span>{(["x", "y", "z"] as const).map((axis) => <label key={axis} data-axis={axis}><em>{axis.toUpperCase()}</em><input type="number" value={round(value[axis])} min={min} step={step} onChange={(event) => onChange({ ...value, [axis]: Number(event.target.value) })} /></label>)}</div>;
}

function NumberInput({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return <label className="engine-field"><span>{label}</span><input type="number" value={round(value)} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function RangeInput({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="engine-range"><span>{label}<output>{round(value)}</output></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="engine-field engine-color-field"><span>{label}</span><span><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><input value={value} onChange={(event) => onChange(event.target.value)} /></span></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="engine-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label>;
}

function BottomDock(props: { panel: EnginePanel; onPanel: (panel: EnginePanel) => void; project: FluxEngineProject; selected: EngineNode | null; consoleEntries: EngineConsoleEntry[]; prefabs: EnginePrefab[]; onClearConsole: () => void; onUpdateNode: (id: string, patch: Partial<EngineNode>, track?: boolean) => void; onInsertPrefab: (prefab: EnginePrefab) => void; onCreateVersion: () => void; onRestoreVersion: (id: string) => void; onCapture: () => void; onExportProject: () => void; onImportProject: () => void; onExportGame: () => void; onDuplicateProject: () => void; onUpdateProject: (patch: Partial<FluxEngineProject>) => void; onUpdateSettings: (patch: Partial<FluxEngineProject["settings"]>) => void; height: number }) {
  return <section className="flux-engine-bottom" style={{ height: props.height }}><div className="engine-bottom-tabs">{PANEL_ITEMS.map(({ panel, label, icon: Icon }) => <button key={panel} type="button" className={cn(props.panel === panel && "active")} onClick={() => props.onPanel(panel)}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div><div className="engine-bottom-content">{props.panel === "console" ? <ConsolePanel entries={props.consoleEntries} onClear={props.onClearConsole} /> : props.panel === "scripts" ? <ScriptsPanel project={props.project} selected={props.selected} onUpdateNode={props.onUpdateNode} /> : props.panel === "assets" ? <AssetsPanel prefabs={props.prefabs} onInsert={props.onInsertPrefab} onCapture={props.onCapture} /> : props.panel === "versions" ? <VersionsPanel project={props.project} onCreate={props.onCreateVersion} onRestore={props.onRestoreVersion} /> : <ProjectSettingsPanel project={props.project} onUpdateProject={props.onUpdateProject} onUpdateSettings={props.onUpdateSettings} onExportProject={props.onExportProject} onImportProject={props.onImportProject} onExportGame={props.onExportGame} onDuplicate={props.onDuplicateProject} />}</div></section>;
}

function ConsolePanel({ entries, onClear }: { entries: EngineConsoleEntry[]; onClear: () => void }) {
  return <div className="engine-console"><div className="engine-console-toolbar"><span>{entries.length} messages</span><button type="button" onClick={onClear}>Clear</button></div><div className="engine-console-list">{entries.length ? [...entries].reverse().map((entry) => <div key={entry.id} data-level={entry.level}><span>{new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span><strong>{entry.level}</strong><p>{entry.message}</p></div>) : <div className="engine-empty"><Terminal className="h-5 w-5" /><span>Runtime messages appear here.</span></div>}</div></div>;
}

function ScriptsPanel({ project, selected, onUpdateNode }: { project: FluxEngineProject; selected: EngineNode | null; onUpdateNode: (id: string, patch: Partial<EngineNode>) => void }) {
  const scripted = project.nodes.filter((node) => node.script.trim());
  return <div className="engine-scripts-panel"><aside>{project.nodes.map((node) => <button key={node.id} type="button" className={cn(selected?.id === node.id && "active")}><Code2 className="h-3.5 w-3.5" /><span>{node.name}</span>{node.script.trim() ? <i /> : null}</button>)}</aside><div className="engine-script-workspace">{selected ? <><div><strong>{selected.name}</strong><small>{scripted.length} scripted objects in scene</small></div><textarea value={selected.script} onChange={(event) => onUpdateNode(selected.id, { script: event.target.value })} placeholder={"spin y 1\nbob 0.5 2\npulse 0.8 1.2 2"} /></> : <div className="engine-empty"><Code2 className="h-5 w-5" /><span>Select an object to edit its behavior.</span></div>}</div></div>;
}

function AssetsPanel({ prefabs, onInsert, onCapture }: { prefabs: EnginePrefab[]; onInsert: (prefab: EnginePrefab) => void; onCapture: () => void }) {
  return <div className="engine-assets"><button type="button" className="engine-asset-card" onClick={onCapture}><Camera /><strong>Capture thumbnail</strong><small>Use the current viewport</small></button>{prefabs.map((prefab) => <button key={prefab.id} type="button" className="engine-asset-card" onClick={() => onInsert(prefab)}><Package /><strong>{prefab.name}</strong><small>{prefab.node.kind} prefab</small></button>)}{!prefabs.length ? <div className="engine-empty"><Package className="h-5 w-5" /><span>Save an object as a prefab to reuse it.</span></div> : null}</div>;
}

function VersionsPanel({ project, onCreate, onRestore }: { project: FluxEngineProject; onCreate: () => void; onRestore: (id: string) => void }) {
  return <div className="engine-versions"><button type="button" className="engine-version-create" onClick={onCreate}><Save /><span><strong>Create version</strong><small>Save nodes, scripts and world settings</small></span></button>{[...project.versions].reverse().map((version) => <div key={version.id} className="engine-version-row"><History /><span><strong>{version.label}</strong><small>{new Date(version.createdAt).toLocaleString()}</small></span><button type="button" onClick={() => onRestore(version.id)}>Restore</button></div>)}</div>;
}

function ProjectSettingsPanel({ project, onUpdateProject, onUpdateSettings, onExportProject, onImportProject, onExportGame, onDuplicate }: { project: FluxEngineProject; onUpdateProject: (patch: Partial<FluxEngineProject>) => void; onUpdateSettings: (patch: Partial<FluxEngineProject["settings"]>) => void; onExportProject: () => void; onImportProject: () => void; onExportGame: () => void; onDuplicate: () => void }) {
  return <div className="engine-project-settings"><label><span>Project name</span><input value={project.name} onChange={(event) => onUpdateProject({ name: event.target.value.slice(0, 80) })} /></label><label><span>Description</span><input value={project.description} onChange={(event) => onUpdateProject({ description: event.target.value.slice(0, 600) })} /></label><label><span>Tags</span><input value={project.tags.join(", ")} onChange={(event) => onUpdateProject({ tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20) })} /></label><label><span>Sky preset</span><select value={project.settings.skybox} onChange={(event) => onUpdateSettings({ skybox: event.target.value as FluxEngineProject["settings"]["skybox"] })}><option value="none">None</option><option value="studio">Studio</option><option value="sunset">Sunset</option><option value="night">Night</option></select></label><div className="engine-project-actions"><button type="button" onClick={onExportProject}><FileJson />Export project</button><button type="button" onClick={onImportProject}><Upload />Import project</button><button type="button" onClick={onExportGame}><Download />Export HTML</button><button type="button" onClick={onDuplicate}><Copy />Duplicate world</button></div></div>;
}

function CommandPalette({ value, onChange, onRun, onClose, onQuick }: { value: string; onChange: (value: string) => void; onRun: () => void; onClose: () => void; onQuick: (value: string) => void }) {
  const quick = ["Add a box", "Create a red sphere #ef4444", "Duplicate selected", "Center selected", "Make selected bigger", "Focus selected", "Save version", "Play"];
  return <div className="engine-modal-backdrop" onMouseDown={onClose}><section className="engine-command-palette" onMouseDown={(event) => event.stopPropagation()}><div className="engine-command-input"><Command /><input autoFocus value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onRun(); if (event.key === "Escape") onClose(); }} placeholder="Type a Studio command…" /><kbd>ESC</kbd></div><div className="engine-command-results"><p>Quick commands</p>{quick.map((item) => <button key={item} type="button" onClick={() => onQuick(item)}><Sparkles /><span>{item}</span><ChevronRight /></button>)}</div><footer><Keyboard />Create objects, transform selections, play or save without remote AI.</footer></section></div>;
}

function ProjectBrowser({ projects, activeId, onOpen, onCreate, onDuplicate, onDelete, onClose }: { projects: FluxEngineProject[]; activeId: string; onOpen: (project: FluxEngineProject) => void; onCreate: () => void; onDuplicate: () => void; onDelete: (id: string) => void; onClose: () => void }) {
  return <div className="engine-modal-backdrop" onMouseDown={onClose}><section className="engine-project-browser" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>Your worlds</strong><small>Local Flux Engine projects</small></div><Button onClick={onCreate} className="h-9 rounded-lg"><Plus className="h-4 w-4" />New world</Button><button type="button" onClick={onClose}><X /></button></header><div className="engine-project-grid">{projects.map((project) => <article key={project.id} className={cn(project.id === activeId && "active")}><button type="button" className="engine-project-preview" onClick={() => onOpen(project)}>{project.thumbnail ? <img src={project.thumbnail} alt="" /> : <Globe2 />}<span>{project.nodes.length} objects</span></button><div><strong>{project.name}</strong><small>Edited {new Date(project.updatedAt).toLocaleDateString()}</small></div><footer><button type="button" onClick={() => onOpen(project)}>Open</button>{project.id === activeId ? <button type="button" onClick={onDuplicate}>Duplicate</button> : null}<button type="button" className="danger" onClick={() => onDelete(project.id)}><Trash2 /></button></footer></article>)}</div></section></div>;
}

function FeaturesModal({ onClose }: { onClose: () => void }) {
  const areas = [...new Set(FLUX_ENGINE_FEATURES.map((feature) => feature.area))];
  return <div className="engine-modal-backdrop" onMouseDown={onClose}><section className="engine-features-modal" onMouseDown={(event) => event.stopPropagation()}><header><div><strong>100-feature Engine release</strong><small>Tracked capabilities, not placeholder cards</small></div><span>100</span><button type="button" onClick={onClose}><X /></button></header><div>{areas.map((area) => <section key={area}><h3>{area}</h3><div>{FLUX_ENGINE_FEATURES.filter((feature) => feature.area === area).map((feature) => <article key={feature.id}><Check /><span><strong>{feature.name}</strong><small>{feature.description}</small></span></article>)}</div></section>)}</div></section></div>;
}

function MobileDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="engine-mobile-backdrop" onClick={onClose}><section className="engine-mobile-drawer" onClick={(event) => event.stopPropagation()}><header><strong>{title}</strong><button type="button" onClick={onClose}><X /></button></header><div>{children}</div></section></div>;
}

function PlayOverlay({ onJump }: { onJump: () => void }) {
  const key = (value: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { key: value, code: value === " " ? "Space" : `Key${value.toUpperCase()}`, bubbles: true }));
  return <div className="engine-play-overlay"><div className="engine-play-badge"><Play />PLAYING</div><div className="engine-touch-controls"><div>{[["", "w", ""], ["a", "s", "d"]].flat().map((value, index) => value ? <button key={`${value}-${index}`} type="button" onPointerDown={() => key(value, true)} onPointerUp={() => key(value, false)} onPointerCancel={() => key(value, false)}>{value === "w" ? "▲" : value === "a" ? "◀" : value === "s" ? "▼" : "▶"}</button> : <span key={`empty-${index}`} />)}</div><button type="button" className="jump" onClick={onJump}>JUMP</button></div></div>;
}

function nodeIcon(kind: EngineNodeKind): LucideIcon {
  if (kind === "sphere") return Circle;
  if (kind === "cylinder") return Cylinder;
  if (kind === "cone") return Triangle;
  if (kind === "plane" || kind === "ground") return Square;
  if (kind === "terrain") return Mountain;
  if (kind === "spawn") return MapPin;
  if (kind === "directional-light") return Sun;
  if (kind === "point-light") return Lightbulb;
  if (kind === "spot-light") return Flashlight;
  if (kind === "model") return Package;
  return Box;
}

function multiplyVector(vector: EngineVector3, amount: number): EngineVector3 { return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount }; }
function round(value: number): number { return Math.round(value * 1000) / 1000; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flux-world"; }
function readFileAsDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error || new Error("File could not be read.")); reader.readAsDataURL(file); }); }
function downloadText(name: string, content: string, type: string): void { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
