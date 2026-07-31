"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Camera,
  Check,
  Circle,
  Copy,
  Eye,
  EyeOff,
  Grid3X3,
  ImagePlus,
  Layers3,
  Loader2,
  Lock,
  Maximize2,
  Minus,
  Music2,
  Palette,
  Plus,
  RectangleHorizontal,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Shapes,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  createStory,
  type StoryAlign,
  type StoryFont,
  type StoryShape,
  type StorySticker,
} from "@/services/stories";
import { getStoryMusicTrack } from "@/lib/story-music";
import { FluxMusicLibrary } from "@/components/music/flux-music-library";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DESIGNS = [
  { id: "black", label: "Black", className: "bg-black" },
  { id: "paper", label: "Paper", className: "bg-[#ecebe7]" },
  { id: "ocean", label: "Ocean", className: "bg-gradient-to-br from-[#0e7490] via-[#1d4ed8] to-[#172554]" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-br from-[#f59e0b] via-[#e11d48] to-[#581c87]" },
  { id: "night", label: "Night", className: "bg-[radial-gradient(circle_at_70%_12%,#4338ca_0,transparent_24%),linear-gradient(155deg,#020617,#1e1b4b_55%,#000)]" },
  { id: "mint", label: "Mint", className: "bg-gradient-to-br from-[#a7f3d0] via-[#0f766e] to-[#164e63]" },
  { id: "gold", label: "Gold", className: "bg-gradient-to-br from-[#fef3c7] via-[#f97316] to-[#7f1d1d]" },
  { id: "mono", label: "Mono", className: "bg-gradient-to-br from-[#f4f4f5] via-[#71717a] to-[#18181b]" },
];

const EMOJIS = ["✨", "🔥", "❤️", "😂", "🎮", "⚽", "🎉", "🌙", "💯", "🚀", "👀", "⭐", "🏆", "🎧", "🪩", "⚡", "🫶", "💎", "👑", "🌈", "🛸", "🎬", "📸", "🧠"];
const COLORS = ["#ffffff", "#111111", "#ffe066", "#ff6b9d", "#60a5fa", "#34d399", "#a78bfa", "#fb923c", "#ef4444", "#14b8a6"];
const BACKGROUNDS = ["transparent", "#000000cc", "#ffffffee", "#facc15ee", "#ec4899dd", "#2563ebdd"];
const DRAFT_KEY = "flux-story-studio-v3-draft";

type Tool = "select" | "media" | "text" | "stickers" | "shapes" | "design" | "music" | "layers";
type GestureMode = "move" | "scale" | "rotate";

interface GestureState {
  pointerId: number;
  mode: GestureMode;
  layerId: string;
  before: StorySticker[];
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startScale: number;
  startRotation: number;
  centerX: number;
  centerY: number;
  startDistance: number;
  startAngle: number;
}

interface DraftState {
  designId: string;
  musicId: string | null;
  layers: StorySticker[];
  savedAt: number;
}

export default function StoryStudioV3() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const pastRef = useRef<StorySticker[][]>([]);
  const futureRef = useRef<StorySticker[][]>([]);

  const [tool, setTool] = useState<Tool>("select");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [designId, setDesignId] = useState("black");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [layers, setLayers] = useState<StorySticker[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [labelText, setLabelText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [snapGuides, setSnapGuides] = useState({ x: false, y: false });
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [historyTick, setHistoryTick] = useState(0);

  const selected = layers.find((item) => item.id === selectedId) || null;
  const selectedMusic = getStoryMusicTrack(musicId);
  const selectedDesign = DESIGNS.find((item) => item.id === designId) || DESIGNS[0];
  const canPublish = Boolean(file || layers.some((item) => !item.hidden));

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as DraftState | null;
      if (draft?.layers?.length) {
        setLayers(draft.layers);
        setDesignId(draft.designId || "black");
        setMusicId(draft.musicId || null);
        setDraftSavedAt(draft.savedAt || null);
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const draft: DraftState = { designId, musicId, layers, savedAt: Date.now() };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setDraftSavedAt(draft.savedAt);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [designId, layers, musicId]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const pushHistory = (before: StorySticker[]) => {
    pastRef.current = [...pastRef.current.slice(-39), cloneLayers(before)];
    futureRef.current = [];
    setHistoryTick((value) => value + 1);
  };

  const commitLayers = (next: StorySticker[] | ((current: StorySticker[]) => StorySticker[])) => {
    setLayers((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (JSON.stringify(resolved) === JSON.stringify(current)) return current;
      pushHistory(current);
      return resolved;
    });
  };

  const undo = () => {
    const previous = pastRef.current.at(-1);
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [cloneLayers(layers), ...futureRef.current.slice(0, 39)];
    setLayers(cloneLayers(previous));
    setHistoryTick((value) => value + 1);
  };

  const redo = () => {
    const next = futureRef.current[0];
    if (!next) return;
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-39), cloneLayers(layers)];
    setLayers(cloneLayers(next));
    setHistoryTick((value) => value + 1);
  };

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("image/") && !next.type.startsWith("video/")) return toast.error("Choose an image or video.");
    if (next.size > 40 * 1024 * 1024) return toast.error("Stories must be under 40 MB.");
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(next);
    setTool("select");
  };

  const removeMedia = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFile(null);
  };

  const addLayer = (layer: StorySticker) => {
    commitLayers((items) => [...items, layer].slice(-40));
    setSelectedId(layer.id);
    setTool("select");
  };

  const addText = () => addLayer({
    id: makeId("text"), kind: "text", value: "Tap to edit", x: 50, y: 50, scale: 1, rotation: 0,
    width: 72, opacity: 1, color: "#ffffff", background: "transparent", fontSize: 34,
    fontFamily: "display", fontWeight: 800, align: "center", locked: false, hidden: false,
  });

  const addEmoji = (value: string) => addLayer({
    id: makeId("emoji"), kind: "emoji", value, x: 50, y: 52, scale: 1, rotation: 0,
    width: 24, opacity: 1, color: "#ffffff", background: "transparent", fontSize: 54,
    fontFamily: "sans", fontWeight: 700, align: "center", locked: false, hidden: false,
  });

  const addLabel = () => {
    if (!labelText.trim()) return;
    addLayer({
      id: makeId("label"), kind: "label", value: labelText.trim().slice(0, 40), x: 50, y: 55,
      scale: 1, rotation: 0, width: 48, opacity: 1, color: "#111111", background: "#ffffffee",
      fontSize: 18, fontFamily: "sans", fontWeight: 800, align: "center", locked: false, hidden: false,
    });
    setLabelText("");
  };

  const addShape = (shape: StoryShape) => addLayer({
    id: makeId("shape"), kind: "shape", value: "", x: 50, y: 50, scale: 1, rotation: 0,
    width: shape === "line" ? 72 : 42, opacity: .85, color: "#ffffff", background: "#ffffff",
    fontSize: 18, fontFamily: "sans", fontWeight: 700, align: "center", shape, locked: false, hidden: false,
  });

  const updateLayer = (id: string, patch: Partial<StorySticker>, track = true) => {
    const updater = (items: StorySticker[]) => items.map((item) => item.id === id ? { ...item, ...patch } : item);
    if (track) commitLayers(updater);
    else setLayers(updater);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    commitLayers((items) => items.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const duplicate = { ...selected, id: makeId(selected.kind), x: Math.min(94, selected.x + 5), y: Math.min(94, selected.y + 5), locked: false };
    addLayer(duplicate);
  };

  const reorder = (direction: "up" | "down") => {
    if (!selectedId) return;
    commitLayers((items) => {
      const index = items.findIndex((item) => item.id === selectedId);
      const target = direction === "up" ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const beginGesture = (event: React.PointerEvent<HTMLElement>, layer: StorySticker, mode: GestureMode) => {
    if (layer.locked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(layer.id);
    const bounds = canvas.getBoundingClientRect();
    const centerX = bounds.left + layer.x / 100 * bounds.width;
    const centerY = bounds.top + layer.y / 100 * bounds.height;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    gestureRef.current = {
      pointerId: event.pointerId, mode, layerId: layer.id, before: cloneLayers(layers),
      startClientX: event.clientX, startClientY: event.clientY, startX: layer.x, startY: layer.y,
      startScale: layer.scale, startRotation: layer.rotation, centerX, centerY,
      startDistance: Math.max(1, Math.hypot(dx, dy)), startAngle: Math.atan2(dy, dx) * 180 / Math.PI,
    };
  };

  const moveGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !canvas) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    if (gesture.mode === "move") {
      let x = clamp(gesture.startX + (event.clientX - gesture.startClientX) / bounds.width * 100, 2, 98);
      let y = clamp(gesture.startY + (event.clientY - gesture.startClientY) / bounds.height * 100, 2, 98);
      const snapX = Math.abs(x - 50) < 2.2;
      const snapY = Math.abs(y - 50) < 2.2;
      if (snapX) x = 50;
      if (snapY) y = 50;
      setSnapGuides({ x: snapX, y: snapY });
      updateLayer(gesture.layerId, { x, y }, false);
      return;
    }
    const dx = event.clientX - gesture.centerX;
    const dy = event.clientY - gesture.centerY;
    if (gesture.mode === "scale") {
      const distance = Math.max(1, Math.hypot(dx, dy));
      updateLayer(gesture.layerId, { scale: clamp(gesture.startScale * distance / gesture.startDistance, .15, 5) }, false);
      return;
    }
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    updateLayer(gesture.layerId, { rotation: normalizeRotation(gesture.startRotation + angle - gesture.startAngle) }, false);
  };

  const endGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (JSON.stringify(gesture.before) !== JSON.stringify(layers)) pushHistory(gesture.before);
    gestureRef.current = null;
    setSnapGuides({ x: false, y: false });
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const reset = () => {
    pushHistory(layers);
    removeMedia();
    setLayers([]);
    setSelectedId(null);
    setDesignId("black");
    setMusicId(null);
    localStorage.removeItem(DRAFT_KEY);
  };

  const publish = async () => {
    if (!user || publishing || !canPublish) return;
    setPublishing(true);
    try {
      await createStory({ authorId: user.uid, file, designId, musicId, stickers: layers, text: "" });
      localStorage.removeItem(DRAFT_KEY);
      window.dispatchEvent(new Event("flux-stories-updated"));
      toast.success("Story published");
      router.push("/stories");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Story failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0b0b0c] pb-24 text-white lg:h-screen lg:overflow-hidden lg:pb-0">
      <header className="sticky top-0 z-50 flex min-h-14 items-center gap-2 border-b border-white/10 bg-[#0b0b0c]/96 px-2 backdrop-blur-xl sm:px-4">
        <button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-white/8" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1"><h1 className="truncate text-sm font-black">Story editor</h1><p className="truncate text-[10px] text-white/35">{draftSavedAt ? `Saved ${new Date(draftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "New Story"}</p></div>
        <button type="button" onClick={undo} disabled={!pastRef.current.length} className="story-editor-icon" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
        <button type="button" onClick={redo} disabled={!futureRef.current.length} className="story-editor-icon" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => setShowSafeArea((value) => !value)} className={cn("story-editor-icon hidden sm:grid", showSafeArea && "bg-white text-black")} aria-label="Toggle safe area"><Grid3X3 className="h-4 w-4" /></button>
        <Button onClick={() => void publish()} disabled={!canPublish || publishing} className="h-10 rounded-xl bg-white px-4 font-black text-black hover:bg-white/90">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Share</Button>
      </header>

      <div className="lg:grid lg:h-[calc(100vh-56px)] lg:grid-cols-[72px_minmax(0,1fr)_350px]">
        <nav className="hidden border-r border-white/10 bg-[#101011] p-2 lg:flex lg:flex-col lg:gap-1">
          <ToolButton active={tool === "select"} icon={Sparkles} label="Select" onClick={() => setTool("select")} />
          <ToolButton active={tool === "media"} icon={ImagePlus} label="Media" onClick={() => setTool("media")} />
          <ToolButton active={tool === "text"} icon={Type} label="Text" onClick={() => setTool("text")} />
          <ToolButton active={tool === "stickers"} icon={Sticker} label="Sticker" onClick={() => setTool("stickers")} />
          <ToolButton active={tool === "shapes"} icon={Shapes} label="Shape" onClick={() => setTool("shapes")} />
          <ToolButton active={tool === "design"} icon={Palette} label="Design" onClick={() => setTool("design")} />
          <ToolButton active={tool === "music"} icon={Music2} label="Music" onClick={() => setTool("music")} />
          <ToolButton active={tool === "layers"} icon={Layers3} label="Layers" onClick={() => setTool("layers")} />
        </nav>

        <section className="relative flex min-h-[65dvh] items-center justify-center overflow-hidden bg-[#151516] p-3 sm:p-6 lg:min-h-0">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div
            ref={canvasRef}
            onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}
            className={cn("relative z-10 aspect-[9/16] h-[min(69dvh,760px)] max-h-full touch-none overflow-hidden bg-black shadow-[0_30px_100px_rgba(0,0,0,.65)] sm:rounded-[22px] lg:h-[min(82vh,820px)]", selectedDesign.className)}
          >
            {previewUrl ? file?.type.startsWith("video/") ? <video src={previewUrl} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : <img src={previewUrl} alt="Story background" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/20" />

            {!previewUrl && !layers.length ? <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center"><span className="grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-black/20"><Plus className="h-7 w-7" /></span><p className="mt-4 text-xl font-black">Add media or text</p><p className="mt-2 text-xs text-white/45">Every item becomes a movable layer.</p></button> : null}

            {showSafeArea ? <div className="pointer-events-none absolute inset-x-[7%] bottom-[10%] top-[12%] z-40 border border-dashed border-white/25" /> : null}
            {snapGuides.x ? <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-50 w-px bg-cyan-300" /> : null}
            {snapGuides.y ? <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-50 h-px bg-cyan-300" /> : null}

            {layers.map((layer, index) => {
              if (layer.hidden) return null;
              const isSelected = layer.id === selectedId;
              return <div key={layer.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${layer.x}%`, top: `${layer.y}%`, zIndex: 20 + index, opacity: layer.opacity ?? 1, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})` }}>
                <button type="button" onDoubleClick={() => layer.kind === "text" && setTool("text")} onPointerDown={(event) => beginGesture(event, layer, "move")} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className={cn("relative block cursor-grab select-none touch-none active:cursor-grabbing", isSelected && "outline outline-2 outline-white outline-offset-4", layer.locked && "cursor-not-allowed")} style={{ width: layer.kind === "emoji" ? "auto" : `${layer.width ?? 50}cqw` }} aria-label={`Move ${layer.kind} layer`}>
                  <LayerContent layer={layer} />
                </button>
                {isSelected && !layer.locked ? <>
                  <button type="button" onPointerDown={(event) => beginGesture(event, layer, "rotate")} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className="absolute -right-7 -top-7 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-xl" aria-label="Rotate"><RotateCw className="h-3.5 w-3.5" /></button>
                  <button type="button" onPointerDown={(event) => beginGesture(event, layer, "scale")} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className="absolute -bottom-7 -right-7 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-xl" aria-label="Resize"><Maximize2 className="h-3.5 w-3.5" /></button>
                </> : null}
              </div>;
            })}

            {selectedMusic ? <div className="absolute bottom-4 left-4 z-50 flex max-w-[74%] items-center gap-2 rounded-full bg-black/65 px-3 py-2 text-[10px] font-bold backdrop-blur-xl"><Music2 className="h-3.5 w-3.5" /><span className="truncate">{selectedMusic.title}</span></div> : null}
            {previewUrl ? <button type="button" onClick={removeMedia} className="absolute right-3 top-3 z-50 grid h-9 w-9 place-items-center rounded-full bg-black/55 backdrop-blur-xl" aria-label="Remove media"><Trash2 className="h-4 w-4" /></button> : null}
          </div>
        </section>

        <aside className="border-l border-white/10 bg-[#101011] lg:min-h-0 lg:overflow-y-auto">
          <div className="border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2"><span className="text-xs font-black capitalize">{selected ? selected.kind : tool}</span>{selected ? <span className="ml-auto text-[9px] text-white/30">{Math.round(selected.x)} × {Math.round(selected.y)}</span> : null}</div></div>
          <div className="p-4"><Inspector tool={tool} selected={selected} layers={layers} designId={designId} musicId={musicId} labelText={labelText} onTool={setTool} onPickMedia={() => fileInputRef.current?.click()} onOpenCamera={() => cameraInputRef.current?.click()} onAddText={addText} onAddEmoji={addEmoji} onAddLabel={addLabel} onLabelText={setLabelText} onAddShape={addShape} onDesign={setDesignId} onMusic={setMusicId} onSelect={setSelectedId} onUpdate={updateLayer} onDelete={deleteSelected} onDuplicate={duplicateSelected} onReorder={reorder} /></div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-white/10 bg-[#0b0b0c]/96 px-2 pb-[max(.45rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        <MobileTool active={tool === "media"} icon={ImagePlus} label="Media" onClick={() => setTool("media")} />
        <MobileTool active={tool === "text"} icon={Type} label="Text" onClick={() => setTool("text")} />
        <MobileTool active={tool === "stickers"} icon={Sticker} label="Sticker" onClick={() => setTool("stickers")} />
        <MobileTool active={tool === "shapes"} icon={Shapes} label="Shape" onClick={() => setTool("shapes")} />
        <MobileTool active={tool === "layers"} icon={Layers3} label="Layers" onClick={() => setTool("layers")} />
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
      <span className="hidden">{historyTick}</span>
    </main>
  );
}

function Inspector(props: {
  tool: Tool;
  selected: StorySticker | null;
  layers: StorySticker[];
  designId: string;
  musicId: string | null;
  labelText: string;
  onTool: (tool: Tool) => void;
  onPickMedia: () => void;
  onOpenCamera: () => void;
  onAddText: () => void;
  onAddEmoji: (emoji: string) => void;
  onAddLabel: () => void;
  onLabelText: (value: string) => void;
  onAddShape: (shape: StoryShape) => void;
  onDesign: (id: string) => void;
  onMusic: (id: string | null) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<StorySticker>, track?: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReorder: (direction: "up" | "down") => void;
}) {
  if (props.selected && props.tool === "select") return <LayerInspector {...props} selected={props.selected} />;
  if (props.tool === "media") return <Panel title="Media" text="Use a photo or video as the Story background."><div className="grid grid-cols-2 gap-2"><ActionButton icon={ImagePlus} label="Library" onClick={props.onPickMedia} /><ActionButton icon={Camera} label="Camera" onClick={props.onOpenCamera} /></div></Panel>;
  if (props.tool === "text") return <Panel title="Text" text="Text is a normal layer. Add as many as you need, then drag, resize and rotate each one."><Button onClick={props.onAddText} className="h-11 w-full rounded-xl bg-white font-black text-black hover:bg-white/90"><Plus className="h-4 w-4" />Add text layer</Button>{props.selected?.kind === "text" ? <div className="mt-4"><button type="button" onClick={() => props.onTool("select")} className="w-full rounded-xl border border-white/10 py-2 text-xs font-bold">Edit selected text properties</button></div> : null}</Panel>;
  if (props.tool === "stickers") return <Panel title="Stickers" text="Emoji and labels are independent layers."><div className="grid grid-cols-6 gap-2">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => props.onAddEmoji(emoji)} className="grid aspect-square place-items-center rounded-xl bg-white/6 text-xl hover:bg-white/10">{emoji}</button>)}</div><div className="mt-4 flex gap-2"><input value={props.labelText} onChange={(event) => props.onLabelText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") props.onAddLabel(); }} placeholder="Custom label" className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm outline-none" /><Button onClick={props.onAddLabel} disabled={!props.labelText.trim()} className="h-11 rounded-xl">Add</Button></div></Panel>;
  if (props.tool === "shapes") return <Panel title="Shapes" text="Use shapes for highlights, frames and graphic layout."><div className="grid grid-cols-2 gap-2"><ActionButton icon={RectangleHorizontal} label="Rectangle" onClick={() => props.onAddShape("rectangle")} /><ActionButton icon={Circle} label="Circle" onClick={() => props.onAddShape("circle")} /><ActionButton icon={Minus} label="Line" onClick={() => props.onAddShape("line")} /><ActionButton icon={Shapes} label="Pill" onClick={() => props.onAddShape("pill")} /></div></Panel>;
  if (props.tool === "design") return <Panel title="Background" text="Simple backgrounds keep the Story readable."><div className="grid grid-cols-2 gap-2">{DESIGNS.map((design) => <button key={design.id} type="button" onClick={() => props.onDesign(design.id)} className={cn("rounded-xl border p-2 text-left", props.designId === design.id ? "border-white" : "border-white/8")}><span className={cn("block aspect-video rounded-lg", design.className)} /><span className="mt-2 block text-xs font-bold">{design.label}</span></button>)}</div></Panel>;
  if (props.tool === "music") return <FluxMusicLibrary selectedId={props.musicId} allowNone onSelect={(track) => props.onMusic(track?.id || null)} title="Music" description="Select a real track for Story playback." />;
  if (props.tool === "layers") return <Panel title="Layers" text="Top items appear in front."><div className="space-y-1">{[...props.layers].reverse().map((layer) => <button key={layer.id} type="button" onClick={() => { props.onSelect(layer.id); props.onTool("select"); }} className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-white/6"><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/6 text-sm">{layerIcon(layer)}</span><span className="min-w-0 flex-1 truncate text-xs font-bold">{layer.value || layer.shape || layer.kind}</span>{layer.hidden ? <EyeOff className="h-3.5 w-3.5 text-white/25" /> : null}{layer.locked ? <Lock className="h-3.5 w-3.5 text-white/25" /> : null}</button>)}</div></Panel>;
  return <Panel title="Select a layer" text="Tap any item on the canvas or add text, stickers and shapes from the toolbar."><div className="grid grid-cols-2 gap-2"><ActionButton icon={Type} label="Text" onClick={props.onAddText} /><ActionButton icon={ImagePlus} label="Media" onClick={props.onPickMedia} /></div></Panel>;
}

function LayerInspector(props: Parameters<typeof Inspector>[0] & { selected: StorySticker }) {
  const layer = props.selected;
  return <div className="space-y-5">
    <div className="flex items-center gap-2"><button type="button" onClick={props.onDuplicate} className="inspector-action"><Copy className="h-4 w-4" />Duplicate</button><button type="button" onClick={() => props.onUpdate(layer.id, { locked: !layer.locked })} className="inspector-action">{layer.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}{layer.locked ? "Unlock" : "Lock"}</button><button type="button" onClick={props.onDelete} className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-300"><Trash2 className="h-4 w-4" /></button></div>
    {layer.kind === "text" || layer.kind === "label" ? <label className="property-label">Text<textarea value={layer.value} onChange={(event) => props.onUpdate(layer.id, { value: event.target.value.slice(0, layer.kind === "text" ? 240 : 40) })} className="mt-2 min-h-24 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm normal-case tracking-normal outline-none" /></label> : null}
    <div className="grid grid-cols-2 gap-3"><Slider label="Size" value={layer.scale} min={.15} max={5} step={.05} onChange={(value) => props.onUpdate(layer.id, { scale: value })} display={`${layer.scale.toFixed(2)}×`} /><Slider label="Rotation" value={layer.rotation} min={-180} max={180} step={1} onChange={(value) => props.onUpdate(layer.id, { rotation: value })} display={`${Math.round(layer.rotation)}°`} /></div>
    {layer.kind !== "emoji" ? <Slider label="Width" value={layer.width ?? 50} min={12} max={94} step={1} onChange={(value) => props.onUpdate(layer.id, { width: value })} display={`${Math.round(layer.width ?? 50)}%`} /> : null}
    <Slider label="Opacity" value={layer.opacity ?? 1} min={.1} max={1} step={.05} onChange={(value) => props.onUpdate(layer.id, { opacity: value })} display={`${Math.round((layer.opacity ?? 1) * 100)}%`} />
    {layer.kind === "text" || layer.kind === "label" ? <>
      <Slider label="Font size" value={layer.fontSize ?? 32} min={12} max={96} step={1} onChange={(value) => props.onUpdate(layer.id, { fontSize: value })} display={`${Math.round(layer.fontSize ?? 32)}px`} />
      <label className="property-label">Font<select value={layer.fontFamily || "sans"} onChange={(event) => props.onUpdate(layer.id, { fontFamily: event.target.value as StoryFont })} className="property-input"><option value="sans">Clean</option><option value="display">Display</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label>
      <div className="grid grid-cols-3 gap-2"><AlignButton active={layer.align === "left"} icon={AlignLeft} onClick={() => props.onUpdate(layer.id, { align: "left" as StoryAlign })} /><AlignButton active={!layer.align || layer.align === "center"} icon={AlignCenter} onClick={() => props.onUpdate(layer.id, { align: "center" as StoryAlign })} /><AlignButton active={layer.align === "right"} icon={AlignRight} onClick={() => props.onUpdate(layer.id, { align: "right" as StoryAlign })} /></div>
      <ColorRow label="Text color" colors={COLORS} value={layer.color || "#ffffff"} onChange={(color) => props.onUpdate(layer.id, { color })} />
      <ColorRow label="Background" colors={BACKGROUNDS} value={layer.background || "transparent"} onChange={(background) => props.onUpdate(layer.id, { background })} />
    </> : null}
    {layer.kind === "shape" ? <><label className="property-label">Shape<select value={layer.shape || "rectangle"} onChange={(event) => props.onUpdate(layer.id, { shape: event.target.value as StoryShape })} className="property-input"><option value="rectangle">Rectangle</option><option value="circle">Circle</option><option value="pill">Pill</option><option value="line">Line</option></select></label><ColorRow label="Shape color" colors={COLORS} value={layer.background || "#ffffff"} onChange={(background) => props.onUpdate(layer.id, { background, color: background })} /></> : null}
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => props.onReorder("up")} className="inspector-action justify-center"><ArrowUp className="h-4 w-4" />Bring forward</button><button type="button" onClick={() => props.onReorder("down")} className="inspector-action justify-center"><ArrowDown className="h-4 w-4" />Send backward</button></div>
    <button type="button" onClick={() => props.onUpdate(layer.id, { hidden: !layer.hidden })} className="inspector-action w-full justify-center">{layer.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{layer.hidden ? "Show layer" : "Hide layer"}</button>
  </div>;
}

function LayerContent({ layer }: { layer: StorySticker }) {
  if (layer.kind === "emoji") return <span className="block text-[54px] leading-none drop-shadow-xl" style={{ fontSize: `${layer.fontSize ?? 54}px` }}>{layer.value}</span>;
  if (layer.kind === "shape") return <span className={cn("block w-full", layer.shape === "circle" && "aspect-square rounded-full", layer.shape === "rectangle" && "aspect-[2/1] rounded-md", layer.shape === "pill" && "h-12 rounded-full", layer.shape === "line" && "h-1 rounded-full")} style={{ background: layer.background || layer.color || "#fff" }} />;
  return <span className={cn("block w-full whitespace-pre-wrap px-3 py-2 leading-[1.05]", fontClass(layer.fontFamily), layer.kind === "label" && "rounded-xl")} style={{ color: layer.color || "#fff", background: layer.background || "transparent", fontSize: `${layer.fontSize ?? 32}px`, fontWeight: layer.fontWeight ?? 800, textAlign: layer.align || "center", borderRadius: layer.kind === "text" && layer.background !== "transparent" ? "14px" : undefined }}>{layer.value}</span>;
}

function ToolButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold text-white/38 transition hover:bg-white/7 hover:text-white", active && "bg-white text-black hover:bg-white hover:text-black")}><Icon className="h-4 w-4" />{label}</button>;
}

function MobileTool({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[9px] font-bold text-white/40", active && "text-white")}><Icon className={cn("h-5 w-5", active && "fill-white/12")} />{label}</button>;
}

function Panel({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return <section><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-xs leading-5 text-white/38">{text}</p><div className="mt-4">{children}</div></section>;
}

function ActionButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex h-20 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.025] text-xs font-bold hover:bg-white/7"><Icon className="h-5 w-5" />{label}</button>;
}

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (value: number) => void }) {
  return <label className="property-label"><span className="flex items-center"><span>{label}</span><span className="ml-auto text-white/60">{display}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-white" /></label>;
}

function ColorRow({ label, colors, value, onChange }: { label: string; colors: string[]; value: string; onChange: (value: string) => void }) {
  return <div><p className="property-label">{label}</p><div className="mt-2 flex flex-wrap gap-2">{colors.map((color) => <button key={color} type="button" onClick={() => onChange(color)} className={cn("h-8 w-8 rounded-full border-2", value === color ? "border-white" : "border-transparent", color === "transparent" && "bg-[linear-gradient(135deg,#fff_0_45%,#ef4444_46%_54%,#fff_55%)]")} style={color === "transparent" ? undefined : { background: color }} aria-label={`Use ${color}`} />)}</div></div>;
}

function AlignButton({ active, icon: Icon, onClick }: { active: boolean; icon: LucideIcon; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("grid h-10 place-items-center rounded-xl border border-white/10", active && "bg-white text-black")}><Icon className="h-4 w-4" /></button>;
}

function cloneLayers(layers: StorySticker[]): StorySticker[] { return layers.map((item) => ({ ...item })); }
function makeId(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function normalizeRotation(value: number): number { let next = value; while (next > 180) next -= 360; while (next < -180) next += 360; return next; }
function fontClass(font?: StoryFont): string { if (font === "display") return "font-black tracking-tight"; if (font === "serif") return "font-serif"; if (font === "mono") return "font-mono"; return "font-sans"; }
function layerIcon(layer: StorySticker): string { if (layer.kind === "emoji") return layer.value; if (layer.kind === "text") return "T"; if (layer.kind === "label") return "Aa"; return "◻"; }
