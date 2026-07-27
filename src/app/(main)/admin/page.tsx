"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Coins,
  Loader2,
  Shield,
  Trash2,
  Ban,
  Clock,
  AlertTriangle,
  MessageSquare,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  adjustCoins,
  banUser,
  createCustomBadge,
  getAdminLogs,
  getReports,
  getUserActivityLogs,
  grantCustomBadge,
  listCustomBadges,
  listUsers,
  moderatePost,
  publishGameAnnouncement,
  resolveReport,
  sendAdminSecretMessage,
  setUserVerified,
  timeoutUser,
  unbanUser,
  warnUser,
} from "@/services/admin";
import { adminGrantItem, adminPublishShopItem, getShopItems } from "@/services/shop";
import type { Report, ShopItem, UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { MobileHeader } from "@/components/layout/mobile-header";

export default function AdminPage() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [shop, setShop] = useState<ShopItem[]>([]);
  const [badges, setBadges] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState("");
  const [badgeName, setBadgeName] = useState("");
  const [badgeEmoji, setBadgeEmoji] = useState("⭐");
  const [shopName, setShopName] = useState("");
  const [shopPrice, setShopPrice] = useState("100");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [youtubeUrls, setYoutubeUrls] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, l, s, b] = await Promise.all([
        listUsers(100),
        getReports(),
        getAdminLogs(40),
        getShopItems(),
        listCustomBadges(),
      ]);
      setUsers(u);
      setReports(r);
      setLogs(l as Array<Record<string, unknown>>);
      setShop(s);
      setBadges(b);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openUser = async (u: UserProfile) => {
    setSelected(u);
    setActivity(await getUserActivityLogs(u.uid));
  };

  if (!profile?.isAdmin) {
    return (
      <div className="min-h-screen p-4">
        <EmptyState
          icon={Shield}
          title="Admin access required"
          description="Sign in with the owner email (ripo.ripoteam@gmail.com) for full admin powers."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass-strong border-b border-border px-3 py-2.5 sm:px-4">
        <div className="lg:hidden">
          <MobileHeader title="Admin" />
        </div>
        <h1 className="hidden items-center gap-2 text-xl font-extrabold lg:flex">
          <Shield className="h-5 w-5 text-[#1d9bf0]" />
          Admin · Ripo Team
        </h1>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="shop">Shop</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
            <TabsTrigger value="game">Game</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="grid gap-0 lg:grid-cols-2">
              <ul className="divide-y divide-border border-r border-border">
                {users.map((u) => (
                  <li key={u.uid}>
                    <button
                      type="button"
                      onClick={() => openUser(u)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                    >
                      <UserAvatar user={u} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 font-bold">
                          {u.displayName}
                          {u.isVerified ? <VerifiedBadge /> : null}
                          {u.accountType === "business" ? (
                            <span className="text-[10px] text-[#1d9bf0]">
                              Business
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{u.username} · {u.email} · {u.moderationStatus}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="p-4">
                {!selected ? (
                  <p className="text-sm text-muted-foreground">
                    Select a user to moderate
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={selected} size="lg" />
                      <div>
                        <p className="font-extrabold">{selected.displayName}</p>
                        <Link
                          href={`/${selected.username}`}
                          className="text-sm text-[#1d9bf0] hover:underline"
                        >
                          @{selected.username}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {selected.coins} coins · warns {selected.warnCount}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!user) return;
                          await setUserVerified(
                            user.uid,
                            selected.uid,
                            !selected.isVerified,
                            selected.accountType === "business"
                              ? "business"
                              : "flux"
                          );
                          toast.success("Updated verification");
                          load();
                        }}
                      >
                        <BadgeCheck className="h-4 w-4" />
                        {selected.isVerified ? "Unverify" : "Verify"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!user) return;
                          await adjustCoins(user.uid, selected.uid, 100);
                          toast.success("+100 coins");
                          load();
                        }}
                      >
                        <Coins className="h-4 w-4" /> +100 coins
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!user) return;
                          await warnUser(user.uid, selected.uid, "Community guidelines");
                          toast.success("Warned");
                          load();
                        }}
                      >
                        <AlertTriangle className="h-4 w-4" /> Warn
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!user) return;
                          await timeoutUser(user.uid, selected.uid, 24, "Timeout 24h");
                          toast.success("Timed out 24h");
                          load();
                        }}
                      >
                        <Clock className="h-4 w-4" /> Timeout 24h
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!user) return;
                          await banUser(user.uid, selected.uid, "Banned by admin");
                          toast.success("Banned");
                          load();
                        }}
                      >
                        <Ban className="h-4 w-4" /> Ban
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!user) return;
                          await unbanUser(user.uid, selected.uid);
                          toast.success("Restored");
                          load();
                        }}
                      >
                        Unban
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <p className="text-sm font-bold">
                        <MessageSquare className="mr-1 inline h-4 w-4" />
                        Secret message
                      </p>
                      <Textarea
                        value={secret}
                        onChange={(e) => setSecret(e.target.value)}
                        placeholder="Private admin note to user…"
                      />
                      <Button
                        size="sm"
                        variant="sky"
                        onClick={async () => {
                          if (!user || !secret.trim()) return;
                          await sendAdminSecretMessage(
                            user.uid,
                            selected.uid,
                            secret
                          );
                          setSecret("");
                          toast.success("Secret message sent");
                        }}
                      >
                        Send secret
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-xl border border-border p-3">
                      <p className="text-sm font-bold">
                        <Gift className="mr-1 inline h-4 w-4" /> Gift shop item
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {shop.slice(0, 6).map((item) => (
                          <Button
                            key={item.id}
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (!user) return;
                              await adminGrantItem(user.uid, selected.uid, item.id);
                              toast.success(`Granted ${item.name}`);
                            }}
                          >
                            {item.previewUrl} {item.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-bold">Recent posts</p>
                      <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                        {activity.length === 0 ? (
                          <li className="text-muted-foreground">No posts</li>
                        ) : (
                          activity.map((a) => (
                            <li
                              key={String(a.id)}
                              className="rounded border border-border px-2 py-1"
                            >
                              {String(a.text || "").slice(0, 120)}
                              {a.isDeleted ? " · deleted" : ""}
                              {user && a.id ? (
                                <button
                                  type="button"
                                  className="ml-2 text-destructive"
                                  onClick={async () => {
                                    await moderatePost(
                                      user.uid,
                                      String(a.id),
                                      true
                                    );
                                    toast.success("Post removed");
                                    openUser(selected);
                                  }}
                                >
                                  <Trash2 className="inline h-3 w-3" />
                                </button>
                              ) : null}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            {reports.length === 0 ? (
              <EmptyState icon={Shield} title="No open reports" description="" />
            ) : (
              <ul className="divide-y divide-border">
                {reports.map((r) => (
                  <li key={r.id} className="space-y-2 px-4 py-3">
                    <p className="text-sm font-medium">
                      {r.targetType}: {r.targetId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {r.reason} — {r.details}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          if (!user) return;
                          await resolveReport(r.id, user.uid, "dismissed");
                          load();
                        }}
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!user) return;
                          if (r.targetType === "post") {
                            await moderatePost(user.uid, r.targetId, true);
                          }
                          await resolveReport(r.id, user.uid, "actioned");
                          load();
                        }}
                      >
                        Action
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="shop" className="space-y-4 p-4">
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-2 font-bold">Publish item to shop</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Item name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />
                <Input
                  type="number"
                  className="sm:w-28"
                  value={shopPrice}
                  onChange={(e) => setShopPrice(e.target.value)}
                />
                <Button
                  variant="sky"
                  onClick={async () => {
                    if (!user || !shopName.trim()) return;
                    await adminPublishShopItem(user.uid, {
                      name: shopName.trim(),
                      description: "Admin published item",
                      type: "badge",
                      price: Number(shopPrice) || 100,
                      previewUrl: "🎁",
                      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(shopName)}%20badge%20icon?width=512&height=512&nologo=true`,
                      rarity: "rare",
                      createdByAdmin: true,
                    });
                    setShopName("");
                    toast.success("Published to shop");
                    load();
                  }}
                >
                  Publish
                </Button>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {shop.map((i) => (
                <li
                  key={i.id}
                  className="rounded-xl border border-border p-3 text-sm"
                >
                  {i.previewUrl} <b>{i.name}</b> · {i.price} coins
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="badges" className="space-y-4 p-4">
            <div className="rounded-2xl border border-border p-4">
              <p className="mb-2 font-bold">Create custom badge</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={badgeEmoji}
                  onChange={(e) => setBadgeEmoji(e.target.value)}
                  className="sm:w-20"
                  placeholder="⭐"
                />
                <Input
                  value={badgeName}
                  onChange={(e) => setBadgeName(e.target.value)}
                  placeholder="Badge name"
                />
                <Button
                  variant="sky"
                  onClick={async () => {
                    if (!user || !badgeName.trim()) return;
                    const id = await createCustomBadge(user.uid, {
                      name: badgeName.trim(),
                      emoji: badgeEmoji || "⭐",
                      color: "#1d9bf0",
                    });
                    if (selected) {
                      await grantCustomBadge(user.uid, selected.uid, id);
                    }
                    setBadgeName("");
                    toast.success("Badge created");
                    load();
                  }}
                >
                  Create{selected ? " & grant" : ""}
                </Button>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <li
                  key={String(b.id)}
                  className="rounded-full border border-border px-3 py-1 text-sm"
                >
                  {String(b.emoji)} {String(b.name)}
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="game" className="space-y-4 p-4">
            <div className="max-w-2xl rounded-2xl border border-border p-4">
              <p className="font-bold">Game-wide announcement</p>
              <p className="mb-3 text-sm text-muted-foreground">
                Shows in Flux Rec&apos;s community board for players on the local server.
              </p>
              <div className="space-y-2">
                <Input
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Announcement title"
                />
                <Textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  maxLength={500}
                  placeholder="Message for everyone playing Flux Rec"
                />
                <Textarea
                  value={youtubeUrls}
                  onChange={(e) => setYoutubeUrls(e.target.value)}
                  maxLength={1200}
                  placeholder="Ripo Team YouTube video or channel URLs (one per line)"
                />
                <Button
                  variant="sky"
                  onClick={async () => {
                    if (!user || !announcementText.trim()) return;
                    await publishGameAnnouncement(
                      user.uid,
                      announcementTitle,
                      announcementText,
                      youtubeUrls.split(/\r?\n/)
                    );
                    setAnnouncementTitle("");
                    setAnnouncementText("");
                    setYoutubeUrls("");
                    toast.success("Announcement sent to Flux Rec");
                  }}
                >
                  Send announcement
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <ul className="divide-y divide-border text-sm">
              {logs.map((l) => (
                <li key={String(l.id)} className="px-4 py-2">
                  <span className="font-semibold">{String(l.action)}</span>
                  {l.targetUid ? (
                    <span className="text-muted-foreground">
                      {" "}
                      → {String(l.targetUid).slice(0, 8)}…
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
