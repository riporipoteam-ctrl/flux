"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Coins,
  Flame,
  Gift,
  Loader2,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  claimChallenge,
  claimDailyCheckIn,
  equipItem,
  getCheckInStatus,
  getDailyChallenges,
  getOwnedItemIds,
  getShopItems,
  giftItem,
  purchaseItem,
  unequipItem,
  weekKey,
} from "@/services/shop";
import type { ShopItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchUsers } from "@/services/users";
import type { UserProfile } from "@/types";
import { formatCount } from "@/lib/utils";
import { MobileHeader } from "@/components/layout/mobile-header";

const FILTERS = [
  "all",
  "badge",
  "frame",
  "banner",
  "theme",
  "effect",
  "group_deco",
] as const;

export default function ShopPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [challenges, setChallenges] = useState<Awaited<
    ReturnType<typeof getDailyChallenges>
  > | null>(null);
  const [checkIn, setCheckIn] = useState<Awaited<
    ReturnType<typeof getCheckInStatus>
  > | null>(null);
  const [giftItemId, setGiftItemId] = useState<string | null>(null);
  const [giftQuery, setGiftQuery] = useState("");
  const [giftUsers, setGiftUsers] = useState<UserProfile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [shop, daily, own, ci] = await Promise.all([
        getShopItems(),
        getDailyChallenges(user.uid),
        getOwnedItemIds(user.uid),
        getCheckInStatus(user.uid),
      ]);
      setItems(shop);
      setChallenges(daily);
      setOwned(own);
      setCheckIn(ci);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    if (!giftQuery.trim() || !user) {
      setGiftUsers([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(giftQuery).then((u) =>
        setGiftUsers(u.filter((x) => x.uid !== user.uid).slice(0, 6))
      );
    }, 250);
    return () => clearTimeout(t);
  }, [giftQuery, user]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.type === filter);
  }, [items, filter]);

  const buy = async (item: ShopItem) => {
    if (!user) return;
    if (owned.includes(item.id)) {
      toast.message("You already own this");
      return;
    }
    setBusy(item.id);
    try {
      await purchaseItem(user.uid, item.id);
      await refreshProfile();
      setOwned((o) => [...o, item.id]);
      toast.success(`Purchased ${item.name} — equipped!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(null);
    }
  };

  const equip = async (item: ShopItem) => {
    if (!user) return;
    setBusy(item.id);
    try {
      await equipItem(user.uid, item.id);
      await refreshProfile();
      toast.success(`Equipped ${item.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not equip");
    } finally {
      setBusy(null);
    }
  };

  const unequip = async (item: ShopItem) => {
    if (!user) return;
    setBusy(item.id);
    try {
      await unequipItem(user.uid, item.id);
      await refreshProfile();
      toast.success(`Unequipped ${item.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not unequip");
    } finally {
      setBusy(null);
    }
  };

  const onGift = async (to: UserProfile) => {
    if (!user || !giftItemId) return;
    setBusy(giftItemId);
    try {
      await giftItem(user.uid, to.uid, giftItemId);
      await refreshProfile();
      toast.success(`Gifted to @${to.username}`);
      setGiftItemId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gift failed");
    } finally {
      setBusy(null);
    }
  };

  const claim = async (id: string) => {
    if (!user) return;
    try {
      const reward = await claimChallenge(user.uid, id);
      await refreshProfile();
      await load();
      toast.success(`+${reward} Flux Coins`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Claim failed");
    }
  };

  const onCheckIn = async () => {
    if (!user) return;
    setBusy("checkin");
    try {
      const res = await claimDailyCheckIn(user.uid);
      if (res.alreadyClaimed) {
        toast.message("Already checked in today");
      } else {
        toast.success(`+${res.reward} coins · ${res.streak} day streak!`);
        await refreshProfile();
      }
      setCheckIn(await getCheckInStatus(user.uid));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setBusy(null);
    }
  };

  const equipped = profile?.decorations || {};

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-3 py-2.5 backdrop-blur-xl sm:px-4">
        <div className="lg:hidden">
          <MobileHeader title="Shop" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-xl font-extrabold">Shop</h1>
          <p className="text-xs text-muted-foreground">
            Weekly drop · {weekKey()}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-bold">
          <Coins className="h-4 w-4 text-[#1d9bf0]" />
          {formatCount(profile?.coins ?? 0)}
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#1d9bf0]" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 p-4"
        >
          {/* Daily check-in */}
          <section className="rounded-2xl border border-border bg-gradient-to-br from-[#1d9bf0]/10 to-transparent p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2 font-bold">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Daily check-in
                </div>
                <p className="text-sm text-muted-foreground">
                  Streak:{" "}
                  <span className="font-semibold text-foreground">
                    {checkIn?.streak ?? 0} days
                  </span>
                  {" · "}
                  Next: +{checkIn?.nextReward ?? 10} coins
                </p>
              </div>
              <Button
                variant="sky"
                size="sm"
                loading={busy === "checkin"}
                disabled={!!checkIn?.claimedToday}
                onClick={onCheckIn}
              >
                {checkIn?.claimedToday ? "Claimed today" : "Check in"}
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border border-border p-4">
            <div className="mb-3 flex items-center gap-2 font-bold">
              <Trophy className="h-4 w-4 text-[#1d9bf0]" />
              Daily challenges
            </div>
            <div className="space-y-3">
              {challenges?.challenges.map((c) => {
                const progress = challenges.progress[c.id] || 0;
                const done = progress >= c.target;
                const claimed = challenges.claimed.includes(c.id);
                const pct = Math.min(
                  100,
                  Math.round((progress / c.target) * 100)
                );
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-border p-3"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-semibold">{c.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.description}
                        </p>
                      </div>
                      <Badge variant="soft">+{c.reward}</Badge>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#1d9bf0]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs">
                      <span>
                        {Math.min(progress, c.target)}/{c.target}
                      </span>
                      <Button
                        size="sm"
                        disabled={!done || claimed}
                        onClick={() => claim(c.id)}
                      >
                        {claimed ? "Claimed" : done ? "Claim" : "In progress"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold">
                <ShoppingBag className="h-4 w-4 text-[#1d9bf0]" />
                Catalog
              </div>
              <p className="text-xs text-muted-foreground">
                {filtered.length} items
              </p>
            </div>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={
                    filter === f
                      ? "rounded-full bg-[#1d9bf0] px-3 py-1 text-xs font-bold text-white"
                      : "rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  }
                >
                  {f === "all"
                    ? "All"
                    : f === "group_deco"
                      ? "Group"
                      : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No items in this category yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((item) => {
                  const isOwned = owned.includes(item.id);
                  const isEquipped =
                    equipped.badgeId === item.id ||
                    equipped.frameId === item.id ||
                    equipped.themeId === item.id ||
                    equipped.bannerDecorationId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                    >
                      <div className="relative flex h-36 items-center justify-center bg-muted">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                              (
                                e.target as HTMLImageElement
                              ).parentElement!.querySelector(
                                "[data-fallback]"
                              )?.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <span
                          data-fallback
                          className={
                            item.imageUrl
                              ? "hidden text-5xl"
                              : "text-5xl"
                          }
                        >
                          {item.previewUrl}
                        </span>
                        {isOwned ? (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
                            <Check className="h-3 w-3" /> Owned
                          </span>
                        ) : null}
                        {isEquipped ? (
                          <span className="absolute right-2 top-2 rounded-full bg-[#1d9bf0] px-2 py-0.5 text-[10px] font-bold text-white">
                            Equipped
                          </span>
                        ) : null}
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium capitalize text-white">
                          {item.type.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h3 className="font-bold">{item.name}</h3>
                          <Badge variant="outline">{item.rarity}</Badge>
                        </div>
                        <p className="mb-3 flex-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-sm font-bold">
                            <Coins className="h-3.5 w-3.5 text-[#1d9bf0]" />
                            {item.price}
                          </span>
                          <div className="flex gap-1.5">
                            {!isOwned ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setGiftItemId(item.id)}
                                >
                                  <Gift className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="sky"
                                  loading={busy === item.id}
                                  onClick={() => buy(item)}
                                >
                                  Buy
                                </Button>
                              </>
                            ) : isEquipped ? (
                              <Button
                                size="sm"
                                variant="outline"
                                loading={busy === item.id}
                                onClick={() => unequip(item)}
                              >
                                Unequip
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="sky"
                                loading={busy === item.id}
                                onClick={() => equip(item)}
                              >
                                Equip
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </motion.div>
      )}

      <Dialog open={!!giftItemId} onOpenChange={() => setGiftItemId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gift item</DialogTitle>
          </DialogHeader>
          <Input
            value={giftQuery}
            onChange={(e) => setGiftQuery(e.target.value)}
            placeholder="Search user…"
          />
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {giftUsers.map((u) => (
              <li key={u.uid}>
                <button
                  type="button"
                  onClick={() => onGift(u)}
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-muted"
                >
                  <span className="font-medium">{u.displayName}</span>
                  <span className="text-sm text-muted-foreground">
                    @{u.username}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
