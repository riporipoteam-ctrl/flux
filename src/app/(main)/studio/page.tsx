"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Braces,
  Check,
  ChevronDown,
  CirclePlay,
  Clipboard,
  Code2,
  ExternalLink,
  Gamepad2,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Maximize2,
  Monitor,
  Music2,
  PackagePlus,
  Pause,
  Play,
  Plus,
  Rocket,
  Save,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  Square,
  Tablet,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { generateProject } from "@/lib/project-generator";
import {
  deleteLocalProject,
  getLocalProject,
  listLocalProjects,
  publishCommunityGame,
  saveLocalProject,
  type GeneratedProject,
  type GeneratedProjectKind,
} from "@/services/studio-projects";
import {
  STUDIO_ASSET_KINDS,
  STUDIO_MARKETPLACE_ASSETS,
  type StudioAssetKind,
  type StudioMarketplaceAsset,
} from "@/data/studio-marketplace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_PROMPT = "A fast neon arcade game with collectibles, hazards and smooth mobile controls";
type StudioTab = "scene" | "code" | "marketplace";
type ViewportMode = "desktop" | "tablet" | "phone";

export default function StudioPage() {
  const { user, profile } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [projects, setProjects] = useState<GeneratedProject[]>([]);
  const [project, setProject] = useState<GeneratedProject | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [kind, setKind] = useState<GeneratedProjectKind>("game");
  const [tab, setTab] = useState<StudioTab>("scene");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [running, setRunning] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetKind, setAssetKind] = useState<"all" | StudioAssetKind>("all");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const refreshProjects = () => {
    const next = listLocalProjects();
    setProjects(next);
    if (!project && next[0]) setProject(next[0]);
  };

  useEffect(() => {
    const stored = listLocalProjects();
    const requested = new URLSearchParams(window.location.search).get("project");
    setProjects(stored);
    setProject((requested && getLocalProject(requested)) || stored[0] || null);
    const listener = () => refreshProjects();
    window.addEventListener("flux-studio-projects-updated", listener);
    return () => window.removeEventListener("flux-studio-projects-updated", listener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAssets = useMemo(() => {
    const needle = assetQuery.trim().toLowerCase();
    return STUDIO_MARKETPLACE_ASSETS.filter((asset) => {
      const kindMatch = assetKind === "all" || asset.kind === assetKind;
      const textMatch = !needle || [asset.name, asset.collection, asset.source, ...asset.tags].join(" ").toLowerCase().includes(needle);
      return kindMatch && textMatch;
    });
  }, [assetKind, assetQuery]);

  const generate = async () => {
    if (!user || !prompt.trim()) return;
    setGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 420));
    const next = generateProject({ ownerId: user.uid, kind, prompt });
    saveLocalProject(next);
    setProject(next);
    setProjects(listLocalProjects());
    setTab("scene");
    setRunning(true);
    setGenerating(false);
    toast.success(`${kind === "game" ? "Game" : "Website"} generated`);
  };

  const updateProject = (patch: Partial<GeneratedProject>) => {
    if (!project) return;
    const next = { ...project, ...patch, updatedAt: Date.now() };
    setProject(next);
  };

  const save = () => {
    if (!project) return;
    const next = saveLocalProject(project);
    setProject(next);
    setProjects(listLocalProjects());
    toast.success("Project saved on this device");
  };

  const publish = async () => {
    if (!project || project.kind !== "game") return;
    setPublishing(true);
    try {
      const id = await publishCommunityGame(project);
      const next = { ...project, publishedId: id };
      setProject(next);
      setProjects(listLocalProjects());
      toast.success("Published to Flux Games");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish game");
    } finally {
      setPublishing(false);
    }
  };

  const addAsset = (asset: StudioMarketplaceAsset) => {
    if (!project) return;
    if (project.selectedAssetIds.includes(asset.id)) {
      toast.message(`${asset.name} is already in this project`);
      return;
    }
    updateProject({ selectedAssetIds: [...project.selectedAssetIds, asset.id].slice(0, 100) });
    toast.success(`${asset.name} added as a source reference`);
  };

  const removeAsset = (id: string) => {
    if (!project) return;
    updateProject({ selectedAssetIds: project.selectedAssetIds.filter((assetId) => assetId !== id) });
  };

  const selectedAssets = project
    ? project.selectedAssetIds.map((id) => STUDIO_MARKETPLACE_ASSETS.find((asset) => asset.id === id)).filter(Boolean) as StudioMarketplaceAsset[]
    : [];

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 flex-col overflow-hidden bg-[#08090c] text-white lg:h-[100dvh]">
      <header className="flex min-h-[60px] items-center gap-2 border-b border-white/10 bg-[#0d0f14] px-2 sm:px-3">
        <Link href="/games" className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/8" aria-label="Back to games"><X className="h-5 w-5" /></Link>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500 text-white"><WandSparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-black tracking-tight sm:text-base">Flux Studio</h1>
          <p className="truncate text-[10px] text-white/42">Create, code, preview and publish on any device</p>
        </div>
        <button type="button" onClick={() => setLeftOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 lg:hidden" aria-label="Open projects"><Layers3 className="h-5 w-5" /></button>
        <button type="button" onClick={() => setRightOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 xl:hidden" aria-label="Open inspector"><Settings2 className="h-5 w-5" /></button>
        <Button variant="outline" onClick={save} disabled={!project} className="hidden h-10 rounded-xl border-white/12 bg-transparent text-white hover:bg-white/8 sm:inline-flex"><Save className="h-4 w-4" />Save</Button>
        {project?.kind === "game" ? <Button onClick={() => void publish()} disabled={publishing} className="h-10 rounded-xl bg-white px-3 font-black text-black hover:bg-white/90 sm:px-4">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}<span className="hidden sm:inline">Publish</span></Button> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <StudioProjectsPanel
          open={leftOpen}
          onClose={() => setLeftOpen(false)}
          projects={projects}
          activeId={project?.id || null}
          onSelect={(next) => { setProject(next); setLeftOpen(false); setRunning(true); }}
          onDelete={(id) => { deleteLocalProject(id); if (project?.id === id) setProject(null); refreshProjects(); }}
          prompt={prompt}
          setPrompt={setPrompt}
          kind={kind}
          setKind={setKind}
          generating={generating}
          onGenerate={() => void generate()}
        />

        <section className="flex min-w-0 flex-1 flex-col bg-[#0a0b0f]">
          <div className="flex min-h-12 items-center gap-1 border-b border-white/10 bg-[#101217] px-2">
            <TabButton active={tab === "scene"} icon={CirclePlay} label="Scene" onClick={() => setTab("scene")} />
            <TabButton active={tab === "code"} icon={Code2} label="Code" onClick={() => setTab("code")} />
            <TabButton active={tab === "marketplace"} icon={PackagePlus} label="Marketplace" onClick={() => setTab("marketplace")} />
            <div className="ml-auto flex items-center gap-1 rounded-xl bg-black/35 p-1">
              <ViewportButton active={viewport === "desktop"} icon={Monitor} onClick={() => setViewport("desktop")} label="Desktop" />
              <ViewportButton active={viewport === "tablet"} icon={Tablet} onClick={() => setViewport("tablet")} label="Tablet" />
              <ViewportButton active={viewport === "phone"} icon={Smartphone} onClick={() => setViewport("phone")} label="Phone" />
            </div>
          </div>

          {tab === "scene" ? (
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,#202334_0,#08090c_68%)] p-3 sm:p-6">
              {project ? (
                <div className={cn("relative overflow-hidden rounded-2xl border border-white/12 bg-black shadow-[0_30px_100px_rgba(0,0,0,.5)] transition-[width,height] duration-300", viewport === "desktop" && "h-full max-h-[900px] w-full", viewport === "tablet" && "h-[min(82vh,900px)] w-[min(76vw,768px)]", viewport === "phone" && "h-[min(82vh,860px)] w-[min(88vw,390px)]")}>
                  {running ? <iframe ref={iframeRef} title={`${project.title} preview`} srcDoc={project.code} sandbox="allow-scripts allow-pointer-lock" className="h-full w-full border-0" /> : <div className="grid h-full place-items-center bg-[#11131a]"><div className="text-center"><Pause className="mx-auto h-9 w-9 text-white/35" /><p className="mt-3 text-sm font-bold text-white/55">Preview paused</p></div></div>}
                  <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/12 bg-black/72 p-1.5 shadow-xl backdrop-blur-xl">
                    <button type="button" onClick={() => setRunning((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full bg-white text-black" aria-label={running ? "Pause preview" : "Run preview"}>{running ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}</button>
                    <button type="button" onClick={() => { setRunning(false); window.setTimeout(() => setRunning(true), 20); }} className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/10" aria-label="Restart preview"><Square className="h-4 w-4" /></button>
                    <button type="button" onClick={() => iframeRef.current?.requestFullscreen?.()} className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/10" aria-label="Fullscreen"><Maximize2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ) : <EmptyStudio prompt={prompt} setPrompt={setPrompt} kind={kind} setKind={setKind} generating={generating} onGenerate={() => void generate()} />}
            </div>
          ) : null}

          {tab === "code" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-11 items-center border-b border-white/10 bg-[#0d0f14] px-3 text-[11px] font-bold text-white/45"><Braces className="mr-2 h-4 w-4 text-violet-400" />index.html<span className="ml-auto">HTML · CSS · JavaScript</span></div>
              {project ? <textarea value={project.code} onChange={(event) => updateProject({ code: event.target.value })} spellCheck={false} className="min-h-0 flex-1 resize-none bg-[#08090c] p-4 font-mono text-[12px] leading-6 text-emerald-200 outline-none sm:p-6 sm:text-[13px]" /> : <div className="grid flex-1 place-items-center text-sm text-white/40">Generate a project to edit its code.</div>}
            </div>
          ) : null}

          {tab === "marketplace" ? (
            <MarketplacePanel query={assetQuery} setQuery={setAssetQuery} kind={assetKind} setKind={setAssetKind} assets={filteredAssets} selectedIds={project?.selectedAssetIds || []} onAdd={addAsset} />
          ) : null}
        </section>

        <InspectorPanel open={rightOpen} onClose={() => setRightOpen(false)} project={project} selectedAssets={selectedAssets} onChange={updateProject} onRemoveAsset={removeAsset} onSave={save} profilePlan={profile?.planTier || "free"} />
      </div>
    </main>
  );
}

function StudioProjectsPanel(props: {
  open: boolean;
  onClose: () => void;
  projects: GeneratedProject[];
  activeId: string | null;
  onSelect: (project: GeneratedProject) => void;
  onDelete: (id: string) => void;
  prompt: string;
  setPrompt: (value: string) => void;
  kind: GeneratedProjectKind;
  setKind: (value: GeneratedProjectKind) => void;
  generating: boolean;
  onGenerate: () => void;
}) {
  return <>
    {props.open ? <button type="button" className="fixed inset-0 z-50 bg-black/55 lg:hidden" onClick={props.onClose} aria-label="Close projects" /> : null}
    <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[310px] flex-col border-r border-white/10 bg-[#0d0f14] transition-transform lg:static lg:z-auto lg:w-[280px] lg:translate-x-0", props.open ? "translate-x-0" : "-translate-x-full")}>
      <div className="border-b border-white/10 p-3">
        <div className="flex items-center justify-between"><h2 className="text-xs font-black uppercase tracking-[.14em] text-white/40">Create with AskAI</h2><button type="button" onClick={props.onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8 lg:hidden"><X className="h-4 w-4" /></button></div>
        <textarea value={props.prompt} onChange={(event) => props.setPrompt(event.target.value)} placeholder="Describe a game or website" className="mt-3 min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-3 text-sm leading-5 outline-none focus:border-violet-400" />
        <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => props.setKind("game")} className={cn("rounded-xl px-3 py-2 text-xs font-black", props.kind === "game" ? "bg-violet-500" : "bg-white/7 text-white/55")}><Gamepad2 className="mr-1.5 inline h-4 w-4" />Game</button><button type="button" onClick={() => props.setKind("website")} className={cn("rounded-xl px-3 py-2 text-xs font-black", props.kind === "website" ? "bg-violet-500" : "bg-white/7 text-white/55")}><Monitor className="mr-1.5 inline h-4 w-4" />Website</button></div>
        <Button onClick={props.onGenerate} disabled={props.generating || !props.prompt.trim()} className="mt-2 h-11 w-full rounded-xl bg-white font-black text-black hover:bg-white/90">{props.generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{props.generating ? "Building…" : "Generate project"}</Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-2 py-2 text-[10px] font-black uppercase tracking-[.14em] text-white/30">Your projects</p>
        {props.projects.map((item) => <div key={item.id} className={cn("group flex items-center gap-2 rounded-xl p-2", props.activeId === item.id ? "bg-white/10" : "hover:bg-white/6")}><button type="button" onClick={() => props.onSelect(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: item.thumbnail }}>{item.kind === "game" ? <Gamepad2 className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{item.title}</span><span className="block truncate text-[10px] text-white/35">{item.publishedId ? "Published" : "Draft"} · {new Date(item.updatedAt).toLocaleDateString()}</span></span></button><button type="button" onClick={() => props.onDelete(item.id)} className="grid h-9 w-9 place-items-center rounded-lg text-white/35 opacity-0 hover:bg-red-500/15 hover:text-red-300 group-hover:opacity-100" aria-label={`Delete ${item.title}`}><Trash2 className="h-4 w-4" /></button></div>)}
        {!props.projects.length ? <p className="px-4 py-10 text-center text-xs leading-5 text-white/30">Your generated games and websites will appear here.</p> : null}
      </div>
    </aside>
  </>;
}

function InspectorPanel({ open, onClose, project, selectedAssets, onChange, onRemoveAsset, onSave, profilePlan }: { open: boolean; onClose: () => void; project: GeneratedProject | null; selectedAssets: StudioMarketplaceAsset[]; onChange: (patch: Partial<GeneratedProject>) => void; onRemoveAsset: (id: string) => void; onSave: () => void; profilePlan: string }) {
  return <>
    {open ? <button type="button" className="fixed inset-0 z-50 bg-black/55 xl:hidden" onClick={onClose} aria-label="Close inspector" /> : null}
    <aside className={cn("fixed inset-y-0 right-0 z-[60] flex w-[min(92vw,360px)] flex-col border-l border-white/10 bg-[#0d0f14] transition-transform xl:static xl:z-auto xl:w-[330px] xl:translate-x-0", open ? "translate-x-0" : "translate-x-full")}>
      <div className="flex min-h-14 items-center gap-2 border-b border-white/10 px-4"><Settings2 className="h-4 w-4 text-violet-400" /><h2 className="font-black">Inspector</h2><span className="ml-auto rounded-full bg-white/7 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white/45">{profilePlan}</span><button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8 xl:hidden"><X className="h-4 w-4" /></button></div>
      {!project ? <div className="grid flex-1 place-items-center p-8 text-center text-sm text-white/35">Select or generate a project.</div> : <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <InspectorField label="Title"><input value={project.title} onChange={(event) => onChange({ title: event.target.value.slice(0, 80) })} className="studio-input" /></InspectorField>
        <InspectorField label="Description"><textarea value={project.description} onChange={(event) => onChange({ description: event.target.value.slice(0, 600) })} className="studio-input min-h-24 resize-none py-3" /></InspectorField>
        <InspectorField label="Hashtags"><input value={project.hashtags.join(", ")} onChange={(event) => onChange({ hashtags: event.target.value.split(/[,\s]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).slice(0, 12) })} className="studio-input" placeholder="arcade, multiplayer" /></InspectorField>
        {project.kind === "game" ? <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><label className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300"><Users className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold">Multiplayer metadata</span><span className="block text-[10px] leading-4 text-white/38">Marks the game for room/session integration</span></span><input type="checkbox" checked={project.multiplayer} onChange={(event) => onChange({ multiplayer: event.target.checked, maxPlayers: event.target.checked ? Math.max(2, project.maxPlayers) : 1 })} className="h-5 w-5 accent-violet-500" /></label>{project.multiplayer ? <label className="mt-3 block text-[10px] font-black uppercase tracking-wider text-white/35">Max players<input type="number" min={2} max={50} value={project.maxPlayers} onChange={(event) => onChange({ maxPlayers: Math.max(2, Math.min(50, Number(event.target.value) || 2)) })} className="studio-input mt-2" /></label> : null}</div> : null}
        <div><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-[.13em] text-white/38">Assets</h3><span className="text-[10px] text-white/30">{selectedAssets.length}/100</span></div><div className="mt-2 space-y-2">{selectedAssets.map((asset) => <div key={asset.id} className="flex items-center gap-2 rounded-xl bg-white/6 p-2"><AssetKindIcon kind={asset.kind} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{asset.name}</p><p className="truncate text-[9px] text-white/32">{asset.source} · {asset.license}</p></div><button type="button" onClick={() => onRemoveAsset(asset.id)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/8"><X className="h-3.5 w-3.5" /></button></div>)}{!selectedAssets.length ? <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/30">Add open-source assets from Marketplace.</p> : null}</div></div>
      </div>}
      <div className="border-t border-white/10 p-3"><Button onClick={onSave} disabled={!project} className="h-11 w-full rounded-xl bg-white font-black text-black hover:bg-white/90"><Save className="h-4 w-4" />Save changes</Button></div>
    </aside>
  </>;
}

function MarketplacePanel({ query, setQuery, kind, setKind, assets, selectedIds, onAdd }: { query: string; setQuery: (value: string) => void; kind: "all" | StudioAssetKind; setKind: (value: "all" | StudioAssetKind) => void; assets: StudioMarketplaceAsset[]; selectedIds: string[]; onAdd: (asset: StudioMarketplaceAsset) => void }) {
  return <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5"><div className="mx-auto max-w-6xl"><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><h2 className="text-2xl font-black tracking-tight">Asset Marketplace</h2><p className="mt-1 text-xs text-white/42">120 source-backed models, sprites, textures, animations, templates and audio references.</p></div><div className="relative sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets" className="h-11 w-full rounded-xl border border-white/10 bg-white/6 pl-10 pr-3 text-sm outline-none focus:border-violet-400" /></div></div><div className="mt-4 flex gap-2 overflow-x-auto pb-2">{STUDIO_ASSET_KINDS.map((item) => <button key={item.id} type="button" onClick={() => setKind(item.id)} className={cn("shrink-0 rounded-full px-4 py-2 text-[10px] font-black", kind === item.id ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white/50")}>{item.label}</button>)}</div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.045]"><div className="grid aspect-[16/9] place-items-center bg-[radial-gradient(circle_at_center,rgba(124,92,255,.26),transparent_65%)]"><AssetKindIcon kind={asset.kind} large /></div><div className="p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black">{asset.name}</h3><p className="mt-1 truncate text-[10px] text-white/38">{asset.collection}</p></div><span className="rounded-full bg-white/7 px-2 py-1 text-[8px] font-black uppercase text-white/45">{asset.kind}</span></div><p className="mt-3 text-[9px] leading-4 text-white/34">{asset.source} · {asset.license}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => onAdd(asset)} className={cn("flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-[10px] font-black", selectedIds.includes(asset.id) ? "bg-emerald-500/15 text-emerald-300" : "bg-white text-black")} disabled={selectedIds.includes(asset.id)}>{selectedIds.includes(asset.id) ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{selectedIds.includes(asset.id) ? "Added" : "Add"}</button><a href={asset.sourceUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 hover:bg-white/8" aria-label={`Open ${asset.source} source`}><ExternalLink className="h-3.5 w-3.5" /></a></div></div></article>)}</div></div></div>;
}

function EmptyStudio({ prompt, setPrompt, kind, setKind, generating, onGenerate }: { prompt: string; setPrompt: (value: string) => void; kind: GeneratedProjectKind; setKind: (value: GeneratedProjectKind) => void; generating: boolean; onGenerate: () => void }) {
  return <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-black/45 p-5 text-center shadow-2xl backdrop-blur-xl sm:p-8"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-500"><Sparkles className="h-7 w-7" /></span><h2 className="mt-5 text-3xl font-black tracking-[-.05em]">Build something playable</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">Describe your idea. Flux instantly creates an editable game or website with a live preview and code.</p><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-5 min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/6 p-4 text-left text-sm leading-6 outline-none focus:border-violet-400" /><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setKind("game")} className={cn("rounded-xl py-3 text-sm font-black", kind === "game" ? "bg-violet-500" : "bg-white/7 text-white/55")}>Game</button><button type="button" onClick={() => setKind("website")} className={cn("rounded-xl py-3 text-sm font-black", kind === "website" ? "bg-violet-500" : "bg-white/7 text-white/55")}>Website</button></div><Button onClick={onGenerate} disabled={generating || !prompt.trim()} className="mt-3 h-12 w-full rounded-xl bg-white text-base font-black text-black hover:bg-white/90">{generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}{generating ? "Creating project…" : "Generate now"}</Button></div>;
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Play; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-[11px] font-black", active ? "bg-white text-black" : "text-white/45 hover:bg-white/7 hover:text-white")}><Icon className="h-4 w-4" />{label}</button>; }
function ViewportButton({ active, icon: Icon, onClick, label }: { active: boolean; icon: typeof Monitor; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-white text-black" : "text-white/40 hover:text-white")} aria-label={label}><Icon className="h-3.5 w-3.5" /></button>; }
function InspectorField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-[10px] font-black uppercase tracking-[.12em] text-white/38">{label}<div className="mt-2 normal-case tracking-normal text-white">{children}</div></label>; }
function AssetKindIcon({ kind, large = false }: { kind: StudioAssetKind; large?: boolean }) { const Icon = kind === "3d" ? Box : kind === "2d" || kind === "texture" ? ImageIcon : kind === "animation" ? CirclePlay : kind === "sfx" || kind === "music" ? Music2 : Braces; return <span className={cn("grid shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300", large ? "h-16 w-16" : "h-9 w-9")}><Icon className={large ? "h-7 w-7" : "h-4 w-4"} /></span>; }
