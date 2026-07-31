"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  Gift,
  Heart,
  Inbox,
  Loader2,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  ANIMATED_GIFTS,
  claimAnimatedGift,
  getReceivedAnimatedGifts,
  sendAnimatedGift,
  type AnimatedGiftDefinition,
  type FluxGift,
  type GiftContextType,
} from "@/services/gift-experience";
import { searchUsers } from "@/services/users";
import { GiftVisual } from "@/components/gifts/gift-visual";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatCount } from "@/lib/utils";
import type { UserProfile } from "@/types";

type GiftTab = "send" | "received";

export default function GiftsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [tab, setTab] = useState<GiftTab>("send");
  const [selectedGift, setSelectedGift] = useState<AnimatedGiftDefinition>(ANIMATED_GIFTS[0]);
  const [recipient, setRecipient] = useState<UserProfile | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [received, setReceived] = useState<FluxGift[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [context, setContext] = useState<{ type: GiftContextType; id: string | null }>({ type: "user", id: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const toUser = params.get("toUser");
    const type = params.get("type") as GiftContextType | null;
    const id = params.get("id");
    if (type && ["user", "post", "story", "live"].includes(type)) setContext({ type, id });
    if (toUser && user && toUser !== user.uid) {
      searchUsers(toUser, 20).then((items) => {
        const exact = items.find((item) => item.uid === toUser || item.username === toUser);
        if (exact) setRecipient(exact);
      }).catch(() => undefined);
    }
  }, [user]);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2 || !user) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchUsers(needle, 12)
        .then((items) => setResults(items.filter((item) => item.uid !== user.uid)))
        .catch(() => setResults([]));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, user]);

  const loadInbox = async () => {
    if (!user) return;
    setLoadingInbox(true);
    try {
      setReceived(await getReceivedAnimatedGifts(user.uid));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load gifts");
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (tab === "received") void loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  const sendGift = async () => {
    if (!user || !recipient) return;
    setSending(true);
    try {
      await sendAnimatedGift({
        fromId: user.uid,
        toId: recipient.uid,
        giftId: selectedGift.id,
        message,
        contextType: context.type,
        contextId: context.id,
      });
      setPreviewKey((value) => value + 1);
      setMessage("");
      await refreshProfile();
      toast.success(`${selectedGift.name} sent to ${recipient.displayName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send gift");
    } finally {
      setSending(false);
    }
  };

  const claim = async (gift: FluxGift) => {
    if (!user) return;
    setClaiming(gift.id);
    try {
      const value = await claimAnimatedGift(gift.id, user.uid);
      await refreshProfile();
      await loadInbox();
      toast.success(`${value.toLocaleString()} Flux Coins claimed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not claim gift");
    } finally {
      setClaiming(null);
    }
  };

  const enoughCoins = Number(profile?.coins || 0) >= selectedGift.price;
  const unclaimed = useMemo(() => received.filter((gift) => !gift.claimed).length, [received]);

  return (
    <main className="min-h-screen bg-[#f4f5f7] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <header className="border-b border-black/6 bg-[#090a0d] px-4 py-10 text-white dark:border-white/10 sm:py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-black"><Gift className="h-5 w-5" /></span><h1 className="mt-6 text-4xl font-black leading-[.94] tracking-[-.06em] sm:text-6xl">Animated Flux gifts.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/52 sm:text-base">Each gift is a hand-built animated SVG scene—not an emoji enlarged on screen. Send one to a person or attach it to a post, Story or Live.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-[9px] font-black uppercase tracking-[.14em] text-white/35">Balance</p><p className="mt-2 flex items-center gap-2 text-3xl font-black"><Coins className="h-6 w-6 text-amber-300" />{formatCount(profile?.coins || 0)}</p><Link href="/shop" className="mt-3 flex items-center gap-2 text-xs font-black text-violet-300"><ShoppingBag className="h-4 w-4" />Open shop</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-5 sm:py-9">
        <nav className="mb-5 flex gap-2"><TabButton active={tab === "send"} icon={Send} label="Send" onClick={() => setTab("send")} /><TabButton active={tab === "received"} icon={Inbox} label={`Inbox${unclaimed ? ` (${unclaimed})` : ""}`} onClick={() => setTab("received")} /></nav>

        {tab === "send" ? <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="space-y-5">
            <div className="rounded-[26px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114] sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Choose a scene</h2><p className="text-xs text-muted-foreground">Eight custom vector animations</p></div></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{ANIMATED_GIFTS.map((gift) => <button key={gift.id} type="button" onClick={() => { setSelectedGift(gift); setPreviewKey((value) => value + 1); }} className={cn("overflow-hidden rounded-2xl border p-3 text-left transition", selectedGift.id === gift.id ? "border-violet-500 bg-violet-500/8" : "border-border hover:bg-muted/50")}><GiftVisual gift={gift} compact className="mx-auto" /><span className="mt-3 block truncate text-sm font-black">{gift.name}</span><span className="mt-1 flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-300"><Coins className="h-3 w-3" />{gift.price.toLocaleString()}</span><span className="mt-2 block text-[8px] font-black uppercase tracking-wider text-muted-foreground">{gift.rarity}</span></button>)}</div></div>

            <div className="rounded-[26px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114] sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><UserRound className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Recipient</h2><p className="text-xs text-muted-foreground">Search a Flux account</p></div></div>{recipient ? <div className="mt-5 flex items-center gap-3 rounded-2xl border border-violet-500/25 bg-violet-500/6 p-3"><UserAvatar user={recipient} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{recipient.displayName}</p><p className="truncate text-xs text-muted-foreground">@{recipient.username}</p></div><button type="button" onClick={() => setRecipient(null)} className="rounded-full border border-border px-3 py-1.5 text-[10px] font-black">Change</button></div> : <div className="relative mt-5"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" className="h-12 rounded-2xl pl-10" /></div>}{!recipient && results.length ? <div className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border p-2">{results.map((item) => <button key={item.uid} type="button" onClick={() => { setRecipient(item); setResults([]); setQuery(""); }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"><UserAvatar user={item} size="sm" clickable={false} /><div className="min-w-0"><p className="truncate text-sm font-black">{item.displayName}</p><p className="truncate text-[10px] text-muted-foreground">@{item.username}</p></div></button>)}</div> : null}<label className="mt-5 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">Message<textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 180))} placeholder="Add a short message" className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-input bg-background p-3 text-sm normal-case tracking-normal outline-none" /></label></div>
          </section>

          <aside className="lg:sticky lg:top-5 lg:self-start"><div className="overflow-hidden rounded-[28px] border border-black/7 bg-white shadow-xl dark:border-white/10 dark:bg-[#101114]"><div className="relative grid min-h-[390px] place-items-center overflow-hidden bg-[#07080b]"><GiftVisual key={previewKey} gift={selectedGift} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-5 pt-24 text-white"><p className="text-[9px] font-black uppercase tracking-wider text-white/40">Live preview</p><h2 className="mt-2 text-2xl font-black">{selectedGift.name}</h2><p className="mt-2 text-sm leading-6 text-white/55">{selectedGift.description}</p></div></div><div className="p-5"><div className="grid grid-cols-2 gap-2"><Summary label="Cost" value={`${selectedGift.price.toLocaleString()} coins`} /><Summary label="Creator receives" value={`${selectedGift.creatorValue.toLocaleString()} coins`} /></div>{context.type !== "user" ? <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground">Attached to {context.type}{context.id ? ` · ${context.id.slice(0, 18)}` : ""}</p> : null}<Button onClick={() => void sendGift()} disabled={!recipient || sending || !enoughCoins} className="mt-4 h-12 w-full rounded-full bg-violet-600 font-black text-white hover:bg-violet-500">{sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}{!enoughCoins ? "Not enough coins" : recipient ? `Send to ${recipient.displayName}` : "Choose recipient"}</Button></div></div></aside>
        </div> : <section className="rounded-[26px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114] sm:p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><Inbox className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Gift inbox</h2><p className="text-xs text-muted-foreground">Claim creator value once</p></div><Button variant="outline" onClick={() => void loadInbox()} className="ml-auto rounded-full"><Loader2 className={cn("h-4 w-4", loadingInbox && "animate-spin")} />Refresh</Button></div>{loadingInbox ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : received.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{received.map((gift) => <article key={gift.id} className="rounded-2xl border border-border p-4"><div className="flex items-center gap-3">{gift.definition ? <GiftVisual gift={gift.definition} compact /> : <span className="grid h-16 w-16 place-items-center rounded-2xl bg-muted"><Gift className="h-6 w-6" /></span>}<div className="min-w-0 flex-1"><h3 className="truncate font-black">{gift.definition?.name || "Flux Gift"}</h3><p className="truncate text-[10px] text-muted-foreground">From {gift.sender?.displayName || "Flux user"}</p></div>{gift.claimed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : null}</div>{gift.message ? <p className="mt-4 rounded-2xl bg-muted/60 p-3 text-sm leading-6">“{gift.message}”</p> : null}<div className="mt-4 flex items-center justify-between"><span className="flex items-center gap-1 text-sm font-black text-amber-600 dark:text-amber-300"><Coins className="h-4 w-4" />{gift.creatorValue.toLocaleString()}</span><Button onClick={() => void claim(gift)} disabled={gift.claimed || claiming !== null} size="sm" className="rounded-full font-black">{claiming === gift.id ? <Loader2 className="h-4 w-4 animate-spin" /> : gift.claimed ? <CheckCircle2 className="h-4 w-4" /> : <Heart className="h-4 w-4" />}{gift.claimed ? "Claimed" : "Claim"}</Button></div></article>)}</div> : <div className="grid min-h-72 place-items-center text-center"><div><Gift className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-4 text-xl font-black">No gifts yet</h3><p className="mt-2 text-sm text-muted-foreground">Gifts sent to you will appear here.</p></div></div>}</section>}
      </div>
    </main>
  );
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex h-11 items-center gap-2 rounded-full px-5 text-sm font-black", active ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground")}><Icon className="h-4 w-4" />{label}</button>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-muted/60 p-3"><p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>;
}
