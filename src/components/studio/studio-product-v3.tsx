"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Braces,
  ChevronLeft,
  Circle,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  Gamepad2,
  GripVertical,
  History,
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  Maximize2,
  Monitor,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
  RectangleHorizontal,
  Rocket,
  Save,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Unlock,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { fileToDataUrl, studioThumbnailToDataUrl } from "@/lib/media-processing";
import {
  createDefaultScene,
  createProjectRevision,
  deleteLocalProject,
  getLocalProject,
  listLocalProjects,
  publishCommunityGame,
  restoreProjectRevision,
  saveLocalProject,
  type GeneratedProject,
  type GeneratedProjectKind,
  type StudioObjectType,
  type StudioScene,
  type StudioSceneObject,
} from "@/services/studio-projects";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkspaceTab = "scene" | "code" | "versions";
type Viewport = "desktop" | "tablet" | "phone";
type DragMode = "move" | "resize";

interface DragState {
  pointerId: number;
  mode: DragMode;
  objectId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  scaleX: number;
  scaleY: number;
}

const PALETTE = ["#ffffff", "#111827", "#2563eb", "#7c3aed", "#ec4899", "#ef4444", "#f59e0b", "#10b981", "#06b6d4"];

export default function StudioProductV3() {
  const { user } = useAuth();
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [projects, setProjects] = useState<GeneratedProject[]>([]);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<WorkspaceTab>("scene");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [command, setCommand] = useState("");
  const [commandBusy, setCommandBusy] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [newKind, setNewKind] = useState<GeneratedProjectKind>("game");
  const scene = project?.scene || createDefaultScene();
  const selected = scene.objects.find((object) => object.id === selectedId) || null;

  useEffect(() => {
    const stored = listLocalProjects();
    const requestedId = new URLSearchParams(window.location.search).get("project");
    const selectedProject = (requestedId && getLocalProject(requestedId)) || stored[0] || null;
    setProjects(stored);
    if (selectedProject) selectProject(selectedProject);
  }, []);

  useEffect(() => {
    if (!project) return;
    const timer = window.setTimeout(() => {
      const synced = { ...project, code: generateSceneCode(project.title, project.scene || createDefaultScene()) };
      const saved = saveLocalProject(synced);
      setProjects(listLocalProjects());
      setProject((current) => current?.id === saved.id ? { ...current, updatedAt: saved.updatedAt, code: saved.code } : current);
      setCodeDraft(saved.code);
    }, 550);
    return () => window.clearTimeout(timer);
    // Autosave scene and metadata changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.title, project?.description, project?.hashtags, project?.thumbnail, project?.multiplayer, project?.maxPlayers, project?.scene]);

  const selectProject = (next: GeneratedProject) => {
    const normalized = { ...next, scene: next.scene || createDefaultScene() };
    setProject(normalized);
    setCodeDraft(normalized.code || generateSceneCode(normalized.title, normalized.scene));
    setSelectedId(normalized.scene.objects[0]?.id || null);
  };

  const updateProject = (patch: Partial<GeneratedProject>) => {
    setProject((current) => current ? { ...current, ...patch, updatedAt: Date.now() } : current);
  };

  const updateScene = (updater: (scene: StudioScene) => StudioScene) => {
    setProject((current) => current ? { ...current, scene: updater(current.scene || createDefaultScene()), updatedAt: Date.now() } : current);
  };

  const updateObject = (id: string, patch: Partial<StudioSceneObject>) => {
    updateScene((current) => ({ ...current, objects: current.objects.map((object) => object.id === id ? { ...object, ...patch } : object) }));
  };

  const createProject = () => {
    if (!user) return toast.error("Sign in to create a project.");
    const now = Date.now();
    const nextScene = createDefaultScene();
    const next: GeneratedProject = {
      id: `project-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ownerId: user.uid,
      kind: newKind,
      title: newKind === "game" ? "Untitled Game" : "Untitled Website",
      description: "",
      hashtags: [newKind, "fluxstudio"],
      code: generateSceneCode(newKind === "game" ? "Untitled Game" : "Untitled Website", nextScene),
      thumbnail: "linear-gradient(135deg,#0f172a,#2563eb,#22d3ee)",
      thumbnailFileName: null,
      multiplayer: false,
      maxPlayers: 1,
      selectedAssetIds: [],
      assistantHistory: [],
      revisions: [],
      scene: nextScene,
      createdAt: now,
      updatedAt: now,
      publishedId: null,
    };
    const saved = saveLocalProject(next);
    setProjects(listLocalProjects());
    selectProject(saved);
    setLeftOpen(false);
    toast.success("Blank visual project created");
  };

  const addObject = (type: StudioObjectType, imageUrl = "") => {
    if (!project) return;
    const count = scene.objects.filter((item) => item.type === type).length + 1;
    const object: StudioSceneObject = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      name: `${capitalize(type)} ${count}`,
      x: 100 + count * 18,
      y: 100 + count * 16,
      width: type === "text" ? 360 : type === "button" ? 220 : type === "image" ? 260 : 160,
      height: type === "text" ? 70 : type === "button" ? 64 : type === "image" ? 180 : 120,
      rotation: 0,
      fill: type === "button" ? "#ffffff" : type === "text" || type === "image" ? "transparent" : "#2563eb",
      text: type === "text" ? "New text" : type === "button" ? "Button" : "",
      textColor: type === "button" ? "#111111" : "#ffffff",
      fontSize: type === "text" ? 42 : 20,
      borderRadius: type === "circle" ? 999 : type === "button" ? 28 : 12,
      opacity: 1,
      imageUrl,
      locked: false,
      hidden: false,
    };
    updateScene((current) => ({ ...current, objects: [...current.objects, object].slice(-100) }));
    setSelectedId(object.id);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    updateScene((current) => ({ ...current, objects: current.objects.filter((object) => object.id !== selectedId) }));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = { ...selected, id: `${selected.type}-${Date.now()}`, name: `${selected.name} copy`, x: selected.x + 24, y: selected.y + 24, locked: false };
    updateScene((current) => ({ ...current, objects: [...current.objects, duplicate].slice(-100) }));
    setSelectedId(duplicate.id);
  };

  const reorder = (direction: "up" | "down") => {
    if (!selectedId) return;
    updateScene((current) => {
      const index = current.objects.findIndex((object) => object.id === selectedId);
      const target = direction === "up" ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= current.objects.length) return current;
      const objects = [...current.objects];
      [objects[index], objects[target]] = [objects[target], objects[index]];
      return { ...current, objects };
    });
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>, object: StudioSceneObject, mode: DragMode) => {
    if (object.locked) return;
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = stage.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      mode,
      objectId: object.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: object.x,
      startY: object.y,
      startWidth: object.width,
      startHeight: object.height,
      scaleX: scene.width / bounds.width,
      scaleY: scene.height / bounds.height,
    };
    setSelectedId(object.id);
  };

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const dx = (event.clientX - drag.startClientX) * drag.scaleX;
    const dy = (event.clientY - drag.startClientY) * drag.scaleY;
    if (drag.mode === "move") {
      updateObject(drag.objectId, { x: clamp(drag.startX + dx, 0, scene.width - 20), y: clamp(drag.startY + dy, 0, scene.height - 20) });
    } else {
      updateObject(drag.objectId, { width: clamp(drag.startWidth + dx, 20, scene.width), height: clamp(drag.startHeight + dy, 12, scene.height) });
    }
  };

  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const uploadThumbnail = async (file: File | null) => {
    if (!file || !project) return;
    try {
      const thumbnail = await studioThumbnailToDataUrl(file);
      updateProject({ thumbnail, thumbnailFileName: file.name.slice(0, 120) });
      toast.success("Thumbnail updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process thumbnail");
    }
  };

  const uploadImageObject = async (file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      addObject("image", dataUrl);
      toast.success("Image added to scene");
    } catch {
      toast.error("Could not read that image");
    }
  };

  const snapshot = () => {
    if (!project) return;
    const synced = saveLocalProject({ ...project, code: generateSceneCode(project.title, scene) });
    const revised = createProjectRevision(synced, "Visual editor snapshot");
    setProject(revised);
    setProjects(listLocalProjects());
    toast.success("Restore point saved");
  };

  const restore = (revisionId: string) => {
    if (!project) return;
    const restored = restoreProjectRevision(project, revisionId);
    selectProject(restored);
    setProjects(listLocalProjects());
    toast.success("Version restored");
  };

  const publish = async () => {
    if (!project || project.kind !== "game") return;
    setPublishing(true);
    try {
      const code = generateSceneCode(project.title, scene);
      const saved = saveLocalProject({ ...project, code });
      const id = await publishCommunityGame(saved);
      const next = saveLocalProject({ ...saved, publishedId: id });
      setProject(next);
      setProjects(listLocalProjects());
      toast.success("Published to Flux Games");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish game");
    } finally {
      setPublishing(false);
    }
  };

  const applyLocalCommand = async () => {
    if (!project || !command.trim() || commandBusy) return;
    setCommandBusy(true);
    const request = command.trim();
    setCommand("");
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    try {
      const result = runStudioCommand(scene, selected, request);
      updateProject({ scene: result.scene });
      if (result.selectedId) setSelectedId(result.selectedId);
      toast.success(result.message);
    } finally {
      setCommandBusy(false);
    }
  };

  const saveCode = () => {
    if (!project) return;
    const saved = saveLocalProject({ ...project, code: codeDraft });
    setProject(saved);
    setProjects(listLocalProjects());
    toast.success("Code saved");
  };

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 flex-col overflow-hidden bg-[#000000] text-white lg:h-[100dvh]">
      <header className="flex min-h-14 items-center gap-2 border-b border-white/10 bg-[#16181c] px-2 sm:px-3">
        <Link href="/games" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/7" aria-label="Back to Games"><ChevronLeft className="h-5 w-5" /></Link>
        <button type="button" onClick={() => setLeftOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 lg:hidden" aria-label="Open project list"><PanelLeft className="h-5 w-5" /></button>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black"><Gamepad2 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-black">{project?.title || "Flux Studio"}</h1><p className="truncate text-[10px] text-white/35">{project ? `${scene.objects.length} scene objects · autosaved` : "Visual game and website editor"}</p></div>
        <button type="button" onClick={() => setRightOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 xl:hidden" aria-label="Open inspector"><PanelRight className="h-5 w-5" /></button>
        <Button variant="outline" onClick={snapshot} disabled={!project} className="hidden h-10 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/7 sm:inline-flex"><History className="h-4 w-4" />Snapshot</Button>
        {project?.kind === "game" ? <Button onClick={() => void publish()} disabled={publishing} className="h-10 rounded-xl bg-white px-3 font-black text-black hover:bg-white/90">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}<span className="hidden sm:inline">Publish</span></Button> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <ProjectsPanel open={leftOpen} projects={projects} project={project} newKind={newKind} onClose={() => setLeftOpen(false)} onKind={setNewKind} onCreate={createProject} onSelect={(next) => { selectProject(next); setLeftOpen(false); }} onDelete={(id) => { deleteLocalProject(id); const next = listLocalProjects(); setProjects(next); if (project?.id === id) next[0] ? selectProject(next[0]) : setProject(null); }} />

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-12 items-center gap-1 border-b border-white/10 bg-[#16181c] px-2">
            <TabButton active={tab === "scene"} icon={MousePointer2} label="Scene" onClick={() => setTab("scene")} />
            <TabButton active={tab === "code"} icon={Code2} label="Code" onClick={() => setTab("code")} />
            <TabButton active={tab === "versions"} icon={History} label="Versions" onClick={() => setTab("versions")} />
            <div className="ml-auto flex rounded-xl bg-black/30 p-1"><ViewportButton active={viewport === "desktop"} icon={Monitor} label="Desktop" onClick={() => setViewport("desktop")} /><ViewportButton active={viewport === "tablet"} icon={Tablet} label="Tablet" onClick={() => setViewport("tablet")} /><ViewportButton active={viewport === "phone"} icon={Smartphone} label="Phone" onClick={() => setViewport("phone")} /></div>
          </div>

          {tab === "scene" ? <SceneWorkspace project={project} scene={scene} selectedId={selectedId} viewport={viewport} stageRef={stageRef} onSelect={setSelectedId} onAdd={addObject} onImage={() => imageInputRef.current?.click()} onBackground={(background) => updateScene((current) => ({ ...current, background }))} onBeginDrag={beginDrag} onMoveDrag={moveDrag} onEndDrag={endDrag} command={command} commandBusy={commandBusy} onCommand={setCommand} onApplyCommand={() => void applyLocalCommand()} /> : null}
          {tab === "code" ? <div className="flex min-h-0 flex-1 flex-col"><div className="flex min-h-11 items-center border-b border-white/10 px-3 text-[10px] font-bold uppercase tracking-wider text-white/35"><FileCode2 className="mr-2 h-4 w-4" />index.html<Button onClick={saveCode} className="ml-auto h-8 rounded-lg bg-white px-3 text-xs font-black text-black hover:bg-white/90"><Save className="h-3.5 w-3.5" />Save code</Button></div><textarea value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none bg-[#0a0c0f] p-4 font-mono text-[12px] leading-6 text-emerald-200 outline-none sm:p-6 sm:text-[13px]" /></div> : null}
          {tab === "versions" ? <Versions project={project} onSnapshot={snapshot} onRestore={restore} /> : null}
        </section>

        <InspectorPanel open={rightOpen} project={project} selected={selected} scene={scene} onClose={() => setRightOpen(false)} onProject={updateProject} onObject={updateObject} onDuplicate={duplicateSelected} onDelete={deleteSelected} onReorder={reorder} onThumbnail={() => thumbnailInputRef.current?.click()} />
      </div>

      <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadThumbnail(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadImageObject(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
    </main>
  );
}

function ProjectsPanel(props: { open: boolean; projects: GeneratedProject[]; project: GeneratedProject | null; newKind: GeneratedProjectKind; onClose: () => void; onKind: (kind: GeneratedProjectKind) => void; onCreate: () => void; onSelect: (project: GeneratedProject) => void; onDelete: (id: string) => void }) {
  return <><button type="button" onClick={props.onClose} className={cn("fixed inset-0 z-50 bg-black/55 lg:hidden", !props.open && "hidden")} aria-label="Close project panel" /><aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[min(90vw,320px)] flex-col border-r border-white/10 bg-[#16181c] transition-transform lg:static lg:z-auto lg:w-[280px] lg:translate-x-0", props.open ? "translate-x-0" : "-translate-x-full")}><div className="border-b border-white/10 p-3"><div className="flex items-center"><h2 className="text-xs font-black">Projects</h2><button type="button" onClick={props.onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-white/7 lg:hidden"><X className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => props.onKind("game")} className={cn("h-9 rounded-lg text-xs font-bold", props.newKind === "game" ? "bg-white text-black" : "bg-white/6 text-white/45")}>Game</button><button type="button" onClick={() => props.onKind("website")} className={cn("h-9 rounded-lg text-xs font-bold", props.newKind === "website" ? "bg-white text-black" : "bg-white/6 text-white/45")}>Website</button></div><button type="button" onClick={props.onCreate} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/12 text-xs font-black hover:bg-white/7"><Plus className="h-4 w-4" />Blank project</button></div><div className="min-h-0 flex-1 overflow-y-auto p-2">{props.projects.map((item) => <div key={item.id} className={cn("group flex items-center gap-2 rounded-xl p-2", item.id === props.project?.id ? "bg-white/9" : "hover:bg-white/5")}><button type="button" onClick={() => props.onSelect(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-white/7" style={{ background: item.thumbnail }}>{item.thumbnail.startsWith("data:") ? <img src={item.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{item.title}</span><span className="block text-[9px] text-white/30">{item.kind} · {item.scene?.objects.length || 0} objects</span></span></button><button type="button" onClick={() => props.onDelete(item.id)} className="grid h-8 w-8 place-items-center rounded-lg text-white/25 opacity-0 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></aside></>;
}

function SceneWorkspace(props: { project: GeneratedProject | null; scene: StudioScene; selectedId: string | null; viewport: Viewport; stageRef: React.RefObject<HTMLDivElement | null>; onSelect: (id: string | null) => void; onAdd: (type: StudioObjectType) => void; onImage: () => void; onBackground: (color: string) => void; onBeginDrag: (event: React.PointerEvent<HTMLElement>, object: StudioSceneObject, mode: DragMode) => void; onMoveDrag: (event: React.PointerEvent<HTMLElement>) => void; onEndDrag: (event: React.PointerEvent<HTMLElement>) => void; command: string; commandBusy: boolean; onCommand: (value: string) => void; onApplyCommand: () => void }) {
  if (!props.project) return <div className="grid flex-1 place-items-center text-center"><div><Gamepad2 className="mx-auto h-8 w-8 text-white/25" /><h2 className="mt-4 text-2xl font-black">Create a project</h2><p className="mt-2 text-sm text-white/35">Start blank, then add visual objects.</p></div></div>;
  const scaleClass = props.viewport === "desktop" ? "w-full max-w-[1100px]" : props.viewport === "tablet" ? "w-[min(86vw,760px)]" : "w-[min(82vw,390px)]";
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex min-h-12 items-center gap-1 overflow-x-auto border-b border-white/10 px-2 no-scrollbar"><AddButton icon={RectangleHorizontal} label="Box" onClick={() => props.onAdd("rectangle")} /><AddButton icon={Circle} label="Circle" onClick={() => props.onAdd("circle")} /><AddButton icon={Type} label="Text" onClick={() => props.onAdd("text")} /><AddButton icon={Box} label="Button" onClick={() => props.onAdd("button")} /><AddButton icon={ImagePlus} label="Image" onClick={props.onImage} /><div className="ml-auto flex gap-1">{PALETTE.slice(1).map((color) => <button key={color} type="button" onClick={() => props.onBackground(color)} className="h-7 w-7 rounded-lg border border-white/15" style={{ background: color }} aria-label={`Use ${color} background`} />)}</div></div><div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#0a0c0f] p-4 sm:p-8"><div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:24px_24px]" /><div ref={props.stageRef} onPointerDown={(event) => { if (event.target === event.currentTarget) props.onSelect(null); }} className={cn("relative z-10 aspect-video touch-none overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,.65)]", scaleClass)} style={{ background: props.scene.background }}>{props.scene.objects.map((object, index) => object.hidden ? null : <SceneObject key={object.id} object={object} index={index} scene={props.scene} selected={object.id === props.selectedId} onSelect={() => props.onSelect(object.id)} onBegin={props.onBeginDrag} onMove={props.onMoveDrag} onEnd={props.onEndDrag} />)}</div></div><div className="border-t border-white/10 bg-[#16181c] p-2"><div className="mx-auto flex max-w-4xl gap-2"><input value={props.command} onChange={(event) => props.onCommand(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") props.onApplyCommand(); }} placeholder="Local command: add a red button, center selected, make background blue…" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none focus:border-white/25" /><Button onClick={props.onApplyCommand} disabled={!props.command.trim() || props.commandBusy} className="h-11 rounded-xl bg-white px-4 font-black text-black hover:bg-white/90">{props.commandBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">Apply</span></Button></div></div></div>;
}

function SceneObject({ object, index, scene, selected, onSelect, onBegin, onMove, onEnd }: { object: StudioSceneObject; index: number; scene: StudioScene; selected: boolean; onSelect: () => void; onBegin: (event: React.PointerEvent<HTMLElement>, object: StudioSceneObject, mode: DragMode) => void; onMove: (event: React.PointerEvent<HTMLElement>) => void; onEnd: (event: React.PointerEvent<HTMLElement>) => void }) {
  return <div className={cn("absolute", selected && "outline outline-2 outline-white outline-offset-2")} style={{ left: `${object.x / scene.width * 100}%`, top: `${object.y / scene.height * 100}%`, width: `${object.width / scene.width * 100}%`, height: `${object.height / scene.height * 100}%`, zIndex: 10 + index, transform: `rotate(${object.rotation}deg)`, opacity: object.opacity }}><button type="button" onClick={onSelect} onPointerDown={(event) => onBegin(event, object, "move")} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} className={cn("h-full w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing", object.locked && "cursor-not-allowed")} style={{ background: object.type === "text" || object.type === "image" ? "transparent" : object.fill, color: object.textColor, borderRadius: object.type === "circle" ? "999px" : `${object.borderRadius}px`, fontSize: `${object.fontSize}px`, fontWeight: 800 }}>{object.type === "image" && object.imageUrl ? <img src={object.imageUrl} alt={object.name} className="h-full w-full object-cover" /> : object.type === "text" || object.type === "button" ? object.text : null}</button>{selected && !object.locked ? <button type="button" onPointerDown={(event) => onBegin(event, object, "resize")} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} className="absolute -bottom-3 -right-3 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-xl" aria-label="Resize"><Maximize2 className="h-3.5 w-3.5" /></button> : null}</div>;
}

function InspectorPanel(props: { open: boolean; project: GeneratedProject | null; selected: StudioSceneObject | null; scene: StudioScene; onClose: () => void; onProject: (patch: Partial<GeneratedProject>) => void; onObject: (id: string, patch: Partial<StudioSceneObject>) => void; onDuplicate: () => void; onDelete: () => void; onReorder: (direction: "up" | "down") => void; onThumbnail: () => void }) {
  return <><button type="button" onClick={props.onClose} className={cn("fixed inset-0 z-50 bg-black/55 xl:hidden", !props.open && "hidden")} aria-label="Close inspector" /><aside className={cn("fixed inset-y-0 right-0 z-[60] flex w-[min(94vw,370px)] flex-col border-l border-white/10 bg-[#16181c] transition-transform xl:static xl:z-auto xl:w-[350px] xl:translate-x-0", props.open ? "translate-x-0" : "translate-x-full")}><div className="flex min-h-14 items-center gap-2 border-b border-white/10 px-4"><h2 className="text-sm font-black">Inspector</h2><button type="button" onClick={props.onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-white/7 xl:hidden"><X className="h-4 w-4" /></button></div><div className="min-h-0 flex-1 overflow-y-auto p-4">{!props.project ? <p className="text-sm text-white/35">Select a project.</p> : props.selected ? <ObjectInspector object={props.selected} onUpdate={(patch) => props.onObject(props.selected!.id, patch)} onDuplicate={props.onDuplicate} onDelete={props.onDelete} onReorder={props.onReorder} /> : <ProjectInspector project={props.project} onProject={props.onProject} onThumbnail={props.onThumbnail} />}</div></aside></>;
}

function ObjectInspector({ object, onUpdate, onDuplicate, onDelete, onReorder }: { object: StudioSceneObject; onUpdate: (patch: Partial<StudioSceneObject>) => void; onDuplicate: () => void; onDelete: () => void; onReorder: (direction: "up" | "down") => void }) {
  return <div className="space-y-4"><div className="flex items-center gap-2"><button type="button" onClick={onDuplicate} className="inspector-button"><Copy className="h-4 w-4" />Duplicate</button><button type="button" onClick={() => onUpdate({ locked: !object.locked })} className="inspector-button">{object.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{object.locked ? "Unlock" : "Lock"}</button><button type="button" onClick={onDelete} className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-300"><Trash2 className="h-4 w-4" /></button></div><Property label="Name"><input value={object.name} onChange={(event) => onUpdate({ name: event.target.value.slice(0, 60) })} className="studio-property" /></Property>{object.type === "text" || object.type === "button" ? <Property label="Text"><textarea value={object.text} onChange={(event) => onUpdate({ text: event.target.value.slice(0, 200) })} className="studio-property min-h-20 resize-none py-3" /></Property> : null}<div className="grid grid-cols-2 gap-3"><NumberProperty label="X" value={object.x} onChange={(x) => onUpdate({ x })} /><NumberProperty label="Y" value={object.y} onChange={(y) => onUpdate({ y })} /><NumberProperty label="Width" value={object.width} onChange={(width) => onUpdate({ width })} /><NumberProperty label="Height" value={object.height} onChange={(height) => onUpdate({ height })} /></div><RangeProperty label="Rotation" value={object.rotation} min={-180} max={180} step={1} display={`${Math.round(object.rotation)}°`} onChange={(rotation) => onUpdate({ rotation })} /><RangeProperty label="Opacity" value={object.opacity} min={.1} max={1} step={.05} display={`${Math.round(object.opacity * 100)}%`} onChange={(opacity) => onUpdate({ opacity })} />{object.type !== "image" && object.type !== "text" ? <ColorProperty label="Fill" value={object.fill} onChange={(fill) => onUpdate({ fill })} /> : null}{object.type === "text" || object.type === "button" ? <><RangeProperty label="Font size" value={object.fontSize} min={8} max={160} step={1} display={`${object.fontSize}px`} onChange={(fontSize) => onUpdate({ fontSize })} /><ColorProperty label="Text color" value={object.textColor} onChange={(textColor) => onUpdate({ textColor })} /></> : null}<RangeProperty label="Corner radius" value={object.borderRadius} min={0} max={120} step={1} display={`${object.borderRadius}px`} onChange={(borderRadius) => onUpdate({ borderRadius })} /><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onReorder("up")} className="inspector-button justify-center">Bring forward</button><button type="button" onClick={() => onReorder("down")} className="inspector-button justify-center">Send backward</button></div><button type="button" onClick={() => onUpdate({ hidden: !object.hidden })} className="inspector-button w-full justify-center">{object.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{object.hidden ? "Show object" : "Hide object"}</button></div>;
}

function ProjectInspector({ project, onProject, onThumbnail }: { project: GeneratedProject; onProject: (patch: Partial<GeneratedProject>) => void; onThumbnail: () => void }) {
  return <div className="space-y-4"><button type="button" onClick={onThumbnail} className="relative block aspect-video w-full overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/5" style={{ background: project.thumbnail }}>{project.thumbnail.startsWith("data:") ? <img src={project.thumbnail} alt="Thumbnail" className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-xs font-bold"><Upload className="mb-2 h-5 w-5" />Upload thumbnail</span>}</button><Property label="Project name"><input value={project.title} onChange={(event) => onProject({ title: event.target.value.slice(0, 80) })} className="studio-property" /></Property><Property label="Description"><textarea value={project.description} onChange={(event) => onProject({ description: event.target.value.slice(0, 600) })} className="studio-property min-h-24 resize-none py-3" /></Property><Property label="Tags"><input value={project.hashtags.join(", ")} onChange={(event) => onProject({ hashtags: event.target.value.split(/[,\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).slice(0, 12) })} className="studio-property" /></Property>{project.kind === "game" ? <label className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Multiplayer metadata</span><span className="block text-[9px] text-white/32">Networking still needs a real backend.</span></span><input type="checkbox" checked={project.multiplayer} onChange={(event) => onProject({ multiplayer: event.target.checked, maxPlayers: event.target.checked ? Math.max(2, project.maxPlayers) : 1 })} className="h-5 w-5 accent-white" /></label> : null}</div>;
}

function Versions({ project, onSnapshot, onRestore }: { project: GeneratedProject | null; onSnapshot: () => void; onRestore: (id: string) => void }) {
  if (!project) return <div className="grid flex-1 place-items-center text-sm text-white/35">Select a project.</div>;
  const revisions = [...(project.revisions || [])].reverse();
  return <div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="mx-auto max-w-3xl"><div className="flex items-center"><div className="min-w-0 flex-1"><h2 className="text-2xl font-black">Versions</h2><p className="mt-1 text-xs text-white/35">Restore visual scene and code together.</p></div><Button onClick={onSnapshot} className="rounded-xl bg-white font-black text-black hover:bg-white/90"><Plus className="h-4 w-4" />Snapshot</Button></div><div className="mt-5 space-y-2">{revisions.map((revision) => <div key={revision.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-4"><History className="h-5 w-5 text-white/30" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{revision.label}</p><p className="mt-1 text-[9px] text-white/28">{new Date(revision.createdAt).toLocaleString()}</p></div><button type="button" onClick={() => onRestore(revision.id)} className="h-9 rounded-lg border border-white/12 px-3 text-xs font-bold">Restore</button></div>)}{!revisions.length ? <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/28">No versions yet.</div> : null}</div></div></div>;
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-bold", active ? "bg-white text-black" : "text-white/38 hover:bg-white/7 hover:text-white")}><Icon className="h-4 w-4" />{label}</button>; }
function ViewportButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-white text-black" : "text-white/35")} aria-label={label}><Icon className="h-3.5 w-3.5" /></button>; }
function AddButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[10px] font-bold text-white/50 hover:bg-white/7 hover:text-white"><Icon className="h-3.5 w-3.5" />{label}</button>; }
function Property({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-[9px] font-bold uppercase tracking-wider text-white/35">{label}<div className="mt-2 normal-case tracking-normal text-white">{children}</div></label>; }
function NumberProperty({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Property label={label}><input type="number" value={Math.round(value)} onChange={(event) => onChange(Number(event.target.value) || 0)} className="studio-property" /></Property>; }
function RangeProperty({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) { return <label className="block text-[9px] font-bold uppercase tracking-wider text-white/35"><span className="flex"><span>{label}</span><span className="ml-auto text-white/60">{display}</span></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-white" /></label>; }
function ColorProperty({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><p className="text-[9px] font-bold uppercase tracking-wider text-white/35">{label}</p><div className="mt-2 flex flex-wrap gap-2">{PALETTE.map((color) => <button key={color} type="button" onClick={() => onChange(color)} className={cn("h-8 w-8 rounded-lg border-2", color === value ? "border-white" : "border-transparent")} style={{ background: color }} />)}</div></div>; }

function runStudioCommand(scene: StudioScene, selected: StudioSceneObject | null, request: string): { scene: StudioScene; selectedId?: string; message: string } {
  const lower = request.toLowerCase();
  const color = colorFromText(lower);
  if (/background/.test(lower) && color) return { scene: { ...scene, background: color }, message: "Scene background updated" };
  if (/add|create/.test(lower)) {
    const type: StudioObjectType = /button/.test(lower) ? "button" : /circle/.test(lower) ? "circle" : /text|title|label/.test(lower) ? "text" : "rectangle";
    const id = `${type}-${Date.now()}`;
    const object: StudioSceneObject = { id, type, name: `Local ${capitalize(type)}`, x: scene.width / 2 - 100, y: scene.height / 2 - 40, width: type === "text" ? 360 : type === "button" ? 220 : 180, height: type === "text" ? 70 : type === "button" ? 64 : 120, rotation: 0, fill: color || (type === "button" ? "#ffffff" : "#2563eb"), text: extractQuoted(request) || (type === "text" ? "New text" : type === "button" ? "Button" : ""), textColor: type === "button" ? "#111111" : "#ffffff", fontSize: type === "text" ? 42 : 20, borderRadius: type === "circle" ? 999 : type === "button" ? 28 : 12, opacity: 1 };
    return { scene: { ...scene, objects: [...scene.objects, object] }, selectedId: id, message: `${capitalize(type)} added locally` };
  }
  if (!selected) return { scene, message: "Select an object first, or ask to add one" };
  const objects = scene.objects.map((object) => object.id === selected.id ? { ...object } : object);
  const target = objects.find((object) => object.id === selected.id)!;
  if (/delete|remove/.test(lower)) return { scene: { ...scene, objects: objects.filter((object) => object.id !== selected.id) }, message: "Selected object removed" };
  if (/duplicate|copy/.test(lower)) { const copy = { ...target, id: `${target.type}-${Date.now()}`, name: `${target.name} copy`, x: target.x + 24, y: target.y + 24 }; return { scene: { ...scene, objects: [...objects, copy] }, selectedId: copy.id, message: "Selected object duplicated" }; }
  if (/center/.test(lower)) { target.x = scene.width / 2 - target.width / 2; target.y = scene.height / 2 - target.height / 2; }
  if (/bigger|larger/.test(lower)) { target.width *= 1.2; target.height *= 1.2; }
  if (/smaller/.test(lower)) { target.width *= .8; target.height *= .8; }
  if (color) { if (target.type === "text") target.textColor = color; else target.fill = color; }
  const quoted = extractQuoted(request);
  if (quoted && (target.type === "text" || target.type === "button")) target.text = quoted;
  return { scene: { ...scene, objects }, selectedId: target.id, message: "Local edit applied" };
}

function generateSceneCode(title: string, scene: StudioScene): string {
  const objects = scene.objects.filter((object) => !object.hidden).map((object) => {
    const style = `position:absolute;left:${object.x}px;top:${object.y}px;width:${object.width}px;height:${object.height}px;transform:rotate(${object.rotation}deg);opacity:${object.opacity};background:${object.type === "text" || object.type === "image" ? "transparent" : object.fill};color:${object.textColor};font-size:${object.fontSize}px;font-weight:800;border-radius:${object.type === "circle" ? "999px" : `${object.borderRadius}px`};border:0;overflow:hidden;display:grid;place-items:center;`;
    if (object.type === "image" && object.imageUrl) return `<img src="${escapeHtml(object.imageUrl)}" alt="${escapeHtml(object.name)}" style="${style}object-fit:cover" />`;
    if (object.type === "button") return `<button type="button" style="${style}" data-flux-button>${escapeHtml(object.text)}</button>`;
    if (object.type === "text") return `<div style="${style}">${escapeHtml(object.text)}</div>`;
    return `<div style="${style}"></div>`;
  }).join("\n");
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />\n<title>${escapeHtml(title)}</title>\n<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#050608;font-family:Inter,system-ui,sans-serif}body{display:grid;place-items:center;padding:16px}.stage{position:relative;width:${scene.width}px;height:${scene.height}px;max-width:100%;aspect-ratio:${scene.width}/${scene.height};overflow:hidden;background:${scene.background};transform-origin:center}.stage>*{max-width:100%}@media(max-width:${scene.width + 32}px){.stage{transform:scale(calc((100vw - 32px)/${scene.width}));margin-block:calc((${scene.height}px * ((100vw - 32px)/${scene.width} - 1))/2)}}button{cursor:pointer}</style>\n</head>\n<body><main class="stage">${objects}</main><script>document.querySelectorAll('[data-flux-button]').forEach(button=>button.addEventListener('click',()=>{button.textContent=button.textContent==='Play'?'Playing':'Clicked'}));<\/script></body>\n</html>`;
}

function colorFromText(text: string): string | null { const map: Record<string,string> = { red: "#ef4444", blue: "#2563eb", green: "#10b981", yellow: "#f59e0b", orange: "#f97316", purple: "#7c3aed", pink: "#ec4899", black: "#111111", white: "#ffffff", cyan: "#06b6d4" }; return Object.entries(map).find(([name]) => text.includes(name))?.[1] || null; }
function extractQuoted(text: string): string { return text.match(/["']([^"']+)["']/)?.[1] || ""; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character)); }
function capitalize(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1); }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
