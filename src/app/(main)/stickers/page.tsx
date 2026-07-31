"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Film,
  ImagePlus,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Sticker,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { activePlan } from "@/services/flux-platform";
import {
  createCustomSticker,
  deleteCustomSticker,
  listCustomStickers,
  type CustomSticker,
  type StickerAudience,
  type StickerSurface,
} from "@/services/custom-stickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SURFACES: Array<{ id: StickerSurface; label: string }> = [
  { id: "posts", label: "Posts" },
  { id: "stories", label: "Stories" },
  { id: "chats", label: "Chats" },
];

export default function StickersPage() {
  const { user, profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [stickers, setStickers] = useState<CustomSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audience, setAudience] = useState<StickerAudience>("everyone");
  const [surfaces, setSurfaces] = useState<StickerSurface[]>(["posts", "stories", "chats"]);
  const plan = activePlan(profile);
  const canCreate = plan === "basic" || plan === "premium";

  const load = async () => {
    setLoading(true);
    try {
      setStickers(await listCustomStickers({ viewerId: user?.uid }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load stickers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.uid]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stickers.filter((item) => !needle || [item.name, ...item.tags].join(" ").toLowerCase().includes(needle));
  }, [query, stickers]);

  const chooseFile = (next: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const create = async () => {
    if (!user || !file || !name.trim()) return;
    setCreating(true);
    try {
      await createCustomSticker({
        ownerId: user.uid,
        name,
        file,
        audience,
        surfaces,
        tags: tags.split(/[,\s]+/).filter(Boolean),
      });
      setName("");
      setTags("");
      chooseFile(null);
      setAudience("everyone");
      setSurfaces(["posts", "stories", "chats"]);
      await load();
      toast.success("Sticker published to Flux");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish sticker");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (sticker: CustomSticker) => {
    if (!user) return;
    try {
      await deleteCustomSticker(user.uid, sticker.id);
      await load();
      toast.success("Sticker removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove sticker");
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <header className="border-b border-black/6 bg-[#101216] px-4 py-11 text-white dark:border-white/10 sm:py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="grid h-13 w-13 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500"><Sticker className="h-6 w-6" /></span>
            <h1 className="mt-6 text-4xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl">Flux Sticker Lab</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Basic and Premium creators can publish PNG, WebP, and animated GIF stickers. Everyone can discover public stickers and use them on supported Flux surfaces.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/6 p-5">
            <p className="text-[10px] font-black uppercase tracking-[.14em] text-white/35">Your creator access</p>
            <p className="mt-2 flex items-center gap-2 text-2xl font-black capitalize"><Sparkles className="h-5 w-5 text-violet-300" />{plan}</p>
            <p className="mt-2 text-xs text-white/40">{plan === "premium" ? "Up to 100 stickers" : plan === "basic" ? "Up to 25 stickers" : "Upgrade to create stickers"}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-3 py-6 sm:px-5 sm:py-9 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-[28px] border border-black/7 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#101114]">
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><ImagePlus className="h-5 w-5" /></span><div><h2 className="font-black">Create sticker</h2><p className="text-[10px] text-muted-foreground">5 MB maximum</p></div></div>
            {!canCreate ? <div className="mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200"><Lock className="mb-2 h-5 w-5" />Flux Basic or Premium is required to publish stickers.</div> : null}
            <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!canCreate} className="mt-5 grid aspect-square w-full place-items-center overflow-hidden rounded-[24px] border border-dashed border-border bg-muted/35 disabled:opacity-45">
              {preview ? <img src={preview} alt="Sticker preview" className="h-full w-full object-contain p-6" /> : <div className="text-center"><Upload className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-black">Upload image or GIF</p><p className="mt-1 text-[10px] text-muted-foreground">Transparent PNG works best</p></div>}
            </button>
            <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">Name<Input value={name} onChange={(event) => setName(event.target.value.slice(0, 48))} placeholder="Victory Pop" className="mt-2 h-11 rounded-xl normal-case tracking-normal" /></label>
            <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">Tags<Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="gaming, win, funny" className="mt-2 h-11 rounded-xl normal-case tracking-normal" /></label>
            <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">Who can use it<select value={audience} onChange={(event) => setAudience(event.target.value as StickerAudience)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold normal-case tracking-normal"><option value="everyone">Everyone</option><option value="followers">Followers only</option><option value="only-me">Only me</option></select></label>
            <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Allowed surfaces</p><div className="mt-2 flex flex-wrap gap-2">{SURFACES.map((surface) => <button key={surface.id} type="button" onClick={() => setSurfaces((items) => items.includes(surface.id) ? items.filter((item) => item !== surface.id) : [...items, surface.id])} className={cn("rounded-full px-3 py-2 text-[10px] font-black", surfaces.includes(surface.id) ? "bg-foreground text-background" : "border border-border text-muted-foreground")}>{surfaces.includes(surface.id) ? <Check className="mr-1 inline h-3 w-3" /> : null}{surface.label}</button>)}</div></div>
            <Button onClick={() => void create()} disabled={!canCreate || !file || !name.trim() || creating} className="mt-5 h-12 w-full rounded-full font-black">{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sticker className="h-4 w-4" />}Publish sticker</Button>
          </div>
        </aside>

        <section className="rounded-[28px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><h2 className="text-2xl font-black tracking-tight">Sticker library</h2><p className="mt-1 text-xs text-muted-foreground">Public creator stickers available across Flux</p></div><div className="relative sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stickers" className="h-11 rounded-full pl-10" /></div></div>
          {loading ? <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : filtered.length ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{filtered.map((sticker) => <article key={sticker.id} className="group overflow-hidden rounded-[22px] border border-border bg-muted/25"><div className="relative grid aspect-square place-items-center bg-[radial-gradient(circle_at_center,rgba(139,92,246,.16),transparent_65%)] p-5"><img src={sticker.imageUrl} alt={sticker.name} className="max-h-full max-w-full object-contain drop-shadow-lg" />{sticker.animated ? <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[8px] font-black text-white"><Film className="h-3 w-3" />Animated</span> : null}{sticker.ownerId === user?.uid ? <button type="button" onClick={() => void remove(sticker)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-red-500 text-white opacity-0 transition group-hover:opacity-100" aria-label="Delete sticker"><Trash2 className="h-3.5 w-3.5" /></button> : null}</div><div className="p-3"><h3 className="truncate text-sm font-black">{sticker.name}</h3><p className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground">{sticker.audience === "everyone" ? <Users className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}{sticker.audience} · {sticker.surfaces.length} surfaces</p><button type="button" onClick={async () => { await navigator.clipboard.writeText(sticker.imageUrl); toast.success("Sticker link copied"); }} className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-border text-[10px] font-black hover:bg-muted"><Copy className="h-3.5 w-3.5" />Copy sticker</button></div></article>)}</div> : <div className="grid min-h-[420px] place-items-center text-center"><div><Sticker className="mx-auto h-9 w-9 text-muted-foreground" /><h3 className="mt-4 text-xl font-black">No stickers found</h3><p className="mt-2 text-sm text-muted-foreground">Create the first sticker for this search.</p></div></div>}
        </section>
      </div>
    </main>
  );
}
