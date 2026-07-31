"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Loader2, Music2, Type, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createStory, type FluxStory } from "@/services/stories";
import { STORY_MUSIC } from "@/lib/story-music";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const DESIGNS = [
  { id: "none", label: "Original", className: "bg-black" },
  { id: "sunset", label: "Sunset", className: "bg-gradient-to-br from-orange-500 via-rose-500 to-violet-700" },
  { id: "ocean", label: "Ocean", className: "bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-900" },
  { id: "night", label: "Night", className: "bg-gradient-to-br from-slate-900 via-violet-950 to-black" },
  { id: "mint", label: "Mint", className: "bg-gradient-to-br from-emerald-300 via-teal-600 to-cyan-950" },
];

const TEXT_COLORS = ["#ffffff", "#111111", "#ffe066", "#ff7aa2", "#7dd3fc", "#86efac"];
const TEXT_STYLES: FluxStory["textStyle"][] = ["clean", "bold", "serif", "mono"];
const TEXT_POSITIONS: FluxStory["textPosition"][] = ["top", "center", "bottom"];

export default function CreateStoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textStyle, setTextStyle] = useState<FluxStory["textStyle"]>("clean");
  const [textPosition, setTextPosition] = useState<FluxStory["textPosition"]>("center");
  const [designId, setDesignId] = useState("none");
  const [musicId, setMusicId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const design = useMemo(() => DESIGNS.find((item) => item.id === designId) || DESIGNS[0], [designId]);

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
  };

  const publish = async () => {
    if (!user || !file || publishing) return;
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
    <div className="min-h-screen bg-[#0b0d10] text-white">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-[#0b0d10]/95 px-3 backdrop-blur-xl">
        <button type="button" onClick={() => router.back()} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-bold">Create story</h1>
        <Button onClick={publish} disabled={!file || publishing} className="rounded-full px-5">
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Share
        </Button>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-3 pb-24 lg:grid-cols-[minmax(320px,480px)_1fr] lg:p-6">
        <section className="mx-auto w-full max-w-[430px]">
          <div className={cn("relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 shadow-2xl", design.className)}>
            {preview ? (
              file?.type.startsWith("video/") ? (
                <video src={preview} autoPlay loop muted playsInline className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Story preview" className="h-full w-full object-contain" />
              )
            ) : (
              <button type="button" onClick={() => fileInput.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/75 hover:bg-white/5">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-white/10"><ImagePlus className="h-7 w-7" /></span>
                <span className="font-bold">Choose a photo or video</span>
                <span className="text-xs text-white/50">Maximum 40 MB</span>
              </button>
            )}

            {text ? (
              <div className={cn("pointer-events-none absolute inset-x-5 flex", positionClass(textPosition))}>
                <p className={cn("max-w-full whitespace-pre-wrap rounded-xl bg-black/25 px-4 py-2 text-center text-2xl leading-tight shadow-lg backdrop-blur-[2px]", textClass(textStyle))} style={{ color: textColor }}>
                  {text}
                </p>
              </div>
            ) : null}

            {musicId ? (
              <div className="absolute bottom-5 left-4 flex items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-xs font-semibold backdrop-blur-md">
                <Music2 className="h-4 w-4" />
                {STORY_MUSIC.find((item) => item.id === musicId)?.title}
              </div>
            ) : null}
          </div>
          <input ref={fileInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => pickFile(event.target.files?.[0] || null)} />
          {preview ? (
            <button type="button" onClick={() => fileInput.current?.click()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm font-bold hover:bg-white/5">
              <ImagePlus className="h-4 w-4" /> Change media
            </button>
          ) : null}
        </section>

        <section className="space-y-4">
          <EditorPanel icon={Type} title="Text">
            <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 240))} placeholder="Write something…" className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none focus:border-primary" />
            <div className="mt-3 flex flex-wrap gap-2">
              {TEXT_STYLES.map((style) => (
                <button key={style} type="button" onClick={() => setTextStyle(style)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold capitalize", textStyle === style ? "border-primary bg-primary text-white" : "border-white/15 hover:bg-white/5")}>{style}</button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {TEXT_COLORS.map((color) => (
                <button key={color} type="button" onClick={() => setTextColor(color)} className={cn("h-8 w-8 rounded-full border-2", textColor === color ? "border-white" : "border-transparent")} style={{ backgroundColor: color }} aria-label={`Use ${color}`} />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {TEXT_POSITIONS.map((position) => (
                <button key={position} type="button" onClick={() => setTextPosition(position)} className={cn("rounded-xl border py-2 text-xs font-semibold capitalize", textPosition === position ? "border-primary bg-primary/20 text-primary" : "border-white/15 hover:bg-white/5")}>{position}</button>
              ))}
            </div>
          </EditorPanel>

          <EditorPanel icon={Wand2} title="Design">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DESIGNS.map((item) => (
                <button key={item.id} type="button" onClick={() => setDesignId(item.id)} className={cn("rounded-xl border p-2 text-left", designId === item.id ? "border-primary" : "border-white/10")}>
                  <span className={cn("block h-16 rounded-lg", item.className)} />
                  <span className="mt-2 block text-xs font-semibold">{item.label}</span>
                </button>
              ))}
            </div>
          </EditorPanel>

          <EditorPanel icon={Music2} title="Original music">
            <p className="mb-3 text-xs text-white/55">These are original browser-generated loops, not copyrighted recordings.</p>
            <div className="space-y-2">
              <button type="button" onClick={() => setMusicId(null)} className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left", musicId === null ? "border-primary bg-primary/10" : "border-white/10 hover:bg-white/5")}><span className="font-semibold">No music</span></button>
              {STORY_MUSIC.map((track) => (
                <button key={track.id} type="button" onClick={() => setMusicId(track.id)} className={cn("flex w-full items-center justify-between rounded-xl border p-3 text-left", musicId === track.id ? "border-primary bg-primary/10" : "border-white/10 hover:bg-white/5")}>
                  <span><strong className="block text-sm">{track.title}</strong><span className="text-xs text-white/55">{track.mood} · {track.bpm} BPM</span></span>
                  <Music2 className="h-4 w-4" />
                </button>
              ))}
            </div>
          </EditorPanel>
        </section>
      </div>
    </div>
  );
}

function EditorPanel({ icon: Icon, title, children }: { icon: typeof Type; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <h2 className="mb-3 flex items-center gap-2 font-bold"><Icon className="h-4 w-4" />{title}</h2>
      {children}
    </div>
  );
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
