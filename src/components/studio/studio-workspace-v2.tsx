"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Braces,
  Check,
  ChevronLeft,
  Code2,
  ExternalLink,
  FileCode2,
  FileJson2,
  Gamepad2,
  History,
  ImagePlus,
  Layers3,
  Loader2,
  Maximize2,
  Monitor,
  Music2,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings2,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { generateProject } from "@/lib/project-generator";
import { studioThumbnailToDataUrl } from "@/lib/media-processing";
import {
  createProjectRevision,
  deleteLocalProject,
  getLocalProject,
  listLocalProjects,
  publishCommunityGame,
  restoreProjectRevision,
  saveLocalProject,
  type GeneratedProject,
  type GeneratedProjectKind,
  type StudioAssistantMessage,
} from "@/services/studio-projects";
import {
  STUDIO_ASSET_KINDS,
  STUDIO_MARKETPLACE_ASSETS,
  type StudioAssetKind,
  type StudioMarketplaceAsset,
} from "@/data/studio-marketplace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkspaceTab = "preview" | "html" | "css" | "javascript" | "assets" | "versions";
type Viewport = "desktop" | "tablet" | "phone";
type InspectorTab = "project" | "askai";

interface ProjectFiles {
  html: string;
  css: string;
  javascript: string;
}

const BLANK_GAME_FILES: ProjectFiles = {
  html: `<main class="game-shell">\n  <h1>My Flux Game</h1>\n  <p>Edit HTML, CSS and JavaScript using the file tabs.</p>\n  <button id="play">Play</button>\n  <div id="score">Score: 0</div>\n</main>`,
  css: `* { box-sizing: border-box; }\nhtml, body { margin: 0; min-height: 100%; font-family: system-ui, sans-serif; background: #08090c; color: white; }\n.game-shell { min-height: 100vh; display: grid; place-content: center; gap: 16px; padding: 24px; text-align: center; }\nbutton { border: 0; border-radius: 999px; padding: 14px 22px; font-weight: 900; cursor: pointer; }`,
  javascript: `let score = 0;\nconst scoreLabel = document.querySelector('#score');\ndocument.querySelector('#play')?.addEventListener('click', () => {\n  score += 10;\n  if (scoreLabel) scoreLabel.textContent = 'Score: ' + score;\n});`,
};

export default function StudioWorkspaceV2() {
  const { user } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<GeneratedProject[]>([]);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [files, setFiles] = useState<ProjectFiles>(BLANK_GAME_FILES);
  const [tab, setTab] = useState<WorkspaceTab>("preview");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("project");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [running, setRunning] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [newPrompt, setNewPrompt] = useState("A polished browser game with mobile controls");
  const [newKind, setNewKind] = useState<GeneratedProjectKind>("game");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetKind, setAssetKind] = useState<"all" | StudioAssetKind>("all");
  const endpoint = useMemo(resolveAskAIEndpoint, []);

  const refreshProjects = (preferredId?: string) => {
    const next = listLocalProjects();
    setProjects(next);
    const id = preferredId || project?.id;
    const selected = id ? next.find((item) => item.id === id) : next[0];
    if (selected) selectProject(selected);
    else {
      setProject(null);
      setFiles(BLANK_GAME_FILES);
    }
  };

  useEffect(() => {
    const stored = listLocalProjects();
    const requestedId = new URLSearchParams(window.location.search).get("project");
    const selected = (requestedId && getLocalProject(requestedId)) || stored[0] || null;
    setProjects(stored);
    if (selected) selectProject(selected);
    const listener = () => setProjects(listLocalProjects());
    window.addEventListener("flux-studio-projects-updated", listener);
    return () => window.removeEventListener("flux-studio-projects-updated", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProject = (next: GeneratedProject) => {
    setProject(next);
    setFiles(splitProjectCode(next.code));
    setPreviewKey((value) => value + 1);
    setRunning(true);
  };

  const updateProject = (patch: Partial<GeneratedProject>) => {
    setProject((current) => current ? { ...current, ...patch, updatedAt: Date.now() } : current);
  };

  const assembledCode = useMemo(() => assembleProjectCode(project?.title || "Flux Project", files), [files, project?.title]);

  const save = (message = "Project saved") => {
    if (!project) return;
    const saved = saveLocalProject({ ...project, code: assembledCode });
    setProject(saved);
    setProjects(listLocalProjects());
    toast.success(message);
  };

  const createBlank = () => {
    if (!user) return toast.error("Sign in to create a Studio project.");
    const now = Date.now();
    const next: GeneratedProject = {
      id: `project-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      ownerId: user.uid,
      kind: newKind,
      title: newKind === "game" ? "Untitled Game" : "Untitled Website",
      description: "",
      hashtags: [newKind, "fluxstudio"],
      code: assembleProjectCode(newKind === "game" ? "Untitled Game" : "Untitled Website", BLANK_GAME_FILES),
      thumbnail: "linear-gradient(135deg,#111827,#7c3aed,#22d3ee)",
      thumbnailFileName: null,
      multiplayer: false,
      maxPlayers: 1,
      selectedAssetIds: [],
      assistantHistory: [],
      revisions: [],
      createdAt: now,
      updatedAt: now,
      publishedId: null,
    };
    saveLocalProject(next);
    setProjects(listLocalProjects());
    selectProject(next);
    setLeftOpen(false);
    setInspectorTab("project");
    setRightOpen(true);
    toast.success("Blank project created");
  };

  const createStarter = () => {
    if (!user || !newPrompt.trim()) return;
    const next = generateProject({ ownerId: user.uid, kind: newKind, prompt: newPrompt.trim() });
    next.assistantHistory = [];
    next.revisions = [];
    next.thumbnailFileName = null;
    saveLocalProject(next);
    setProjects(listLocalProjects());
    selectProject(next);
    setLeftOpen(false);
    toast.success("Starter project created. Every file is editable.");
  };

  const snapshot = (label = "Manual snapshot") => {
    if (!project) return;
    const saved = saveLocalProject({ ...project, code: assembledCode });
    const revised = createProjectRevision(saved, label);
    setProject(revised);
    setProjects(listLocalProjects());
    toast.success("Revision saved");
  };

  const restoreRevision = (id: string) => {
    if (!project) return;
    const restored = restoreProjectRevision(project, id);
    selectProject(restored);
    setProjects(listLocalProjects());
    toast.success("Revision restored");
  };

  const uploadThumbnail = async (file: File | null) => {
    if (!project || !file) return;
    try {
      const dataUrl = await studioThumbnailToDataUrl(file);
      updateProject({ thumbnail: dataUrl, thumbnailFileName: file.name.slice(0, 120) });
      toast.success("Thumbnail ready. Save the project to keep it.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process thumbnail");
    }
  };

  const publish = async () => {
    if (!project || project.kind !== "game") return;
    setPublishing(true);
    try {
      const saved = saveLocalProject({ ...project, code: assembledCode });
      const id = await publishCommunityGame(saved);
      const next = saveLocalProject({ ...saved, publishedId: id });
      setProject(next);
      setProjects(listLocalProjects());
      toast.success("Published to Flux Games");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish this game");
    } finally {
      setPublishing(false);
    }
  };

  const askAI = async () => {
    if (!project || !assistantInput.trim() || assistantBusy) return;
    if (!endpoint) {
      toast.error("Remote AskAI is not connected on this deployment. Manual Studio editing still works.");
      return;
    }
    const request = assistantInput.trim();
    setAssistantInput("");
    setAssistantBusy(true);
    const userMessage: StudioAssistantMessage = { id: `user-${Date.now()}`, role: "user", content: request, createdAt: Date.now() };
    const history = [...(project.assistantHistory || []), userMessage].slice(-30);
    updateProject({ assistantHistory: history });

    try {
      const current = saveLocalProject({ ...project, code: assembledCode, assistantHistory: history });
      const withRevision = createProjectRevision(current, `Before AskAI: ${request.slice(0, 50)}`);
      const prompt = buildStudioEditPrompt(withRevision, request);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          history: history.slice(-10).map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!response.ok) throw new Error(`AskAI returned ${response.status}`);
      const raw = await readAIResponse(response);
      const replacement = extractCompleteHtml(raw);
      if (!replacement) {
        throw new Error("AskAI did not return a complete HTML project. Nothing was overwritten.");
      }
      const assistantMessage: StudioAssistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: `Applied: ${request}`,
        createdAt: Date.now(),
      };
      const next = saveLocalProject({
        ...withRevision,
        code: replacement,
        assistantHistory: [...history, assistantMessage].slice(-40),
      });
      selectProject(next);
      setProjects(listLocalProjects());
      setTab("preview");
      toast.success("AskAI edit applied. A restore point was saved first.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "AskAI could not edit this project";
      const failedMessage: StudioAssistantMessage = { id: `assistant-${Date.now()}`, role: "assistant", content: `Edit failed: ${message}`, createdAt: Date.now() };
      setProject((current) => current ? { ...current, assistantHistory: [...(current.assistantHistory || []), failedMessage].slice(-40) } : current);
      toast.error(message);
    } finally {
      setAssistantBusy(false);
    }
  };

  const filteredAssets = useMemo(() => {
    const needle = assetQuery.trim().toLowerCase();
    return STUDIO_MARKETPLACE_ASSETS.filter((asset) => {
      const kindMatches = assetKind === "all" || asset.kind === assetKind;
      const textMatches = !needle || [asset.name, asset.collection, asset.source, ...asset.tags].join(" ").toLowerCase().includes(needle);
      return kindMatches && textMatches;
    }).slice(0, assetKind === "music" ? 160 : 80);
  }, [assetKind, assetQuery]);

  const insertMusic = (asset: StudioMarketplaceAsset) => {
    if (!project || !asset.previewUrl) return;
    const safeUrl = asset.previewUrl.replace(/"/g, "&quot;");
    const audioMarkup = `<audio id="flux-project-music" src="${safeUrl}" loop preload="metadata"></audio>\n<button id="flux-music-toggle" type="button">Play music</button>`;
    const audioScript = `\nconst fluxProjectMusic = document.querySelector('#flux-project-music');\nconst fluxMusicToggle = document.querySelector('#flux-music-toggle');\nfluxMusicToggle?.addEventListener('click', async () => {\n  if (!fluxProjectMusic) return;\n  if (fluxProjectMusic.paused) { await fluxProjectMusic.play().catch(() => {}); fluxMusicToggle.textContent = 'Pause music'; }\n  else { fluxProjectMusic.pause(); fluxMusicToggle.textContent = 'Play music'; }\n});`;
    setFiles((current) => ({
      ...current,
      html: `${current.html.trim()}\n${audioMarkup}`,
      javascript: `${current.javascript.trim()}\n${audioScript}`,
    }));
    updateProject({ selectedAssetIds: [...new Set([...(project.selectedAssetIds || []), asset.id])].slice(0, 100) });
    setTab("javascript");
    toast.success(`${asset.name} inserted with a real play button`);
  };

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 flex-col overflow-hidden bg-[#08090c] text-white lg:h-[100dvh]">
      <header className="flex min-h-14 items-center gap-2 border-b border-white/10 bg-[#0b0c10] px-2 sm:px-3">
        <Link href="/games" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/8" aria-label="Back to Games"><ChevronLeft className="h-5 w-5" /></Link>
        <button type="button" onClick={() => setLeftOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 lg:hidden" aria-label="Open projects"><PanelLeft className="h-5 w-5" /></button>
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black"><Gamepad2 className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-black">{project?.title || "Flux Studio"}</h1><p className="truncate text-[10px] text-white/38">{project ? `${project.kind} · ${project.revisions?.length || 0} restore points` : "Manual browser game workspace"}</p></div>
        <button type="button" onClick={() => setRightOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 xl:hidden" aria-label="Open inspector"><PanelRight className="h-5 w-5" /></button>
        <Button variant="outline" onClick={() => save()} disabled={!project} className="hidden h-10 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/8 sm:inline-flex"><Save className="h-4 w-4" />Save</Button>
        <Button variant="outline" onClick={() => snapshot()} disabled={!project} className="hidden h-10 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/8 md:inline-flex"><History className="h-4 w-4" />Snapshot</Button>
        {project?.kind === "game" ? <Button onClick={() => void publish()} disabled={publishing} className="h-10 rounded-xl bg-white px-3 font-black text-black hover:bg-white/90">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}<span className="hidden sm:inline">Publish</span></Button> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <ProjectsSidebar
          open={leftOpen}
          projects={projects}
          activeId={project?.id || null}
          newKind={newKind}
          newPrompt={newPrompt}
          onClose={() => setLeftOpen(false)}
          onKind={setNewKind}
          onPrompt={setNewPrompt}
          onBlank={createBlank}
          onStarter={createStarter}
          onSelect={(next) => { selectProject(next); setLeftOpen(false); }}
          onDelete={(id) => { deleteLocalProject(id); refreshProjects(project?.id === id ? undefined : project?.id); }}
        />

        <section className="flex min-w-0 flex-1 flex-col bg-[#090a0d]">
          <div className="flex min-h-12 items-center gap-1 overflow-x-auto border-b border-white/10 bg-[#0d0f14] px-2 no-scrollbar">
            <WorkspaceTabButton active={tab === "preview"} icon={Play} label="Preview" onClick={() => setTab("preview")} />
            <WorkspaceTabButton active={tab === "html"} icon={FileCode2} label="HTML" onClick={() => setTab("html")} />
            <WorkspaceTabButton active={tab === "css"} icon={Braces} label="CSS" onClick={() => setTab("css")} />
            <WorkspaceTabButton active={tab === "javascript"} icon={FileJson2} label="JavaScript" onClick={() => setTab("javascript")} />
            <WorkspaceTabButton active={tab === "assets"} icon={Layers3} label="Assets" onClick={() => setTab("assets")} />
            <WorkspaceTabButton active={tab === "versions"} icon={History} label="Versions" onClick={() => setTab("versions")} />
            <div className="ml-auto flex items-center gap-1 rounded-xl bg-black/35 p-1">
              <ViewportButton active={viewport === "desktop"} icon={Monitor} label="Desktop" onClick={() => setViewport("desktop")} />
              <ViewportButton active={viewport === "tablet"} icon={Tablet} label="Tablet" onClick={() => setViewport("tablet")} />
              <ViewportButton active={viewport === "phone"} icon={Smartphone} label="Phone" onClick={() => setViewport("phone")} />
            </div>
          </div>

          {tab === "preview" ? (
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,#22252d_0,#08090c_68%)] p-3 sm:p-5">
              {project ? <div className={cn("relative overflow-hidden rounded-2xl border border-white/12 bg-black shadow-[0_28px_90px_rgba(0,0,0,.55)]", viewport === "desktop" && "h-full w-full", viewport === "tablet" && "h-[min(82vh,900px)] w-[min(82vw,768px)]", viewport === "phone" && "h-[min(82vh,860px)] w-[min(88vw,390px)]")}>
                {running ? <iframe key={previewKey} ref={iframeRef} title={`${project.title} preview`} srcDoc={assembledCode} sandbox="allow-scripts allow-pointer-lock" className="h-full w-full border-0" /> : <div className="grid h-full place-items-center text-sm text-white/35">Preview paused</div>}
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full border border-white/12 bg-black/72 p-1.5 backdrop-blur-xl"><button type="button" onClick={() => setRunning((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black" aria-label={running ? "Pause preview" : "Run preview"}>{running ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</button><button type="button" onClick={() => { setRunning(false); setPreviewKey((value) => value + 1); window.setTimeout(() => setRunning(true), 20); }} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Restart"><RotateCcw className="h-4 w-4" /></button><button type="button" onClick={() => iframeRef.current?.requestFullscreen?.()} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Fullscreen"><Maximize2 className="h-4 w-4" /></button></div>
              </div> : <EmptyWorkspace onBlank={createBlank} onStarter={createStarter} />}
            </div>
          ) : null}

          {tab === "html" || tab === "css" || tab === "javascript" ? <CodeEditor language={tab} value={tab === "html" ? files.html : tab === "css" ? files.css : files.javascript} onChange={(value) => setFiles((current) => ({ ...current, [tab === "javascript" ? "javascript" : tab]: value }))} /> : null}

          {tab === "assets" ? <AssetsWorkspace query={assetQuery} onQuery={setAssetQuery} kind={assetKind} onKind={setAssetKind} assets={filteredAssets} project={project} onInsertMusic={insertMusic} /> : null}

          {tab === "versions" ? <VersionsWorkspace project={project} onSnapshot={() => snapshot()} onRestore={restoreRevision} /> : null}
        </section>

        <Inspector
          open={rightOpen}
          tab={inspectorTab}
          project={project}
          files={files}
          endpointReady={Boolean(endpoint)}
          assistantInput={assistantInput}
          assistantBusy={assistantBusy}
          onClose={() => setRightOpen(false)}
          onTab={setInspectorTab}
          onProject={updateProject}
          onThumbnail={() => thumbnailInputRef.current?.click()}
          onAssistantInput={setAssistantInput}
          onAskAI={() => void askAI()}
          onSave={() => save()}
        />
      </div>

      <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void uploadThumbnail(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
    </main>
  );
}

function ProjectsSidebar(props: {
  open: boolean;
  projects: GeneratedProject[];
  activeId: string | null;
  newKind: GeneratedProjectKind;
  newPrompt: string;
  onClose: () => void;
  onKind: (kind: GeneratedProjectKind) => void;
  onPrompt: (value: string) => void;
  onBlank: () => void;
  onStarter: () => void;
  onSelect: (project: GeneratedProject) => void;
  onDelete: (id: string) => void;
}) {
  return <>
    {props.open ? <button type="button" className="fixed inset-0 z-50 bg-black/60 lg:hidden" onClick={props.onClose} aria-label="Close projects" /> : null}
    <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[min(90vw,330px)] flex-col border-r border-white/10 bg-[#0b0c10] transition-transform lg:static lg:z-auto lg:w-[292px] lg:translate-x-0", props.open ? "translate-x-0" : "-translate-x-full")}>
      <div className="border-b border-white/10 p-3">
        <div className="flex items-center"><h2 className="text-xs font-black uppercase tracking-[.14em] text-white/38">New project</h2><button type="button" onClick={props.onClose} className="ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8 lg:hidden"><X className="h-4 w-4" /></button></div>
        <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => props.onKind("game")} className={cn("rounded-xl py-2 text-xs font-black", props.newKind === "game" ? "bg-white text-black" : "bg-white/7 text-white/45")}>Game</button><button type="button" onClick={() => props.onKind("website")} className={cn("rounded-xl py-2 text-xs font-black", props.newKind === "website" ? "bg-white text-black" : "bg-white/7 text-white/45")}>Website</button></div>
        <button type="button" onClick={props.onBlank} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/12 text-xs font-black hover:bg-white/7"><Plus className="h-4 w-4" />Blank project</button>
        <textarea value={props.newPrompt} onChange={(event) => props.onPrompt(event.target.value)} className="mt-3 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 outline-none focus:border-white/30" placeholder="Describe a starter template" />
        <button type="button" onClick={props.onStarter} disabled={!props.newPrompt.trim()} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 text-xs font-black disabled:opacity-40"><WandSparkles className="h-4 w-4" />Create editable starter</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2"><p className="px-2 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white/28">Projects</p>{props.projects.map((item) => <div key={item.id} className={cn("group flex items-center gap-2 rounded-xl p-2", item.id === props.activeId ? "bg-white/10" : "hover:bg-white/6")}><button type="button" onClick={() => props.onSelect(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-white/8" style={{ background: item.thumbnail }}>{item.thumbnail.startsWith("data:") ? <img src={item.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{item.title}</span><span className="block truncate text-[10px] text-white/32">{item.kind} · {item.publishedId ? "published" : "draft"}</span></span></button><button type="button" onClick={() => props.onDelete(item.id)} className="grid h-9 w-9 place-items-center rounded-lg text-white/25 opacity-0 hover:bg-red-500/12 hover:text-red-300 group-hover:opacity-100" aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></button></div>)}{!props.projects.length ? <p className="px-4 py-10 text-center text-xs leading-5 text-white/28">Create a blank project or editable starter.</p> : null}</div>
    </aside>
  </>;
}

function Inspector(props: {
  open: boolean;
  tab: InspectorTab;
  project: GeneratedProject | null;
  files: ProjectFiles;
  endpointReady: boolean;
  assistantInput: string;
  assistantBusy: boolean;
  onClose: () => void;
  onTab: (tab: InspectorTab) => void;
  onProject: (patch: Partial<GeneratedProject>) => void;
  onThumbnail: () => void;
  onAssistantInput: (value: string) => void;
  onAskAI: () => void;
  onSave: () => void;
}) {
  return <>
    {props.open ? <button type="button" className="fixed inset-0 z-50 bg-black/60 xl:hidden" onClick={props.onClose} aria-label="Close inspector" /> : null}
    <aside className={cn("fixed inset-y-0 right-0 z-[60] flex w-[min(94vw,390px)] flex-col border-l border-white/10 bg-[#0b0c10] transition-transform xl:static xl:z-auto xl:w-[360px] xl:translate-x-0", props.open ? "translate-x-0" : "translate-x-full")}>
      <div className="flex min-h-14 items-center gap-1 border-b border-white/10 p-2"><button type="button" onClick={() => props.onTab("project")} className={cn("h-10 flex-1 rounded-xl text-xs font-black", props.tab === "project" ? "bg-white text-black" : "text-white/45 hover:bg-white/7")}>Project</button><button type="button" onClick={() => props.onTab("askai")} className={cn("flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-xs font-black", props.tab === "askai" ? "bg-white text-black" : "text-white/45 hover:bg-white/7")}><Sparkles className="h-4 w-4" />AskAI</button><button type="button" onClick={props.onClose} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/7 xl:hidden"><X className="h-4 w-4" /></button></div>
      {!props.project ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-white/30">Create or select a project.</div> : props.tab === "project" ? <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Thumbnail</p><button type="button" onClick={props.onThumbnail} className="mt-2 relative block aspect-video w-full overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/5" style={{ background: props.project.thumbnail }}>{props.project.thumbnail.startsWith("data:") ? <img src={props.project.thumbnail} alt="Game thumbnail" className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center"><span className="rounded-full bg-black/55 px-4 py-2 text-xs font-black"><Upload className="mr-2 inline h-4 w-4" />Upload 16:9 image</span></span>}</button><p className="mt-2 truncate text-[9px] text-white/28">{props.project.thumbnailFileName || "Generated placeholder—replace it before publishing"}</p></div>
        <Field label="Name"><input value={props.project.title} onChange={(event) => props.onProject({ title: event.target.value.slice(0, 80) })} className="studio-input" /></Field>
        <Field label="Description"><textarea value={props.project.description} onChange={(event) => props.onProject({ description: event.target.value.slice(0, 600) })} className="studio-input min-h-24 resize-none py-3" /></Field>
        <Field label="Tags"><input value={props.project.hashtags.join(", ")} onChange={(event) => props.onProject({ hashtags: event.target.value.split(/[,\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).slice(0, 12) })} className="studio-input" placeholder="arcade, mobile, city" /></Field>
        {props.project.kind === "game" ? <div className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><label className="flex items-center gap-3"><span className="min-w-0 flex-1"><span className="block text-sm font-black">Multiplayer metadata</span><span className="block text-[10px] leading-4 text-white/35">This does not create networking by itself.</span></span><input type="checkbox" checked={props.project.multiplayer} onChange={(event) => props.onProject({ multiplayer: event.target.checked, maxPlayers: event.target.checked ? Math.max(2, props.project!.maxPlayers) : 1 })} className="h-5 w-5 accent-white" /></label>{props.project.multiplayer ? <input type="number" min={2} max={50} value={props.project.maxPlayers} onChange={(event) => props.onProject({ maxPlayers: Math.max(2, Math.min(50, Number(event.target.value) || 2)) })} className="studio-input mt-3" /> : null}</div> : null}
        <div className="grid grid-cols-3 gap-2 text-center"><MiniStat label="HTML" value={`${props.files.html.length}`} /><MiniStat label="CSS" value={`${props.files.css.length}`} /><MiniStat label="JS" value={`${props.files.javascript.length}`} /></div>
      </div> : <div className="flex min-h-0 flex-1 flex-col"><div className="border-b border-white/10 p-4"><div className="flex items-center gap-2"><span className={cn("h-2.5 w-2.5 rounded-full", props.endpointReady ? "bg-emerald-400" : "bg-amber-400")} /><p className="text-xs font-black">{props.endpointReady ? "Remote AskAI connected" : "Remote AskAI not configured"}</p></div><p className="mt-2 text-[10px] leading-5 text-white/35">Ask for another edit to this same project. Flux saves a restore point before applying replacement code. It will never fake an AI edit when no endpoint is connected.</p></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{(props.project.assistantHistory || []).map((message) => <div key={message.id} className={cn("rounded-2xl px-3 py-2.5 text-xs leading-5", message.role === "user" ? "ml-8 bg-white text-black" : "mr-8 bg-white/7 text-white/65")}><p>{message.content}</p></div>)}{!props.project.assistantHistory?.length ? <div className="py-12 text-center"><Bot className="mx-auto h-7 w-7 text-white/22" /><p className="mt-3 text-xs font-black text-white/42">No project edits yet</p><p className="mt-1 text-[10px] text-white/28">Try: “Add a pause menu and make the controls better on mobile.”</p></div> : null}</div><div className="border-t border-white/10 p-3"><textarea value={props.assistantInput} onChange={(event) => props.onAssistantInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onAskAI(); } }} placeholder="AskAI to edit this project…" className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-white/30" /><Button onClick={props.onAskAI} disabled={props.assistantBusy || !props.assistantInput.trim() || !props.endpointReady} className="mt-2 h-11 w-full rounded-full bg-white font-black text-black hover:bg-white/90">{props.assistantBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Apply edit</Button></div></div>}
      <div className="border-t border-white/10 p-3"><Button onClick={props.onSave} disabled={!props.project} className="h-11 w-full rounded-xl bg-white font-black text-black hover:bg-white/90"><Save className="h-4 w-4" />Save project</Button></div>
    </aside>
  </>;
}

function AssetsWorkspace({ query, onQuery, kind, onKind, assets, project, onInsertMusic }: { query: string; onQuery: (value: string) => void; kind: "all" | StudioAssetKind; onKind: (value: "all" | StudioAssetKind) => void; assets: StudioMarketplaceAsset[]; project: GeneratedProject | null; onInsertMusic: (asset: StudioMarketplaceAsset) => void }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5"><div className="mx-auto max-w-6xl"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><h2 className="text-2xl font-black">Assets</h2><p className="mt-1 text-xs leading-5 text-white/38">Music has a real stream URL and can be inserted. Model and art packs open their official source; Flux no longer pretends a source link is an imported file.</p></div><div className="relative sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search assets" className="h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-sm outline-none focus:border-white/30" /></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">{STUDIO_ASSET_KINDS.map((item) => <button key={item.id} type="button" onClick={() => onKind(item.id)} className={cn("shrink-0 rounded-full px-4 py-2 text-[10px] font-black", kind === item.id ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white/45")}>{item.label}</button>)}</div>{!project ? <p className="mt-8 text-sm text-white/35">Select a project before inserting assets.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><div className="grid aspect-[16/8] place-items-center bg-black/30"><AssetIcon asset={asset} /></div><div className="p-3"><h3 className="truncate text-sm font-black">{asset.name}</h3><p className="mt-1 truncate text-[10px] text-white/35">{asset.collection}</p><p className="mt-3 text-[9px] text-white/30">{asset.source} · {asset.license}</p><div className="mt-3 flex gap-2">{asset.kind === "music" && asset.previewUrl ? <button type="button" onClick={() => onInsertMusic(asset)} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white text-[10px] font-black text-black"><Music2 className="h-3.5 w-3.5" />Insert music</button> : <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-[10px] font-black hover:bg-white/7"><ExternalLink className="h-3.5 w-3.5" />Open source pack</a>}{asset.kind === "music" && asset.previewUrl ? <a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10" aria-label="Open music source"><ExternalLink className="h-3.5 w-3.5" /></a> : null}</div></div></article>)}</div>}</div></div>;
}

function VersionsWorkspace({ project, onSnapshot, onRestore }: { project: GeneratedProject | null; onSnapshot: () => void; onRestore: (id: string) => void }) {
  if (!project) return <div className="grid flex-1 place-items-center text-sm text-white/35">Select a project.</div>;
  const revisions = [...(project.revisions || [])].reverse();
  return <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="mx-auto max-w-3xl"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="text-2xl font-black">Restore points</h2><p className="mt-1 text-xs text-white/38">AskAI automatically saves one before changing code.</p></div><Button onClick={onSnapshot} className="rounded-full bg-white font-black text-black hover:bg-white/90"><Plus className="h-4 w-4" />Snapshot</Button></div><div className="mt-5 space-y-2">{revisions.map((revision) => <article key={revision.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-4"><History className="h-5 w-5 text-white/35" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{revision.label}</p><p className="mt-1 text-[10px] text-white/30">{new Date(revision.createdAt).toLocaleString()} · {revision.code.length.toLocaleString()} characters</p></div><button type="button" onClick={() => onRestore(revision.id)} className="h-9 rounded-full border border-white/12 px-4 text-[10px] font-black hover:bg-white/7">Restore</button></article>)}{!revisions.length ? <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-white/30">No restore points yet.</div> : null}</div></div></div>;
}

function CodeEditor({ language, value, onChange }: { language: "html" | "css" | "javascript"; value: string; onChange: (value: string) => void }) {
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex min-h-10 items-center border-b border-white/10 bg-[#0b0c10] px-3 text-[10px] font-black uppercase tracking-wider text-white/35"><Code2 className="mr-2 h-4 w-4" />{language === "javascript" ? "script.js" : language === "css" ? "styles.css" : "index.html"}<span className="ml-auto normal-case tracking-normal">Manual editing · autosaved when you press Save</span></div><textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} className="min-h-0 flex-1 resize-none bg-[#07080a] p-4 font-mono text-[12px] leading-6 text-emerald-200 outline-none sm:p-6 sm:text-[13px]" /></div>;
}

function EmptyWorkspace({ onBlank, onStarter }: { onBlank: () => void; onStarter: () => void }) {
  return <div className="max-w-lg text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white text-black"><Gamepad2 className="h-7 w-7" /></span><h2 className="mt-5 text-3xl font-black tracking-tight">Build it yourself</h2><p className="mt-2 text-sm leading-6 text-white/42">Start blank for full manual control or use a starter, then edit separate HTML, CSS and JavaScript files.</p><div className="mt-5 flex justify-center gap-2"><Button onClick={onBlank} variant="outline" className="rounded-full border-white/15 bg-transparent text-white"><Plus className="h-4 w-4" />Blank</Button><Button onClick={onStarter} className="rounded-full bg-white font-black text-black"><WandSparkles className="h-4 w-4" />Starter</Button></div></div>;
}

function WorkspaceTabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-[11px] font-black", active ? "bg-white text-black" : "text-white/42 hover:bg-white/7 hover:text-white")}><Icon className="h-4 w-4" />{label}</button>;
}

function ViewportButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-white text-black" : "text-white/35 hover:text-white")} aria-label={label}><Icon className="h-3.5 w-3.5" /></button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[10px] font-black uppercase tracking-wider text-white/35">{label}<div className="mt-2 normal-case tracking-normal text-white">{children}</div></label>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/5 p-3"><p className="text-base font-black">{value}</p><p className="text-[8px] font-black uppercase tracking-wider text-white/28">{label}</p></div>;
}

function AssetIcon({ asset }: { asset: StudioMarketplaceAsset }) {
  const Icon = asset.kind === "music" || asset.kind === "sfx" ? Music2 : asset.kind === "template" ? FileCode2 : ImagePlus;
  return <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/7"><Icon className="h-6 w-6 text-white/45" /></span>;
}

function splitProjectCode(code: string): ProjectFiles {
  const styleMatches = [...code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  const scriptMatches = [...code.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  const bodyMatch = code.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let html = bodyMatch?.[1] || code;
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, "").trim();
  return {
    html: html || BLANK_GAME_FILES.html,
    css: styleMatches.map((match) => match[1].trim()).filter(Boolean).join("\n\n") || BLANK_GAME_FILES.css,
    javascript: scriptMatches.map((match) => match[1].trim()).filter(Boolean).join("\n\n") || BLANK_GAME_FILES.javascript,
  };
}

function assembleProjectCode(title: string, files: ProjectFiles): string {
  const safeTitle = title.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />\n<title>${safeTitle}</title>\n<style>\n${files.css}\n</style>\n</head>\n<body>\n${files.html}\n<script>\n${files.javascript}\n<\/script>\n</body>\n</html>`;
}

function resolveAskAIEndpoint(): string | null {
  const configured = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT?.trim() || process.env.NEXT_PUBLIC_ASK_AI_ENDPOINT?.trim();
  if (configured) return configured;
  return process.env.NEXT_PUBLIC_BASE_PATH ? null : "/api/ask-ai";
}

function buildStudioEditPrompt(project: GeneratedProject, request: string): string {
  return `You are editing an existing browser ${project.kind}. Apply the requested changes to the current project. Preserve working features unless the user explicitly asks to remove them. Use normal hand-written HTML, CSS and JavaScript; do not mention AI, templates, generated content or placeholder assets in the visible product. Make it responsive and usable on touch devices. Return ONLY one complete HTML document beginning with <!doctype html>. Do not explain the answer.\n\nPROJECT NAME: ${project.title}\nDESCRIPTION: ${project.description}\nUSER EDIT REQUEST: ${request}\n\nCURRENT COMPLETE PROJECT:\n${project.code}`;
}

async function readAIResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json() as { answer?: string; message?: string; text?: string; content?: string };
    return data.answer || data.message || data.text || data.content || "";
  }
  const raw = await response.text();
  if (!contentType.includes("text/event-stream")) return raw;
  return raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => {
    try {
      const data = JSON.parse(line) as { token?: string; text?: string; content?: string };
      return data.token || data.text || data.content || "";
    } catch {
      return line;
    }
  }).join("");
}

function extractCompleteHtml(raw: string): string | null {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw.trim();
  const doctypeIndex = candidate.toLowerCase().indexOf("<!doctype");
  const htmlIndex = candidate.toLowerCase().indexOf("<html");
  const start = doctypeIndex >= 0 ? doctypeIndex : htmlIndex;
  if (start < 0 || !candidate.toLowerCase().includes("</html>")) return null;
  return candidate.slice(start, candidate.toLowerCase().lastIndexOf("</html>") + 7).trim();
}
