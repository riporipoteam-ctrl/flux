"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  ImagePlus,
  Layers3,
  Loader2,
  Maximize2,
  Minus,
  Music2,
  Palette,
  Plus,
  RotateCcw,
  RotateCw,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createStory, type FluxStory, type StorySticker } from "@/services/stories";
import { getStoryMusicTrack } from "@/lib/story-music";
import { FluxMusicLibrary } from "@/components/music/flux-music-library";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DESIGNS = [
  { id: "aurora", label: "Aurora", className: "bg-[radial-gradient(circle_at_25%_20%,#67e8f9_0,transparent_26%),radial-gradient(circle_at_75%_40%,#a78bfa_0,transparent_34%),linear-gradient(145deg,#07111f,#172554_48%,#111827)]" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-br from-amber-300 via-rose-500 to-violet-950" },
  { id: "ocean", label: "Ocean", className: "bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-950" },
  { id: "night", label: "Night", className: "bg-[radial-gradient(circle_at_70%_12%,#6366f1_0,transparent_24%),linear-gradient(155deg,#020617,#1e1b4b_55%,#000)]" },
  { id: "mint", label: "Mint", className: "bg-gradient-to-br from-emerald-200 via-teal-600 to-cyan-950" },
  { id: "gold", label: "Gold", className: "bg-gradient-to-br from-amber-100 via-orange-500 to-red-950" },
  { id: "mono", label: "Mono", className: "bg-gradient-to-br from-zinc-100 via-zinc-500 to-zinc-950" },
];

const EMOJIS = ["✨", "🔥", "❤️", "😂", "🎮", "⚽", "🎉", "🌙", "💯", "🚀", "👀", "⭐", "🏆", "🎧", "🪩", "⚡", "🫶", "💎", "👑", "🌈"];
const TEXT_COLORS = ["#ffffff", "#111111", "#ffe066", "#ff7aa2", "#7dd3fc", "#86efac", "#c4b5fd", "#fb923c"];
const TEXT_STYLES: FluxStory["textStyle"][] = ["clean", "bold", "serif", "mono"];
const TEXT_POSITIONS: FluxStory["textPosition"][] = ["top", "center", "bottom"];
type Tool = "media" | "text" | "stickers" | "design" | "music";
type GestureMode = "move" | "scale" | "rotate";

interface GestureState {
  pointerId: number;
  mode: GestureMode;
  stickerId: string;
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

export default function StoryStudioV2() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const gestureRef = useRef<GestureState | null>(null);

  const [tool, setTool] = useState<Tool>("media");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState<FluxStory["textStyle"]>("clean");
  const [textPosition, setTextPosition] = useState<FluxStory["textPosition"]>("center");
  const [designId, setDesignId] = useState("aurora");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [labelText, setLabelText] = useState("");
  const [publishing, setPublishing] = useState(false);

  const selectedSticker = stickers.find((item) => item.id === selectedStickerId) || null;
  const selectedMusic = getStoryMusicTrack(musicId);
  const selectedDesign = DESIGNS.find((item) => item.id === designId) || DESIGNS[0];
  const canPublish = Boolean(file || text.trim() || stickers.length);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("image/") && !next.type.startsWith("video/")) {
      toast.error("Choose an image or video.");
      return;
    }
    if (next.size > 40 * 1024 * 1024) {
      toast.error("Stories must be under 40 MB.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(next);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFile(next);
    setSelectedStickerId(null);
    setTool("text");
  };

  const removeMedia = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setFile(null);
  };

  const addSticker = (kind: StorySticker["kind"], value: string) => {
    const sticker: StorySticker = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      value: value.slice(0, 40),
      x: 50,
      y: 52,
      scale: 1,
      rotation: 0,
    };
    setStickers((items) => [...items, sticker].slice(-30));
    setSelectedStickerId(sticker.id);
  };

  const updateSticker = (id: string, patch: Partial<StorySticker>) => {
    setStickers((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const deleteSelected = () => {
    if (!selectedStickerId) return;
    setStickers((items) => items.filter((item) => item.id !== selectedStickerId));
    setSelectedStickerId(null);
  };

  const duplicateSelected = () => {
    if (!selectedSticker) return;
    const duplicate: StorySticker = {
      ...selectedSticker,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: Math.min(92, selectedSticker.x + 7),
      y: Math.min(92, selectedSticker.y + 7),
    };
    setStickers((items) => [...items, duplicate].slice(-30));
    setSelectedStickerId(duplicate.id);
  };

  const beginGesture = (event: React.PointerEvent<HTMLElement>, sticker: StorySticker, mode: GestureMode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedStickerId(sticker.id);
    const bounds = canvas.getBoundingClientRect();
    const centerX = bounds.left + (sticker.x / 100) * bounds.width;
    const centerY = bounds.top + (sticker.y / 100) * bounds.height;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    gestureRef.current = {
      pointerId: event.pointerId,
      mode,
      stickerId: sticker.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: sticker.x,
      startY: sticker.y,
      startScale: sticker.scale,
      startRotation: sticker.rotation,
      centerX,
      centerY,
      startDistance: Math.max(1, Math.hypot(dx, dy)),
      startAngle: Math.atan2(dy, dx) * (180 / Math.PI),
    };
  };

  const moveGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    const canvas = canvasRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !canvas) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    if (gesture.mode === "move") {
      const x = Math.min(96, Math.max(4, gesture.startX + ((event.clientX - gesture.startClientX) / bounds.width) * 100));
      const y = Math.min(96, Math.max(4, gesture.startY + ((event.clientY - gesture.startClientY) / bounds.height) * 100));
      updateSticker(gesture.stickerId, { x, y });
      return;
    }
    const dx = event.clientX - gesture.centerX;
    const dy = event.clientY - gesture.centerY;
    if (gesture.mode === "scale") {
      const distance = Math.max(1, Math.hypot(dx, dy));
      updateSticker(gesture.stickerId, { scale: Math.min(4, Math.max(0.25, gesture.startScale * (distance / gesture.startDistance))) });
      return;
    }
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    updateSticker(gesture.stickerId, { rotation: normalizeRotation(gesture.startRotation + angle - gesture.startAngle) });
  };

  const endGesture = (event: React.PointerEvent<HTMLElement>) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const reset = () => {
    removeMedia();
    setText("");
    setTextColor("#ffffff");
    setTextStyle("clean");
    setTextPosition("center");
    setDesignId("aurora");
    setMusicId(null);
    setStickers([]);
    setSelectedStickerId(null);
    setTool("media");
  };

  const publish = async () => {
    if (!user || publishing || !canPublish) return;
    setPublishing(true);
    try {
      await createStory({
        authorId: user.uid,
        file,
        text,
        textColor,
        textStyle,
        textPosition,
        designId,
        musicId,
        stickers,
      });
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
    <main className="min-h-screen bg-[#08090b] pb-24 text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08090b]/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1450px] items-center gap-3 px-3 sm:px-5">
          <button type="button" onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-full bg-white/7" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-black">Story Studio</h1><p className="truncate text-[11px] text-white/42">Move, resize and rotate every sticker</p></div>
          <button type="button" onClick={reset} className="hidden h-10 items-center gap-2 rounded-full px-3 text-xs font-black text-white/45 hover:bg-white/7 sm:flex"><RotateCcw className="h-4 w-4" />Reset</button>
          <Button onClick={() => void publish()} disabled={!canPublish || publishing} className="h-11 rounded-full bg-white px-5 font-black text-black hover:bg-white/90">{publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Share</Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1450px] gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(340px,500px)_minmax(0,1fr)]">
        <section className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/28">Canvas</p><p className="mt-1 text-xs text-white/45">Tap a sticker to reveal its handles</p></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-[9px] font-black text-white/40">9:16</span></div>
          <div
            ref={canvasRef}
            onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedStickerId(null); }}
            className={cn("relative mx-auto aspect-[9/16] w-full max-w-[470px] touch-none overflow-hidden rounded-[30px] border border-white/12 shadow-[0_40px_120px_rgba(0,0,0,.6)]", selectedDesign.className)}
          >
            {previewUrl ? file?.type.startsWith("video/") ? <video src={previewUrl} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : <img src={previewUrl} alt="Story preview" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/14 via-transparent to-black/42" />

            {!previewUrl && !text && !stickers.length ? (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-10 text-center"><span className="grid h-20 w-20 place-items-center rounded-full border border-white/14 bg-white/8"><Sparkles className="h-8 w-8" /></span><div><p className="text-xl font-black">Start your Story</p><p className="mt-2 text-xs leading-5 text-white/45">Add media, text, stickers or music.</p></div></button>
            ) : null}

            {text ? <div className={cn("pointer-events-none absolute inset-x-5 z-20 flex", textPositionClass(textPosition))}><p className={cn("mx-auto max-w-full whitespace-pre-wrap rounded-2xl bg-black/30 px-4 py-3 text-center text-2xl leading-tight shadow-xl backdrop-blur-[3px]", textStyleClass(textStyle))} style={{ color: textColor }}>{text}</p></div> : null}

            {stickers.map((item) => {
              const selected = item.id === selectedStickerId;
              return (
                <div key={item.id} className="absolute z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})` }}>
                  <button
                    type="button"
                    onPointerDown={(event) => beginGesture(event, item, "move")}
                    onPointerMove={moveGesture}
                    onPointerUp={endGesture}
                    onPointerCancel={endGesture}
                    className={cn("relative cursor-grab select-none touch-none active:cursor-grabbing", selected && "outline outline-2 outline-white outline-offset-4")}
                    aria-label={`Move ${item.value}`}
                  >
                    {item.kind === "emoji" ? <span className="block text-5xl drop-shadow-xl">{item.value}</span> : <span className="block rounded-xl bg-white px-3 py-1.5 text-sm font-black tracking-wide text-black shadow-xl">{item.value}</span>}
                  </button>
                  {selected ? (
                    <>
                      <button type="button" onPointerDown={(event) => beginGesture(event, item, "rotate")} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className="absolute -right-7 -top-7 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-xl" aria-label="Rotate sticker"><RotateCw className="h-3.5 w-3.5" /></button>
                      <button type="button" onPointerDown={(event) => beginGesture(event, item, "scale")} onPointerMove={moveGesture} onPointerUp={endGesture} onPointerCancel={endGesture} className="absolute -bottom-7 -right-7 grid h-7 w-7 place-items-center rounded-full bg-white text-black shadow-xl" aria-label="Resize sticker"><Maximize2 className="h-3.5 w-3.5" /></button>
                    </>
                  ) : null}
                </div>
              );
            })}

            {selectedMusic ? <div className="absolute bottom-4 left-4 z-40 flex max-w-[75%] items-center gap-2 rounded-full border border-white/10 bg-black/58 px-3 py-2 text-xs font-black backdrop-blur-xl"><Music2 className="h-4 w-4 shrink-0" /><span className="truncate">{selectedMusic.title}</span></div> : null}
            {previewUrl ? <button type="button" onClick={removeMedia} className="absolute right-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur-xl" aria-label="Remove media"><Trash2 className="h-4 w-4" /></button> : null}
          </div>

          {selectedSticker ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[.035] p-3">
              <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-white/45" /><p className="min-w-0 flex-1 truncate text-xs font-black">Selected: {selectedSticker.value}</p><button type="button" onClick={duplicateSelected} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/8" aria-label="Duplicate"><Copy className="h-4 w-4" /></button><button type="button" onClick={deleteSelected} className="grid h-9 w-9 place-items-center rounded-full text-red-300 hover:bg-red-500/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TransformSlider icon={Maximize2} label="Size" min={0.25} max={4} step={0.05} value={selectedSticker.scale} onChange={(value) => updateSticker(selectedSticker.id, { scale: value })} />
                <TransformSlider icon={RotateCw} label="Rotation" min={-180} max={180} step={1} value={selectedSticker.rotation} onChange={(value) => updateSticker(selectedSticker.id, { rotation: value })} />
              </div>
              <div className="mt-3 flex gap-2"><button type="button" onClick={() => updateSticker(selectedSticker.id, { scale: Math.max(0.25, selectedSticker.scale - 0.1) })} className="flex h-10 flex-1 items-center justify-center rounded-full bg-white/7"><Minus className="h-4 w-4" /></button><button type="button" onClick={() => updateSticker(selectedSticker.id, { rotation: 0, scale: 1 })} className="h-10 flex-[2] rounded-full bg-white/7 text-xs font-black">Reset transform</button><button type="button" onClick={() => updateSticker(selectedSticker.id, { scale: Math.min(4, selectedSticker.scale + 0.1) })} className="flex h-10 flex-1 items-center justify-center rounded-full bg-white/7"><Plus className="h-4 w-4" /></button></div>
            </div>
          ) : null}

          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
          <input ref={cameraInputRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
        </section>

        <section className="min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#101114]">
          <nav className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 no-scrollbar">
            <ToolButton active={tool === "media"} icon={ImagePlus} label="Media" onClick={() => setTool("media")} />
            <ToolButton active={tool === "text"} icon={Type} label="Text" onClick={() => setTool("text")} />
            <ToolButton active={tool === "stickers"} icon={Sticker} label="Stickers" onClick={() => setTool("stickers")} />
            <ToolButton active={tool === "design"} icon={Palette} label="Design" onClick={() => setTool("design")} />
            <ToolButton active={tool === "music"} icon={Music2} label="Music" onClick={() => setTool("music")} />
          </nav>

          <div className="min-h-[520px] p-4 sm:p-5">
            {tool === "media" ? (
              <Panel title="Photo or video" text="Use the library or camera. Images are compressed before upload and can fall back safely when Firebase Storage is unavailable.">
                <div className="grid gap-3 sm:grid-cols-2"><ActionTile icon={ImagePlus} title="Choose media" detail="Photo or video up to 40 MB" onClick={() => fileInputRef.current?.click()} /><ActionTile icon={Camera} title="Open camera" detail="Use the device camera picker" onClick={() => cameraInputRef.current?.click()} /></div>
                {file ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/12 text-emerald-300"><Check className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{file.name}</p><p className="text-[10px] text-white/38">{Math.max(0.1, file.size / 1024 / 1024).toFixed(1)} MB</p></div><button type="button" onClick={removeMedia} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/8"><X className="h-4 w-4" /></button></div> : null}
              </Panel>
            ) : null}

            {tool === "text" ? (
              <Panel title="Story text" text="Text stays readable while stickers remain fully movable.">
                <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 240))} placeholder="Write something…" className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-base outline-none focus:border-white/35" />
                <div className="mt-4 flex flex-wrap gap-2">{TEXT_STYLES.map((style) => <button key={style} type="button" onClick={() => setTextStyle(style)} className={cn("rounded-full px-4 py-2 text-xs font-black capitalize", textStyle === style ? "bg-white text-black" : "bg-white/7 text-white/50")}>{style}</button>)}</div>
                <div className="mt-4 flex flex-wrap gap-2">{TEXT_COLORS.map((color) => <button key={color} type="button" onClick={() => setTextColor(color)} className={cn("h-9 w-9 rounded-full border-2", textColor === color ? "border-white" : "border-transparent")} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">{TEXT_POSITIONS.map((position) => <button key={position} type="button" onClick={() => setTextPosition(position)} className={cn("rounded-2xl py-3 text-xs font-black capitalize", textPosition === position ? "bg-white text-black" : "bg-white/7 text-white/50")}>{position}</button>)}</div>
              </Panel>
            ) : null}

            {tool === "stickers" ? (
              <Panel title="Stickers" text="Add one, then drag it directly on the canvas. The round handles rotate and resize it.">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => addSticker("emoji", emoji)} className="grid aspect-square place-items-center rounded-2xl bg-white/6 text-2xl hover:bg-white/10">{emoji}</button>)}</div>
                <div className="mt-5 flex gap-2"><input value={labelText} onChange={(event) => setLabelText(event.target.value.slice(0, 40))} onKeyDown={(event) => { if (event.key === "Enter" && labelText.trim()) { addSticker("label", labelText.trim()); setLabelText(""); } }} placeholder="Custom label" className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none" /><Button type="button" onClick={() => { if (!labelText.trim()) return; addSticker("label", labelText.trim()); setLabelText(""); }} disabled={!labelText.trim()} className="h-12 rounded-2xl px-5">Add</Button></div>
                {stickers.length ? <div className="mt-5 space-y-2">{[...stickers].reverse().map((item) => <button key={item.id} type="button" onClick={() => setSelectedStickerId(item.id)} className={cn("flex h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left", item.id === selectedStickerId ? "border-white bg-white text-black" : "border-white/10 bg-white/[.025]")}><span className="text-xl">{item.kind === "emoji" ? item.value : "Aa"}</span><span className="min-w-0 flex-1 truncate text-sm font-black">{item.value}</span><span className="text-[10px] opacity-60">{item.scale.toFixed(2)}× · {Math.round(item.rotation)}°</span></button>)}</div> : null}
              </Panel>
            ) : null}

            {tool === "design" ? (
              <Panel title="Background" text="Choose a clean backdrop for text-only Stories or media framing."><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{DESIGNS.map((design) => <button key={design.id} type="button" onClick={() => setDesignId(design.id)} className={cn("rounded-2xl border p-2 text-left", design.id === designId ? "border-white bg-white/8" : "border-white/8")}><span className={cn("block aspect-[4/3] rounded-xl", design.className)} /><span className="mt-2 block px-1 text-xs font-black">{design.label}</span></button>)}</div></Panel>
            ) : null}

            {tool === "music" ? <FluxMusicLibrary selectedId={musicId} allowNone onSelect={(track) => setMusicId(track?.id || null)} title="Story music" description="Preview and select real CC0 tracks. The selected song plays in the Story viewer." /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function ToolButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof ImagePlus; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-black", active ? "bg-white text-black" : "text-white/45 hover:bg-white/7 hover:text-white")}><Icon className="h-4 w-4" />{label}</button>;
}

function Panel({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return <section><h2 className="text-xl font-black">{title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/42">{text}</p><div className="mt-5">{children}</div></section>;
}

function ActionTile({ icon: Icon, title, detail, onClick }: { icon: typeof ImagePlus; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-5 text-center hover:bg-white/6"><span className="grid h-12 w-12 place-items-center rounded-full bg-white/8"><Icon className="h-5 w-5" /></span><strong className="mt-3 text-sm">{title}</strong><span className="mt-1 text-[10px] text-white/38">{detail}</span></button>;
}

function TransformSlider({ icon: Icon, label, min, max, step, value, onChange }: { icon: typeof Maximize2; label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return <label className="block text-[10px] font-black uppercase tracking-wider text-white/38"><span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}<span className="ml-auto text-white/60">{label === "Size" ? `${value.toFixed(2)}×` : `${Math.round(value)}°`}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-white" /></label>;
}

function normalizeRotation(value: number): number {
  let next = value;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function textPositionClass(position: FluxStory["textPosition"]): string {
  if (position === "top") return "top-24 justify-center";
  if (position === "bottom") return "bottom-24 justify-center";
  return "top-1/2 -translate-y-1/2 justify-center";
}

function textStyleClass(style: FluxStory["textStyle"]): string {
  if (style === "bold") return "font-black uppercase tracking-tight";
  if (style === "serif") return "font-serif italic";
  if (style === "mono") return "font-mono text-xl";
  return "font-bold";
}
