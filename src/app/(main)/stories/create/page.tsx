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
import {
  createStory,
  type FluxStory,
  type StorySticker,
} from "@/services/stories";
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

const TEXT_COLORS = [
  "#ffffff",
  "#111111",
  "#ffe066",
  "#ff7aa2",
  "#7dd3fc",
  "#86efac",
  "#c4b5fd",
  "#fb923c",
];
const TEXT_STYLES: FluxStory["textStyle"][] = ["clean", "bold", "serif", "mono"];
const TEXT_POSITIONS: FluxStory["textPosition"][] = ["top", "center", "bottom"];
const EMOJIS = ["✨", "🔥", "❤️", "😂", "🎮", "⚽", "🎉", "🌙", "💯", "🚀", "👀", "⭐"];

type EditorTab = "media" | "text" | "design" | "stickers" | "music";

export default function CreateStoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const musicStopRef = useRef<(() => void) | null>(null);

  const [tab, setTab] = useState<EditorTab>("media");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState<FluxStory["textStyle"]>("clean");
  const [textPosition, setTextPosition] = useState<FluxStory["textPosition"]>("center");
  const [designId, setDesignId] = useState("ocean");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [labelSticker, setLabelSticker] = useState("");
  const [publishing, setPublishing] = useState(false);

  const design = useMemo(
    () => DESIGNS.find((item) => item.id === designId) || DESIGNS[0],
    [designId]
  );
  const canPublish = Boolean(file || text.trim() || stickers.length);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      musicStopRef.current?.();
    };
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
    if (designId === "ocean") setDesignId("none");
  };

  const removeMedia = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (designId === "none") setDesignId("ocean");
  };

  const toggleMusicPreview = (trackId: string) => {
    musicStopRef.current?.();
    musicStopRef.current = null;
    if (musicPlaying === trackId) {
      setMusicPlaying(null);
      return;
    }
    musicStopRef.current = startStoryMusic(trackId);
    setMusicPlaying(trackId);
  };

  const addEmoji = (value: string) => {
    setStickers((items) => [
      ...items,
      {
        id: `${Date.now()}-${Math.random()}`,
        kind: "emoji",
        value,
        x: 50,
        y: 46 + ((items.length * 9) % 32),
        scale: 1,
        rotation: items.length % 2 ? 8 : -6,
      },
    ].slice(-20));
  };

  const addLabel = () => {
    const value = labelSticker.trim().slice(0, 40);
    if (!value) return;
    setStickers((items) => [
      ...items,
      {
        id: `${Date.now()}-${Math.random()}`,
        kind: "label",
        value,
        x: 50,
        y: 72,
        scale: 1,
        rotation: 0,
      },
    ].slice(-20));
    setLabelSticker("");
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
      musicStopRef.current?.();
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
    <main className="min-h-screen bg-[#07080a] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090a0c]/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <button type="button" onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-black tracking-tight">Create Story</h1>
            <p className="truncate text-[11px] text-white/45">Photo, video, or text-only · disappears after 24 hours</p>
          </div>
          <Button onClick={() => void publish()} disabled={!canPublish || publishing} className="h-11 rounded-full bg-white px-5 font-black text-black hover:bg-white/90">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Share
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 p-3 pb-24 sm:p-5 lg:grid-cols-[minmax(320px,460px)_minmax(0,1fr)]">
        <section className="lg:sticky lg:top-20 lg:self-start">
          <div className={cn("relative mx-auto aspect-[9/16] w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,.48)]", design.className)}>
            {preview ? (
              file?.type.startsWith("video/") ? (
                <video src={preview} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Story preview" className="absolute inset-0 h-full w-full object-contain" />
              )
            ) : (
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-black/20 blur-3xl" />
              </div>
            )}

            {!preview && !text && !stickers.length ? (
              <button type="button" onClick={() => fileInput.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center text-white/80">
                <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-white/12 backdrop-blur-xl"><Camera className="h-7 w-7" /></span>
                <div><p className="font-black">Start with media or text</p><p className="mt-1 text-xs leading-5 text-white/55">You can publish a design Story without uploading anything.</p></div>
              </button>
            ) : null}

            {text ? (
              <div className={cn("pointer-events-none absolute inset-x-5 z-20 flex", positionClass(textPosition))}>
                <p className={cn("mx-auto max-w-full whitespace-pre-wrap rounded-2xl bg-black/28 px-4 py-2.5 text-center text-2xl leading-tight shadow-xl backdrop-blur-[3px]", textClass(textStyle))} style={{ color: textColor }}>
                  {text}
                </p>
              </div>
            ) : null}

            {stickers.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStickers((items) => items.filter((sticker) => sticker.id !== item.id))}
                className="absolute z-30 -translate-x-1/2 -translate-y-1/2 select-none"
                style={{ left: `${item.x}%`, top: `${item.y}%`, transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)` }}
                title="Tap to remove"
              >
                {item.kind === "emoji" ? <span className="text-5xl drop-shadow-xl">{item.value}</span> : <span className="rounded-xl bg-white px-3 py-1.5 text-sm font-black tracking-wide text-black shadow-xl">{item.value}</span>}
              </button>
            ))}

            {musicId ? (
              <div className="absolute bottom-5 left-4 z-30 flex items-center gap-2 rounded-full bg-black/58 px-3 py-2 text-xs font-black backdrop-blur-xl">
                <Music2 className="h-4 w-4" />{STORY_MUSIC.find((item) => item.id === musicId)?.title}
              </div>
            ) : null}

            <div className="absolute right-3 top-3 z-30 flex gap-2">
              {preview ? <button type="button" onClick={removeMedia} className="grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur-xl" aria-label="Remove media"><Trash2 className="h-4 w-4" /></button> : null}
              <button type="button" onClick={() => { setText(""); setStickers([]); setMusicId(null); setDesignId(file ? "none" : "ocean"); }} className="grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur-xl" aria-label="Reset Story"><RotateCcw className="h-4 w-4" /></button>
            </div>
          </div>
          <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => pickFile(event.target.files?.[0] || null)} />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#101114]">
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 p-2 no-scrollbar">
            <EditorTabButton active={tab === "media"} icon={ImagePlus} label="Media" onClick={() => setTab("media")} />
            <EditorTabButton active={tab === "text"} icon={Type} label="Text" onClick={() => setTab("text")} />
            <EditorTabButton active={tab === "design"} icon={Wand2} label="Design" onClick={() => setTab("design")} />
            <EditorTabButton active={tab === "stickers"} icon={Sticker} label="Stickers" onClick={() => setTab("stickers")} />
            <EditorTabButton active={tab === "music"} icon={Music2} label="Music" onClick={() => setTab("music")} />
          </div>

          <div className="min-h-[420px] p-4 sm:p-6">
            {tab === "media" ? (
              <Panel title="Photo or video" description="Upload media, or skip this and make a text-only Story.">
                <button type="button" onClick={() => fileInput.current?.click()} className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed border-white/15 bg-white/[.025] text-center transition hover:bg-white/[.05]">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/8"><ImagePlus className="h-6 w-6" /></span>
                  <div><p className="text-sm font-black">{file ? "Change media" : "Choose media"}</p><p className="mt-1 text-xs text-white/40">Images or videos up to 40 MB</p></div>
                </button>
                {file ? <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 p-3"><div className="min-w-0"><p className="truncate text-sm font-black">{file.name}</p><p className="text-xs text-white/40">{Math.max(.1, file.size / 1024 / 1024).toFixed(1)} MB</p></div><Check className="h-5 w-5 text-emerald-400" /></div> : null}
              </Panel>
            ) : null}

            {tab === "text" ? (
              <Panel title="Story text" description="Use text by itself or layer it over your media.">
                <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 240))} placeholder="Write something…" className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 p-4 text-base outline-none focus:border-primary" />
                <p className="mt-2 text-right text-[10px] font-bold text-white/35">{text.length}/240</p>
                <div className="mt-4 flex flex-wrap gap-2">{TEXT_STYLES.map((style) => <button key={style} type="button" onClick={() => setTextStyle(style)} className={cn("rounded-full px-3 py-2 text-xs font-black capitalize", textStyle === style ? "bg-white text-black" : "bg-white/7 text-white/55")}>{style}</button>)}</div>
                <div className="mt-4 flex flex-wrap gap-2">{TEXT_COLORS.map((color) => <button key={color} type="button" onClick={() => setTextColor(color)} className={cn("h-9 w-9 rounded-full border-2", textColor === color ? "border-white" : "border-transparent")} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />)}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">{TEXT_POSITIONS.map((position) => <button key={position} type="button" onClick={() => setTextPosition(position)} className={cn("rounded-2xl py-3 text-xs font-black capitalize", textPosition === position ? "bg-primary text-white" : "bg-white/6 text-white/55")}>{position}</button>)}</div>
              </Panel>
            ) : null}

            {tab === "design" ? (
              <Panel title="Background design" description="Designs stay behind your photo, video, text, and stickers.">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{DESIGNS.map((item) => <button key={item.id} type="button" onClick={() => setDesignId(item.id)} className={cn("rounded-[20px] border p-2 text-left transition", designId === item.id ? "border-white bg-white/8" : "border-white/8 hover:bg-white/5")}><span className={cn("block aspect-[4/3] rounded-2xl", item.className)} /><span className="mt-2 block px-1 text-xs font-black">{item.label}</span></button>)}</div>
              </Panel>
            ) : null}

            {tab === "stickers" ? (
              <Panel title="Stickers" description="Tap a sticker in the preview to remove it.">
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => addEmoji(emoji)} className="grid aspect-square place-items-center rounded-2xl bg-white/6 text-2xl transition hover:scale-105 hover:bg-white/10">{emoji}</button>)}</div>
                <div className="mt-5 flex gap-2"><input value={labelSticker} onChange={(event) => setLabelSticker(event.target.value.slice(0, 40))} onKeyDown={(event) => { if (event.key === "Enter") addLabel(); }} placeholder="Custom label sticker" className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-primary" /><Button type="button" onClick={addLabel} disabled={!labelSticker.trim()} className="h-12 rounded-2xl px-5">Add</Button></div>
                {stickers.length ? <button type="button" onClick={() => setStickers([])} className="mt-4 flex items-center gap-2 text-xs font-black text-red-300"><Trash2 className="h-4 w-4" />Remove all stickers</button> : null}
              </Panel>
            ) : null}

            {tab === "music" ? (
              <Panel title="Original Story music" description="These loops are generated by Flux and do not bundle copyrighted recordings.">
                <button type="button" onClick={() => { setMusicId(null); musicStopRef.current?.(); setMusicPlaying(null); }} className={cn("mb-3 flex w-full items-center justify-between rounded-2xl border p-4 text-left", musicId === null ? "border-white bg-white/8" : "border-white/8")}><span className="font-black">No music</span>{musicId === null ? <Check className="h-4 w-4" /> : null}</button>
                <div className="space-y-2">{STORY_MUSIC.map((track) => <div key={track.id} className={cn("flex items-center gap-3 rounded-2xl border p-3", musicId === track.id ? "border-primary bg-primary/8" : "border-white/8")}><button type="button" onClick={() => toggleMusicPreview(track.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10" aria-label={`Preview ${track.title}`}>{musicPlaying === track.id ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}</button><button type="button" onClick={() => setMusicId(track.id)} className="min-w-0 flex-1 text-left"><strong className="block truncate text-sm">{track.title}</strong><span className="text-xs text-white/40">{track.mood} · {track.bpm} BPM</span></button>{musicId === track.id ? <Check className="h-5 w-5 text-primary" /> : null}</div>)}</div>
              </Panel>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function EditorTabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Sparkles; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-black transition", active ? "bg-white text-black" : "text-white/45 hover:bg-white/6 hover:text-white")}><Icon className="h-4 w-4" />{label}</button>;
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section><div className="mb-5"><h2 className="text-xl font-black tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-white/42">{description}</p></div>{children}</section>;
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
