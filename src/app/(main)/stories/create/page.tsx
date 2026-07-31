"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  Music2,
  Pause,
  Play,
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
import { startStoryMusic, STORY_MUSIC } from "@/lib/story-music";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DESIGNS = [
  { id: "none", label: "Original", className: "bg-black" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-br from-orange-400 via-rose-500 to-violet-800" },
  { id: "ocean", label: "Ocean", className: "bg-gradient-to-br from-cyan-300 via-blue-600 to-indigo-950" },
  { id: "night", label: "Night", className: "bg-gradient-to-br from-slate-800 via-violet-950 to-black" },
  { id: "mint", label: "Mint", className: "bg-gradient-to-br from-emerald-200 via-teal-600 to-cyan-950" },
  { id: "gold", label: "Gold", className: "bg-gradient-to-br from-amber-200 via-orange-500 to-red-900" },
  { id: "mono", label: "Mono", className: "bg-gradient-to-br from-zinc-100 via-zinc-500 to-zinc-950" },
];

const TEXT_COLORS = ["#ffffff", "#111111", "#ffe066", "#ff7aa2", "#7dd3fc", "#86efac", "#c4b5fd", "#fb923c"];
const TEXT_STYLES: FluxStory["textStyle"][] = ["clean", "bold", "serif", "mono"];
const TEXT_POSITIONS: FluxStory["textPosition"][] = ["top", "center", "bottom"];
const EMOJI_STICKERS = ["✨", "🔥", "💙", "😂", "😍", "🎉", "⚽", "🎮", "🌍", "🚀", "☀️", "🌙", "📍", "💯", "👏", "🎵"];
const LABEL_STICKERS = ["NEW", "LIVE", "MOOD", "GORAŽDE", "RIPO TEAM", "ASK ME", "VOTE", "LINK"];

type EditorTool = "media" | "text" | "stickers" | "music" | "design";

export default function CreateStoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const musicCleanup = useRef<(() => void) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState<FluxStory["textStyle"]>("clean");
  const [textPosition, setTextPosition] = useState<FluxStory["textPosition"]>("center");
  const [designId, setDesignId] = useState("none");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>("media");
  const [publishing, setPublishing] = useState(false);

  const design = useMemo(() => DESIGNS.find((item) => item.id === designId) || DESIGNS[0], [designId]);
  const selectedSticker = stickers.find((item) => item.id === selectedStickerId) || null;

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
    musicCleanup.current?.();
  }, [preview]);

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("image/") && !next.type.startsWith("video/")) {
      toast.error("Choose an image or video");
      return;
    }
    if (next.size > 40 * 1024 * 1024) {
      toast.error("Stories must be under 40 MB");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setTool("text");
  };

  const addSticker = (kind: StorySticker["kind"], value: string) => {
    const sticker: StorySticker = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind,
      value,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
    };
    setStickers((items) => [...items, sticker].slice(-20));
    setSelectedStickerId(sticker.id);
  };

  const updateSticker = (patch: Partial<StorySticker>) => {
    if (!selectedStickerId) return;
    setStickers((items) => items.map((item) => item.id === selectedStickerId ? { ...item, ...patch } : item));
  };

  const removeSticker = () => {
    if (!selectedStickerId) return;
    setStickers((items) => items.filter((item) => item.id !== selectedStickerId));
    setSelectedStickerId(null);
  };

  const toggleMusicPreview = (trackId: string) => {
    if (musicPlaying && musicId === trackId) {
      musicCleanup.current?.();
      musicCleanup.current = null;
      setMusicPlaying(false);
      return;
    }
    musicCleanup.current?.();
    setMusicId(trackId);
    musicCleanup.current = startStoryMusic(trackId);
    setMusicPlaying(true);
  };

  const publish = async () => {
    if (!user || !file || publishing) return;
    setPublishing(true);
    try {
      musicCleanup.current?.();
      musicCleanup.current = null;
      setMusicPlaying(false);
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
      router.push("/home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Story failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#08090b]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><h1 className="font-black tracking-tight">Create story</h1><p className="text-[11px] text-white/40">Photo or video · visible for 24 hours</p></div>
          <Button onClick={() => void publish()} disabled={!file || publishing} className="h-10 rounded-full bg-white px-5 font-black text-black hover:bg-white/90">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Share
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 p-3 pb-28 sm:p-5 lg:grid-cols-[72px_minmax(320px,520px)_minmax(320px,1fr)]">
        <nav className="order-2 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[.035] p-2 lg:order-1 lg:flex-col lg:self-start lg:rounded-3xl">
          <ToolButton active={tool === "media"} icon={ImagePlus} label="Media" onClick={() => setTool("media")} />
          <ToolButton active={tool === "text"} icon={Type} label="Text" onClick={() => setTool("text")} />
          <ToolButton active={tool === "stickers"} icon={Sticker} label="Stickers" onClick={() => setTool("stickers")} />
          <ToolButton active={tool === "music"} icon={Music2} label="Music" onClick={() => setTool("music")} />
          <ToolButton active={tool === "design"} icon={Wand2} label="Style" onClick={() => setTool("design")} />
        </nav>

        <section className="order-1 mx-auto w-full max-w-[470px] lg:order-2">
          <div className={cn("relative aspect-[9/16] overflow-hidden rounded-[30px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,.45)]", design.className)} onClick={() => setSelectedStickerId(null)}>
            {preview ? (
              file?.type.startsWith("video/") ? (
                <video src={preview} autoPlay loop muted playsInline className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Story preview" className="h-full w-full object-contain" />
              )
            ) : (
              <button type="button" onClick={() => fileInput.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,#242830_0,transparent_52%)] px-8 text-center text-white/75">
                <span className="grid h-20 w-20 place-items-center rounded-[28px] bg-white/10 shadow-xl"><ImagePlus className="h-8 w-8" /></span>
                <div><span className="block text-xl font-black text-white">Add a photo or video</span><span className="mt-2 block text-xs leading-5 text-white/45">Use your library or open the camera. Maximum 40 MB.</span></div>
              </button>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/25" />

            {text ? (
              <div className={cn("pointer-events-none absolute inset-x-5 z-20 flex", positionClass(textPosition))}>
                <p className={cn("max-w-full whitespace-pre-wrap rounded-2xl bg-black/30 px-4 py-2.5 text-center text-2xl leading-tight shadow-lg backdrop-blur-[3px]", textClass(textStyle))} style={{ color: textColor }}>{text}</p>
              </div>
            ) : null}

            {stickers.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={(event) => { event.stopPropagation(); setSelectedStickerId(item.id); setTool("stickers"); }}
                className={cn("absolute z-30 -translate-x-1/2 -translate-y-1/2 select-none", selectedStickerId === item.id && "rounded-xl ring-2 ring-white ring-offset-2 ring-offset-transparent")}
                style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)` }}
              >
                {item.kind === "emoji" ? <span className="text-5xl drop-shadow-xl">{item.value}</span> : <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-black tracking-wide text-black shadow-xl">{item.value}</span>}
              </button>
            ))}

            {musicId ? (
              <div className="absolute bottom-5 left-4 z-20 flex items-center gap-2 rounded-full bg-black/60 px-3 py-2 text-xs font-bold backdrop-blur-xl"><Music2 className="h-4 w-4" />{STORY_MUSIC.find((item) => item.id === musicId)?.title}</div>
            ) : null}

            {preview ? <div className="absolute right-4 top-4 z-30 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-black backdrop-blur-xl">PREVIEW</div> : null}
          </div>

          <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => pickFile(event.target.files?.[0] || null)} />
          <input ref={cameraInput} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={(event) => pickFile(event.target.files?.[0] || null)} />
        </section>

        <section className="order-3 min-w-0">
          <div className="rounded-[28px] border border-white/10 bg-[#101216] p-4 shadow-2xl sm:p-5">
            {tool === "media" ? (
              <Panel title="Media" description="Choose the main photo or video for this story." icon={ImagePlus}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ActionCard icon={ImagePlus} title="Photo library" description="Choose an image or video already on this device" onClick={() => fileInput.current?.click()} />
                  <ActionCard icon={Camera} title="Open camera" description="Capture a new photo or video on mobile" onClick={() => cameraInput.current?.click()} />
                </div>
                {file ? <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300"><Check className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{file.name}</p><p className="text-[11px] text-white/40">{(file.size / 1024 / 1024).toFixed(1)} MB · {file.type}</p></div><button type="button" onClick={() => fileInput.current?.click()} className="rounded-full bg-white/8 px-3 py-1.5 text-xs font-bold">Change</button></div> : null}
              </Panel>
            ) : null}

            {tool === "text" ? (
              <Panel title="Text" description="Add a message and make it readable over the media." icon={Type}>
                <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 240))} placeholder="Write something…" className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-black/25 p-4 text-base outline-none focus:border-primary" />
                <div className="mt-4 flex flex-wrap gap-2">{TEXT_STYLES.map((style) => <button key={style} type="button" onClick={() => setTextStyle(style)} className={cn("rounded-full border px-4 py-2 text-xs font-bold capitalize", textStyle === style ? "border-white bg-white text-black" : "border-white/10 hover:bg-white/5")}>{style}</button>)}</div>
                <div className="mt-4 flex flex-wrap gap-2">{TEXT_COLORS.map((color) => <button key={color} type="button" onClick={() => setTextColor(color)} className={cn("h-9 w-9 rounded-full border-[3px] transition", textColor === color ? "scale-110 border-white" : "border-transparent")} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">{TEXT_POSITIONS.map((position) => <button key={position} type="button" onClick={() => setTextPosition(position)} className={cn("rounded-2xl border py-3 text-xs font-bold capitalize", textPosition === position ? "border-primary bg-primary/15 text-blue-300" : "border-white/10 hover:bg-white/5")}>{position}</button>)}</div>
              </Panel>
            ) : null}

            {tool === "stickers" ? (
              <Panel title="Stickers" description="Tap a sticker, then position and resize it." icon={Sticker}>
                <p className="mb-2 text-[11px] font-black uppercase tracking-[.14em] text-white/35">Emoji</p>
                <div className="grid grid-cols-8 gap-2 sm:grid-cols-10">{EMOJI_STICKERS.map((emoji) => <button key={emoji} type="button" onClick={() => addSticker("emoji", emoji)} className="grid aspect-square place-items-center rounded-xl bg-white/5 text-2xl transition hover:bg-white/10 active:scale-90">{emoji}</button>)}</div>
                <p className="mb-2 mt-5 text-[11px] font-black uppercase tracking-[.14em] text-white/35">Labels</p>
                <div className="flex flex-wrap gap-2">{LABEL_STICKERS.map((label) => <button key={label} type="button" onClick={() => addSticker("label", label)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-black">{label}</button>)}</div>
                {selectedSticker ? (
                  <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between"><div><p className="text-sm font-black">Selected sticker</p><p className="text-xs text-white/40">Drag with sliders for precise placement</p></div><button type="button" onClick={removeSticker} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/15 text-red-300"><Trash2 className="h-4 w-4" /></button></div>
                    <Range label="Horizontal" min={8} max={92} value={selectedSticker.x} onChange={(value) => updateSticker({ x: value })} />
                    <Range label="Vertical" min={8} max={92} value={selectedSticker.y} onChange={(value) => updateSticker({ y: value })} />
                    <Range label="Size" min={55} max={250} value={Math.round(selectedSticker.scale * 100)} onChange={(value) => updateSticker({ scale: value / 100 })} />
                    <Range label="Rotation" min={-180} max={180} value={selectedSticker.rotation} onChange={(value) => updateSticker({ rotation: value })} />
                    <button type="button" onClick={() => updateSticker({ x: 50, y: 50, scale: 1, rotation: 0 })} className="flex items-center gap-2 text-xs font-bold text-white/55 hover:text-white"><RotateCcw className="h-3.5 w-3.5" />Reset position</button>
                  </div>
                ) : null}
              </Panel>
            ) : null}

            {tool === "music" ? (
              <Panel title="Original music" description="Preview and attach an original Flux loop." icon={Music2}>
                <button type="button" onClick={() => { musicCleanup.current?.(); musicCleanup.current = null; setMusicPlaying(false); setMusicId(null); }} className={cn("flex w-full items-center justify-between rounded-2xl border p-4 text-left", musicId === null ? "border-white bg-white text-black" : "border-white/10 hover:bg-white/5")}><span><strong className="block text-sm">No music</strong><span className={cn("text-xs", musicId === null ? "text-black/50" : "text-white/40")}>Keep original media audio only</span></span>{musicId === null ? <Check className="h-4 w-4" /> : null}</button>
                <div className="mt-3 space-y-2">{STORY_MUSIC.map((track) => {
                  const active = musicId === track.id;
                  const playing = active && musicPlaying;
                  return <button key={track.id} type="button" onClick={() => toggleMusicPreview(track.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition", active ? "border-primary bg-primary/10" : "border-white/10 hover:bg-white/5")}><span className={cn("grid h-11 w-11 place-items-center rounded-full", active ? "bg-primary text-white" : "bg-white/8")}>{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}</span><span className="min-w-0 flex-1"><strong className="block text-sm">{track.title}</strong><span className="text-xs text-white/40">{track.mood} · {track.bpm} BPM</span></span>{active ? <Check className="h-4 w-4 text-blue-300" /> : <ChevronRight className="h-4 w-4 text-white/20" />}</button>})}</div>
                <p className="mt-4 rounded-2xl bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-200">These loops are generated from original note patterns in Flux. No copyrighted song recording is bundled.</p>
              </Panel>
            ) : null}

            {tool === "design" ? (
              <Panel title="Story design" description="Use a subtle backdrop behind transparent or narrow media." icon={Wand2}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{DESIGNS.map((item) => <button key={item.id} type="button" onClick={() => setDesignId(item.id)} className={cn("rounded-2xl border p-2 text-left transition", designId === item.id ? "border-white bg-white/8 ring-2 ring-white/10" : "border-white/10 hover:bg-white/5")}><span className={cn("block aspect-[4/3] rounded-xl", item.className)} /><span className="mt-2 flex items-center justify-between text-xs font-bold">{item.label}{designId === item.id ? <Check className="h-3.5 w-3.5" /> : null}</span></button>)}</div>
              </Panel>
            ) : null}
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[.025] p-4">
            <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Sparkles className="h-5 w-5" /></span><div><p className="text-sm font-black">Story checklist</p><p className="text-xs text-white/40">Media, readable text, and a clean focal point work best.</p></div></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof ImagePlus; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex min-w-[62px] flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-[10px] font-black transition lg:min-w-0", active ? "bg-white text-black" : "text-white/50 hover:bg-white/7 hover:text-white")}><Icon className="h-5 w-5" />{label}</button>;
}

function Panel({ title, description, icon: Icon, children }: { title: string; description: string; icon: typeof Type; children: React.ReactNode }) {
  return <div><div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8"><Icon className="h-5 w-5" /></span><div><h2 className="font-black">{title}</h2><p className="text-xs text-white/40">{description}</p></div></div>{children}</div>;
}

function ActionCard({ icon: Icon, title, description, onClick }: { icon: typeof ImagePlus; title: string; description: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-white/10 p-4 text-left transition hover:border-white/25 hover:bg-white/5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-blue-300"><Icon className="h-5 w-5" /></span><strong className="mt-4 block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-white/40">{description}</span></button>;
}

function Range({ label, min, max, value, onChange }: { label: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1.5 flex justify-between text-[11px] font-bold text-white/45"><span>{label}</span><span>{Math.round(value)}</span></span><input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-white" /></label>;
}

function positionClass(position: FluxStory["textPosition"]): string {
  if (position === "top") return "top-20 justify-center";
  if (position === "bottom") return "bottom-20 justify-center";
  return "top-1/2 -translate-y-1/2 justify-center";
}

function textClass(style: FluxStory["textStyle"]): string {
  if (style === "bold") return "font-black uppercase tracking-tight";
  if (style === "serif") return "font-serif italic";
  if (style === "mono") return "font-mono text-xl";
  return "font-bold";
}
