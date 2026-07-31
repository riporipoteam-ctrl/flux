"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Music2,
  RotateCcw,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createStory, type FluxStory, type StorySticker } from "@/services/stories";
import { getStoryMusicTrack } from "@/lib/story-music";
import { FluxMusicLibrary } from "@/components/music/flux-music-library";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DESIGNS = [
  { id: "none", label: "Original", className: "bg-black" },
  { id: "aurora", label: "Aurora", className: "bg-[radial-gradient(circle_at_25%_20%,#67e8f9_0,transparent_26%),radial-gradient(circle_at_75%_40%,#a78bfa_0,transparent_34%),linear-gradient(145deg,#07111f,#172554_48%,#111827)]" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-br from-amber-300 via-rose-500 to-violet-950" },
  { id: "ocean", label: "Ocean", className: "bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-950" },
  { id: "night", label: "Night", className: "bg-[radial-gradient(circle_at_70%_12%,#6366f1_0,transparent_24%),linear-gradient(155deg,#020617,#1e1b4b_55%,#000)]" },
  { id: "mint", label: "Mint", className: "bg-gradient-to-br from-emerald-200 via-teal-600 to-cyan-950" },
  { id: "gold", label: "Gold", className: "bg-gradient-to-br from-amber-100 via-orange-500 to-red-950" },
  { id: "mono", label: "Mono", className: "bg-gradient-to-br from-zinc-100 via-zinc-500 to-zinc-950" },
];
const TEXT_COLORS = ["#ffffff", "#111111", "#ffe066", "#ff7aa2", "#7dd3fc", "#86efac", "#c4b5fd", "#fb923c"];
const TEXT_STYLES: FluxStory["textStyle"][] = ["clean", "bold", "serif", "mono"];
const TEXT_POSITIONS: FluxStory["textPosition"][] = ["top", "center", "bottom"];
const EMOJIS = ["✨", "🔥", "❤️", "😂", "🎮", "⚽", "🎉", "🌙", "💯", "🚀", "👀", "⭐", "🏆", "🎧", "🪩", "⚡"];
type EditorTab = "media" | "text" | "design" | "stickers" | "music";

export default function CreateStoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<EditorTab>("media");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState<FluxStory["textStyle"]>("clean");
  const [textPosition, setTextPosition] = useState<FluxStory["textPosition"]>("center");
  const [designId, setDesignId] = useState("aurora");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const [labelSticker, setLabelSticker] = useState("");
  const [publishing, setPublishing] = useState(false);

  const design = useMemo(() => DESIGNS.find((item) => item.id === designId) || DESIGNS[1], [designId]);
  const selectedMusic = getStoryMusicTrack(musicId);
  const canPublish = Boolean(file || text.trim() || stickers.length);

  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("image/") && !next.type.startsWith("video/")) return toast.error("Choose an image or video");
    if (next.size > 40 * 1024 * 1024) return toast.error("Stories must be under 40 MB");
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(next);
    previewRef.current = url;
    setPreview(url);
    setFile(next);
    setDesignId("none");
    setTab("text");
  };

  const removeMedia = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setFile(null);
    setDesignId("aurora");
  };

  const addSticker = (kind: StorySticker["kind"], value: string) => {
    const item: StorySticker = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value: value.slice(0, 40),
      x: 50,
      y: 52 + ((stickers.length * 8) % 28),
      scale: 1,
      rotation: kind === "emoji" ? (stickers.length % 2 ? 7 : -7) : 0,
    };
    setStickers((items) => [...items, item].slice(-20));
    setActiveStickerId(item.id);
  };

  const moveSticker = (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const x = Math.min(92, Math.max(8, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(92, Math.max(8, ((event.clientY - bounds.top) / bounds.height) * 100));
    setStickers((items) => items.map((item) => item.id === id ? { ...item, x, y } : item));
  };

  const reset = () => {
    removeMedia();
    setText("");
    setStickers([]);
    setMusicId(null);
    setTextColor("#ffffff");
    setTextStyle("clean");
    setTextPosition("center");
    setTab("media");
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
        designId: designId === "none" ? null : designId,
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
    <main className="min-h-screen bg-[#07080b] text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#08090d]/90 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-3 sm:px-5">
          <button type="button" onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/8 bg-white/[.035] hover:bg-white/8" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><h1 className="text-base font-black tracking-tight sm:text-lg">Story Studio</h1><span className="rounded-full bg-violet-500/14 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-violet-300">24 hours</span></div>
            <p className="truncate text-[11px] text-white/38">Design, music, text and draggable stickers</p>
          </div>
          <button type="button" onClick={reset} className="hidden h-10 items-center gap-2 rounded-2xl px-3 text-xs font-black text-white/45 hover:bg-white/6 hover:text-white sm:flex"><RotateCcw className="h-4 w-4" />Reset</button>
          <Button onClick={() => void publish()} disabled={!canPublish || publishing} className="h-11 rounded-2xl bg-white px-5 font-black text-black hover:bg-white/90">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Share Story
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 p-3 pb-24 sm:p-5 lg:grid-cols-[minmax(330px,470px)_minmax(0,1fr)] xl:grid-cols-[minmax(350px,500px)_minmax(0,1fr)]">
        <section className="lg:sticky lg:top-20 lg:self-start">
          <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-white/28">Live canvas</p><p className="mt-1 text-xs text-white/48">Drag stickers anywhere on the Story</p></div><span className="rounded-full border border-white/8 bg-white/[.035] px-3 py-1.5 text-[9px] font-black text-white/38">9:16</span></div>
          <div ref={canvasRef} className={cn("relative mx-auto aspect-[9/16] w-full max-w-[450px] touch-none overflow-hidden rounded-[34px] border border-white/10 shadow-[0_42px_120px_rgba(0,0,0,.58)]", design.className)}>
            {preview ? file?.type.startsWith("video/") ? <video src={preview} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" /> : <img src={preview} alt="Story preview" className="absolute inset-0 h-full w-full object-cover" /> : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/18 via-transparent to-black/40" />
            {!preview && !text && !stickers.length ? <button type="button" onClick={() => fileInput.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-10 text-center"><span className="grid h-20 w-20 place-items-center rounded-[28px] border border-white/12 bg-white/8 shadow-xl"><Sparkles className="h-8 w-8" /></span><div><p className="text-xl font-black">Create a Story</p><p className="mt-2 max-w-xs text-xs leading-5 text-white/46">Start with a photo, video, text design, music, or stickers.</p></div></button> : null}
            {text ? <div className={cn("pointer-events-none absolute inset-x-5 z-20 flex", positionClass(textPosition))}><p className={cn("mx-auto max-w-full whitespace-pre-wrap rounded-2xl bg-black/28 px-4 py-3 text-center text-2xl leading-tight shadow-xl backdrop-blur-[3px]", textClass(textStyle))} style={{ color: textColor }}>{text}</p></div> : null}
            {stickers.map((item) => <button key={item.id} type="button" onPointerDown={(event) => { setActiveStickerId(item.id); moveSticker(event, item.id); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) moveSticker(event, item.id); }} onDoubleClick={() => setStickers((items) => items.filter((sticker) => sticker.id !== item.id))} className={cn("absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none touch-none active:cursor-grabbing", activeStickerId === item.id && "drop-shadow-[0_0_10px_rgba(167,139,250,.9)]")} style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)` }}>{item.kind === "emoji" ? <span className="text-5xl drop-shadow-xl">{item.value}</span> : <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-black text-black shadow-xl">{item.value}</span>}</button>)}
            {selectedMusic ? <div className="absolute bottom-5 left-4 right-16 z-30 flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-black/58 px-3 py-2.5 text-xs font-black backdrop-blur-xl"><Music2 className="h-4 w-4 shrink-0 text-violet-300" /><span className="truncate">{selectedMusic.title}</span><span className="ml-auto shrink-0 text-[8px] uppercase tracking-wider text-emerald-300">CC0</span></div> : null}
            <div className="absolute right-3 top-3 z-40 flex gap-2">{preview ? <button type="button" onClick={removeMedia} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/48 backdrop-blur-xl" aria-label="Remove media"><Trash2 className="h-4 w-4" /></button> : null}<button type="button" onClick={reset} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/48 backdrop-blur-xl" aria-label="Reset Story"><RotateCcw className="h-4 w-4" /></button></div>
          </div>
          <p className="mt-3 text-center text-[10px] text-white/25">Double-tap a sticker to remove it</p>
          <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(event) => { pickFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} />
        </section>

        <section className="min-w-0 overflow-hidden rounded-[30px] border border-white/8 bg-[#0d0f14] shadow-[0_24px_80px_rgba(0,0,0,.24)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-white/8 bg-black/18 p-2 no-scrollbar">
            <Tab active={tab === "media"} icon={ImagePlus} label="Media" onClick={() => setTab("media")} />
            <Tab active={tab === "text"} icon={Type} label="Text" onClick={() => setTab("text")} />
            <Tab active={tab === "design"} icon={Wand2} label="Design" onClick={() => setTab("design")} />
            <Tab active={tab === "stickers"} icon={Sticker} label="Stickers" onClick={() => setTab("stickers")} />
            <Tab active={tab === "music"} icon={Music2} label="Music" onClick={() => setTab("music")} />
          </nav>

          <div className="min-h-[560px] p-4 sm:p-6">
            {tab === "media" ? <Panel title="Add media" description="Use your library or open the camera. Images and videos can be up to 40 MB."><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => fileInput.current?.click()} className="group flex min-h-44 flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/12 bg-white/[.025] transition hover:border-violet-400/60 hover:bg-violet-500/6"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/7 transition group-hover:bg-violet-500 group-hover:text-white"><ImagePlus className="h-6 w-6" /></span><div><p className="text-sm font-black">Choose from device</p><p className="mt-1 text-[10px] text-white/35">Photo, GIF or video</p></div></button><button type="button" onClick={() => cameraInput.current?.click()} className="group flex min-h-44 flex-col items-center justify-center gap-3 rounded-[24px] border border-white/8 bg-white/[.025] transition hover:border-cyan-400/60 hover:bg-cyan-500/6"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/7 transition group-hover:bg-cyan-500 group-hover:text-white"><Camera className="h-6 w-6" /></span><div><p className="text-sm font-black">Open camera</p><p className="mt-1 text-[10px] text-white/35">Capture something now</p></div></button></div>{file ? <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/7 p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/12"><Check className="h-5 w-5 text-emerald-300" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{file.name}</p><p className="text-[10px] text-white/38">{Math.max(.1, file.size / 1024 / 1024).toFixed(1)} MB</p></div><button type="button" onClick={removeMedia} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/7"><Trash2 className="h-4 w-4" /></button></div> : null}</Panel> : null}

            {tab === "text" ? <Panel title="Story text" description="Make a text-only Story or layer a message over your media."><textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 240))} placeholder="Write something worth sharing…" className="min-h-36 w-full resize-none rounded-[22px] border border-white/10 bg-black/22 p-4 text-lg leading-7 outline-none placeholder:text-white/24 focus:border-violet-400" /><p className="mt-2 text-right text-[10px] font-bold text-white/30">{text.length}/240</p><div className="mt-5"><ControlLabel>Font style</ControlLabel><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{TEXT_STYLES.map((style) => <button key={style} type="button" onClick={() => setTextStyle(style)} className={cn("rounded-2xl border px-3 py-3 text-xs font-black capitalize", textStyle === style ? "border-white bg-white text-black" : "border-white/8 bg-white/[.025] text-white/48")}>{style}</button>)}</div></div><div className="mt-5"><ControlLabel>Color</ControlLabel><div className="mt-2 flex flex-wrap gap-2">{TEXT_COLORS.map((color) => <button key={color} type="button" onClick={() => setTextColor(color)} className={cn("h-10 w-10 rounded-full border-[3px] transition", textColor === color ? "scale-110 border-white" : "border-transparent")} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div></div><div className="mt-5"><ControlLabel>Position</ControlLabel><div className="mt-2 grid grid-cols-3 gap-2">{TEXT_POSITIONS.map((position) => <button key={position} type="button" onClick={() => setTextPosition(position)} className={cn("rounded-2xl border py-3 text-xs font-black capitalize", textPosition === position ? "border-violet-400 bg-violet-500/14 text-violet-200" : "border-white/8 text-white/42")}>{position}</button>)}</div></div></Panel> : null}

            {tab === "design" ? <Panel title="Background design" description="Use a polished background for text-only Stories or behind transparent media."><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{DESIGNS.map((item) => <button key={item.id} type="button" onClick={() => setDesignId(item.id)} className={cn("rounded-[22px] border p-2 text-left transition", designId === item.id ? "border-violet-400 bg-violet-500/10" : "border-white/8 hover:bg-white/[.035]")}><span className={cn("block aspect-[4/3] rounded-[16px] border border-white/8", item.className)} /><span className="mt-2 flex items-center justify-between px-1 text-xs font-black"><span>{item.label}</span>{designId === item.id ? <Check className="h-4 w-4 text-violet-300" /> : null}</span></button>)}</div></Panel> : null}

            {tab === "stickers" ? <Panel title="Sticker tray" description="Add stickers, then drag them directly on the Story canvas."><div className="grid grid-cols-6 gap-2 sm:grid-cols-8">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => addSticker("emoji", emoji)} className="grid aspect-square place-items-center rounded-2xl border border-white/7 bg-white/[.035] text-2xl transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-violet-500/8">{emoji}</button>)}</div><div className="mt-5 rounded-[22px] border border-white/8 bg-black/18 p-3"><ControlLabel>Custom label</ControlLabel><div className="mt-2 flex gap-2"><input value={labelSticker} onChange={(event) => setLabelSticker(event.target.value.slice(0, 40))} onKeyDown={(event) => { if (event.key === "Enter" && labelSticker.trim()) { addSticker("label", labelSticker.trim()); setLabelSticker(""); } }} placeholder="RIPO TEAM, LIVE, ASK ME…" className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-violet-400" /><Button type="button" onClick={() => { if (labelSticker.trim()) { addSticker("label", labelSticker.trim()); setLabelSticker(""); } }} disabled={!labelSticker.trim()} className="h-12 rounded-2xl px-5">Add</Button></div></div>{stickers.length ? <button type="button" onClick={() => setStickers([])} className="mt-4 flex items-center gap-2 text-xs font-black text-red-300/70 hover:text-red-300"><Trash2 className="h-4 w-4" />Clear all stickers</button> : null}</Panel> : null}

            {tab === "music" ? <FluxMusicLibrary selectedId={musicId} onSelect={(track) => setMusicId(track?.id || null)} allowNone title="Story music" description="Search and preview 130 real CC0/public-domain tracks before adding one to your Story." /> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Tab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Sparkles; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-black transition", active ? "bg-white text-black shadow-sm" : "text-white/40 hover:bg-white/6 hover:text-white")}><Icon className="h-4 w-4" />{label}</button>;
}
function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section><div className="mb-5"><h2 className="text-2xl font-black tracking-[-.035em]">{title}</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/40">{description}</p></div>{children}</section>;
}
function ControlLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/32">{children}</p>;
}
function positionClass(position: FluxStory["textPosition"]): string {
  if (position === "top") return "top-24 justify-center";
  if (position === "bottom") return "bottom-24 justify-center";
  return "top-1/2 -translate-y-1/2 justify-center";
}
function textClass(style: FluxStory["textStyle"]): string {
  if (style === "bold") return "font-black uppercase tracking-tight";
  if (style === "serif") return "font-serif italic";
  if (style === "mono") return "font-mono text-xl";
  return "font-bold";
}
