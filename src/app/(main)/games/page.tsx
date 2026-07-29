"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Gamepad2,
  Globe2,
  Heart,
  Joystick,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Users,
  WandSparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  createFluxPlayGame,
  listFluxPlayGames,
  type FluxPlayGame,
  type FluxPlayMode,
} from "@/services/flux-plays";
import { assetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn, formatCount } from "@/lib/utils";

const FILTERS = ["Discover", "Popular", "Adventure", "Obby", "Social", "My Worlds"] as const;
type Filter = (typeof FILTERS)[number];

export default function GamesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [games, setGames] = useState<FluxPlayGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("Discover");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setGames(await listFluxPlayGames());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const featured = games.find((game) => game.id === "flux-world") || games[0];
  const visibleGames = useMemo(() => {
    let next = games.filter((game) => {
      const term = search.trim().toLowerCase();
      return !term || `${game.title} ${game.description} ${game.tags.join(" ")}`.toLowerCase().includes(term);
    });
    if (filter === "Popular") next = [...next].sort((a, b) => b.plays - a.plays);
    if (filter === "Adventure") next = next.filter((game) => game.mode === "adventure");
    if (filter === "Obby") next = next.filter((game) => game.mode === "obby");
    if (filter === "Social") next = next.filter((game) => game.mode === "hangout" || game.tags.includes("social"));
    if (filter === "My Worlds") next = next.filter((game) => game.creatorUid === profile?.uid);
    return next;
  }, [filter, games, profile?.uid, search]);

  const launch = (gameId: string) => router.push(`/play?gameId=${encodeURIComponent(gameId)}`);

  return (
    <div className="min-h-screen pb-8">
      <header className="sticky top-0 z-30 hidden border-b border-border/70 px-5 py-3 glass-strong lg:block">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-[-0.04em]">Flux Plays</h1>
            <p className="text-xs text-muted-foreground">Play, create and share — all inside Flux.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden w-64 md:block">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games" className="h-10 rounded-full bg-muted/60 pl-10" />
            </div>
            <CreateGameDialog open={createOpen} setOpen={setCreateOpen} onCreated={(id) => { void load(); launch(id); }} />
          </div>
        </div>
      </header>

      <div className="px-3 pt-3 sm:px-5 sm:pt-5">
        <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#071126] shadow-[0_30px_90px_rgba(5,8,22,.28)] sm:rounded-[36px]">
          {featured ? <img src={assetUrl(featured.thumbnailUrl)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" /> : null}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,7,20,.98)_0%,rgba(4,7,20,.78)_42%,rgba(4,7,20,.12)_78%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_26%,rgba(69,140,255,.3),transparent_35%)]" />
          <div className="relative flex min-h-[370px] max-w-2xl flex-col justify-end p-6 sm:min-h-[430px] sm:p-10">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200/90"><span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_18px_#67e8f9]" /> The new Flux gaming universe</div>
              <h2 className="max-w-xl text-4xl font-black leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl">Build it. Play it. <span className="text-gradient-brand">Share it.</span></h2>
              <p className="mt-5 max-w-lg text-sm leading-6 text-white/68 sm:text-base">Shared 3D browser worlds where your Flux identity, friends and creations stay connected on mobile and PC.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button size="lg" variant="flux" className="rounded-full px-6" onClick={() => launch(featured?.id || "flux-world")}><Joystick className="h-5 w-5" /> Play Flux World</Button>
                <CreateGameDialog open={createOpen} setOpen={setCreateOpen} onCreated={(id) => { void load(); launch(id); }} hero />
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-white/55">
                <span className="flex items-center gap-1.5"><Globe2 className="h-4 w-4 text-cyan-300" /> Browser + mobile + PC</span>
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-violet-300" /> Flux account sync</span>
                <span className="flex items-center gap-1.5"><Zap className="h-4 w-4 text-amber-300" /> No separate login</span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Gamepad2} value={formatCount(games.reduce((sum, game) => sum + game.plays, 0))} label="Plays" />
          <StatCard icon={Boxes} value={String(games.length)} label="Worlds" />
          <StatCard icon={Users} value="Live" label="Multiplayer" />
          <StatCard icon={WandSparkles} value="3D" label="Creator tools" />
        </section>

        <section className="mt-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-2xl font-black tracking-[-0.04em]">Explore worlds</h2><p className="mt-1 text-sm text-muted-foreground">Official experiences and games made by the Flux community.</p></div>
            <div className="relative sm:hidden"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Flux Plays" className="h-11 rounded-full bg-muted/60 pl-10" /></div>
          </div>

          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2">
            {FILTERS.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={cn("whitespace-nowrap rounded-full border px-4 py-2 text-xs font-black transition", filter === item ? "border-transparent bg-foreground text-background shadow-lg" : "border-border bg-card text-muted-foreground hover:text-foreground")}>{item}</button>)}
          </div>

          {loading ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-[24px] bg-muted" />)}</div>
          ) : visibleGames.length ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visibleGames.map((game, index) => <GameCard key={game.id} game={game} index={index} onPlay={() => launch(game.id)} />)}</div>
          ) : (
            <div className="mt-5 rounded-[28px] border border-dashed border-border p-12 text-center"><Trophy className="mx-auto h-9 w-9 text-muted-foreground" /><h3 className="mt-3 font-black">No worlds found</h3><p className="mt-1 text-sm text-muted-foreground">Try another category or create the first one.</p></div>
          )}
        </section>
      </div>
    </div>
  );
}

function GameCard({ game, index, onPlay }: { game: FluxPlayGame; index: number; onPlay: () => void }) {
  return (
    <motion.button type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.28) }} whileHover={{ y: -4 }} onClick={onPlay} className="group overflow-hidden rounded-[22px] border border-border/70 bg-card text-left shadow-soft transition hover:border-primary/30 hover:shadow-[0_18px_50px_rgba(76,61,255,.12)] sm:rounded-[26px]">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted"><img src={assetUrl(game.thumbnailUrl)} alt={game.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/62 via-transparent to-transparent" />{game.isOfficial ? <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-lg"><Sparkles className="h-3 w-3 text-cyan-300" /> Official</span> : null}<span className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full bg-white text-black opacity-0 shadow-xl transition group-hover:opacity-100"><ArrowRight className="h-4 w-4" /></span></div>
      <div className="p-3.5 sm:p-4"><h3 className="truncate text-sm font-black sm:text-base">{game.title}</h3><p className="mt-1 truncate text-[11px] font-semibold text-muted-foreground">By {game.creatorName}</p><div className="mt-3 flex items-center gap-3 text-[10px] font-bold text-muted-foreground sm:text-[11px]"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {formatCount(game.plays)}</span><span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {formatCount(game.likes)}</span></div></div>
    </motion.button>
  );
}

function StatCard({ icon: Icon, value, label }: { icon: typeof Gamepad2; value: string; label: string }) {
  return <div className="flex items-center gap-3 rounded-[22px] border border-border/70 bg-card/80 p-3 shadow-soft backdrop-blur-xl sm:p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/18 to-cyan-400/18 text-primary"><Icon className="h-5 w-5" /></span><div><p className="text-sm font-black sm:text-base">{value}</p><p className="text-[10px] font-semibold text-muted-foreground sm:text-xs">{label}</p></div></div>;
}

function CreateGameDialog({ open, setOpen, onCreated, hero = false }: { open: boolean; setOpen: (open: boolean) => void; onCreated: (id: string) => void; hero?: boolean }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<FluxPlayMode>("sandbox");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!profile) return;
    if (title.trim().length < 3) return toast.error("Give your world a name");
    setSaving(true);
    try {
      const id = await createFluxPlayGame(profile, { title, description: description || "A community-made world on Flux Plays.", mode, allowBuild: true });
      setOpen(false);
      setTitle("");
      setDescription("");
      toast.success("World created — launching now");
      onCreated(id);
    } catch {
      toast.error("Could not create the world");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{hero ? <button type="button" className="flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-black text-white backdrop-blur-xl transition hover:bg-white/16"><Plus className="h-4 w-4" /> Create a world</button> : <Button variant="flux" className="rounded-full"><Plus className="h-4 w-4" /> Create</Button>}</DialogTrigger>
      <DialogContent className="overflow-hidden border-border/80 bg-card p-0 sm:max-w-lg sm:rounded-[30px]">
        <div className="border-b border-border/70 bg-[radial-gradient(circle_at_80%_0%,rgba(14,165,233,.18),transparent_38%),radial-gradient(circle_at_10%_20%,rgba(124,58,237,.2),transparent_45%)] p-6"><DialogHeader><DialogTitle className="text-2xl font-black tracking-[-0.04em]">Create a Flux Plays world</DialogTitle></DialogHeader><p className="mt-2 text-sm leading-6 text-muted-foreground">Your Flux account becomes the creator automatically. The world works with keyboard and touch controls.</p></div>
        <div className="space-y-5 p-6">
          <label className="block"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">World name</span><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={48} placeholder="My amazing world" className="mt-2 h-12 rounded-2xl" /></label>
          <label className="block"><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={180} placeholder="What will players do here?" className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-ring" /></label>
          <div><span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Template</span><div className="mt-2 grid grid-cols-2 gap-2">{(["sandbox", "obby", "hangout", "adventure"] as FluxPlayMode[]).map((item) => <button type="button" key={item} onClick={() => setMode(item)} className={cn("rounded-2xl border p-3 text-left transition", mode === item ? "border-primary bg-primary/10" : "border-border hover:bg-muted")}><p className="text-sm font-black capitalize">{item}</p><p className="mt-1 text-[10px] text-muted-foreground">{item === "sandbox" ? "Build freely" : item === "obby" ? "Obstacle course" : item === "hangout" ? "Social space" : "Explore a world"}</p></button>)}</div></div>
          <Button variant="flux" size="lg" className="w-full rounded-full" loading={saving} onClick={create}><WandSparkles className="h-4 w-4" /> Create and launch</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
