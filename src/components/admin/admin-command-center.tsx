"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Ban,
  BadgeCheck,
  Bot,
  CircleDollarSign,
  Clock3,
  Coins,
  Crown,
  Eye,
  FileWarning,
  Gift,
  Loader2,
  MessageSquareWarning,
  Radio,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  adjustCoins,
  banUser,
  getAdminLogs,
  getReports,
  getUserActivityLogs,
  listUsers,
  moderatePost,
  resolveReport,
  setUserVerified,
  timeoutUser,
  unbanUser,
  warnUser,
} from "@/services/admin";
import {
  adminEndLive,
  adminRemoveStory,
  adminResetAllAskAIUsage,
  adminResetAskAIUsage,
  adminSetPlan,
  listAdminActiveContent,
  type AdminContentItem,
} from "@/services/admin-platform";
import type { FluxPlanTier, Report, UserProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { VerifiedBadge } from "@/components/shared/verified-badge";
import { cn, formatCount } from "@/lib/utils";
import { profilePath } from "@/lib/routes";

type AdminTab = "overview" | "users" | "reports" | "content" | "logs";

export default function AdminCommandCenter() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [activity, setActivity] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [nextUsers, nextReports, nextContent, nextLogs] = await Promise.all([
        listUsers(180),
        getReports(100),
        listAdminActiveContent(),
        getAdminLogs(100),
      ]);
      setUsersList(nextUsers);
      setReports(nextReports);
      setContent(nextContent);
      setLogs(nextLogs as Array<Record<string, unknown>>);
      if (selected) setSelected(nextUsers.find((item) => item.uid === selected.uid) || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return usersList.filter((item) => !needle || [item.displayName, item.username, item.email, item.moderationStatus, item.planTier].join(" ").toLowerCase().includes(needle));
  }, [search, usersList]);

  const openUser = async (target: UserProfile) => {
    setSelected(target);
    setActivity(await getUserActivityLogs(target.uid, 60));
  };

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setWorking(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Admin action failed");
    } finally {
      setWorking(null);
    }
  };

  if (!profile?.isAdmin || !user) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f6f8] p-6 text-center dark:bg-black"><div><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-red-500/10 text-red-600"><Shield className="h-8 w-8" /></span><h1 className="mt-5 text-3xl font-black tracking-tight">Owner access required</h1><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">The command center is locked to the Ripo Team owner account.</p></div></main>;
  }

  const activeLives = content.filter((item) => item.type === "live").length;
  const activeStories = content.filter((item) => item.type === "story").length;
  const premiumUsers = usersList.filter((item) => item.planTier === "premium").length;
  const timedOrBanned = usersList.filter((item) => item.moderationStatus === "timeout" || item.moderationStatus === "banned").length;

  return (
    <main className="min-h-screen bg-[#f4f5f7] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <header className="border-b border-black/6 bg-[#0c0e12] px-4 py-6 text-white dark:border-white/10 sm:py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500"><ShieldCheck className="h-6 w-6" /></span><h1 className="mt-5 text-4xl font-black tracking-[-.06em] sm:text-5xl">Flux Command Center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/48">Users, plans, AskAI usage, reports, public content and audit logs. Private chats remain private unless a participant reports a message.</p></div>
          <Button onClick={() => void load()} disabled={loading} className="h-11 rounded-full bg-white px-5 font-black text-black hover:bg-white/90">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh data</Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-5 sm:py-7">
        <nav className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
          <Tab active={tab === "overview"} icon={Activity} label="Overview" onClick={() => setTab("overview")} />
          <Tab active={tab === "users"} icon={Users} label="Users" onClick={() => setTab("users")} />
          <Tab active={tab === "reports"} icon={FileWarning} label={`Reports ${reports.length ? `(${reports.length})` : ""}`} onClick={() => setTab("reports")} />
          <Tab active={tab === "content"} icon={Eye} label="Content" onClick={() => setTab("content")} />
          <Tab active={tab === "logs"} icon={MessageSquareWarning} label="Audit logs" onClick={() => setTab("logs")} />
        </nav>

        {loading ? <div className="grid min-h-[420px] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div> : null}

        {!loading && tab === "overview" ? (
          <section>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><Metric icon={Users} label="Users" value={formatCount(usersList.length)} /><Metric icon={Crown} label="Premium" value={formatCount(premiumUsers)} /><Metric icon={FileWarning} label="Open reports" value={formatCount(reports.length)} /><Metric icon={Radio} label="Live now" value={formatCount(activeLives)} /><Metric icon={Ban} label="Restricted" value={formatCount(timedOrBanned)} /></div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
              <article className="rounded-[28px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><Bot className="h-5 w-5" /></span><div><h2 className="text-xl font-black">AskAI controls</h2><p className="text-xs text-muted-foreground">Reset limits without editing profiles manually</p></div></div><div className="mt-6 rounded-2xl bg-muted/60 p-4"><p className="text-sm font-bold">Global usage reset</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Resets the weekly counter for up to 450 loaded users while preserving each plan’s correct limit.</p><Button onClick={() => void run("reset-all", async () => adminResetAllAskAIUsage(user.uid), "AskAI limits reset")} disabled={working !== null} className="mt-4 rounded-full font-black">{working === "reset-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Reset everyone</Button></div></article>
              <article className="rounded-[28px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="text-xl font-black">Moderation pulse</h2><p className="text-xs text-muted-foreground">Public and reported content only</p></div></div><div className="mt-6 grid grid-cols-3 gap-2"><MiniStat label="Reports" value={reports.length} /><MiniStat label="Stories" value={activeStories} /><MiniStat label="Lives" value={activeLives} /></div><button type="button" onClick={() => setTab("reports")} className="mt-5 flex h-11 w-full items-center justify-center rounded-full border border-border text-sm font-black hover:bg-muted">Review queue</button></article>
            </div>
            <div className="mt-5 rounded-[28px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><h2 className="text-xl font-black">Recent admin actions</h2><AuditList logs={logs.slice(0, 12)} /></div>
          </section>
        ) : null}

        {!loading && tab === "users" ? (
          <section className="grid overflow-hidden rounded-[28px] border border-black/7 bg-white dark:border-white/10 dark:bg-[#101114] lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="border-b border-black/7 p-3 dark:border-white/10 lg:border-b-0 lg:border-r"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" className="h-11 rounded-2xl pl-10" /></div><div className="mt-3 max-h-[620px] overflow-y-auto">{filteredUsers.map((target) => <button key={target.uid} type="button" onClick={() => void openUser(target)} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-muted", selected?.uid === target.uid && "bg-muted")}><UserAvatar user={target} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="flex items-center gap-1 truncate text-sm font-black">{target.displayName}{target.isVerified ? <VerifiedBadge /> : null}</p><p className="truncate text-[10px] text-muted-foreground">@{target.username} · {target.planTier || "free"} · {target.moderationStatus}</p></div></button>)}</div></div>
            <div className="min-h-[560px] p-4 sm:p-6">{selected ? <UserControl target={selected} activity={activity} working={working} onRun={run} onReload={() => void openUser(selected)} adminId={user.uid} /> : <div className="grid h-full min-h-[420px] place-items-center text-center"><div><UserCheck className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-xl font-black">Select a user</h2><p className="mt-2 text-sm text-muted-foreground">Plans, usage, coins and moderation appear here.</p></div></div>}</div>
          </section>
        ) : null}

        {!loading && tab === "reports" ? (
          <section className="space-y-3">{reports.length ? reports.map((report) => <article key={report.id} className="rounded-[24px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114]"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-red-500/10 text-red-600"><AlertTriangle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black capitalize">{report.targetType} report</h3><span className="rounded-full bg-muted px-2.5 py-1 text-[9px] font-black">{report.reason}</span></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{report.details || "No additional details."}</p><p className="mt-2 break-all text-[10px] text-muted-foreground">Target: {report.targetId}</p><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void run(`dismiss-${report.id}`, () => resolveReport(report.id, user.uid, "dismissed"), "Report dismissed")} disabled={working !== null} className="rounded-full">Dismiss</Button><Button onClick={() => void run(`action-${report.id}`, async () => { if (report.targetType === "post") await moderatePost(user.uid, report.targetId, true); await resolveReport(report.id, user.uid, "actioned"); }, "Report actioned")} disabled={working !== null} className="rounded-full font-black"><Shield className="h-4 w-4" />Take action</Button></div></div></div></article>) : <Empty icon={ShieldCheck} title="No open reports" text="Reported public content and participant-reported messages will appear here." />}</section>
        ) : null}

        {!loading && tab === "content" ? (
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{content.length ? content.map((item) => <article key={`${item.type}-${item.id}`} className="rounded-[24px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114]"><span className={cn("grid h-11 w-11 place-items-center rounded-2xl", item.type === "live" ? "bg-red-500/10 text-red-600" : "bg-fuchsia-500/10 text-fuchsia-600")}>{item.type === "live" ? <Radio className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}</span><p className="mt-4 text-[9px] font-black uppercase tracking-wider text-muted-foreground">{item.type}</p><h3 className="mt-1 line-clamp-2 font-black">{item.title}</h3><p className="mt-2 truncate text-[10px] text-muted-foreground">Author {item.authorId}</p><Button variant="destructive" onClick={() => void run(`content-${item.id}`, () => item.type === "live" ? adminEndLive(user.uid, item.id) : adminRemoveStory(user.uid, item.id), item.type === "live" ? "Live ended" : "Story removed")} disabled={working !== null} className="mt-5 w-full rounded-full"><Trash2 className="h-4 w-4" />{item.type === "live" ? "End live" : "Remove Story"}</Button></article>) : <div className="sm:col-span-2 xl:col-span-3"><Empty icon={Eye} title="No active content" text="Active Stories and livestreams will appear here." /></div>}</section>
        ) : null}

        {!loading && tab === "logs" ? <section className="rounded-[28px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><h2 className="text-xl font-black">Admin audit log</h2><AuditList logs={logs} /></section> : null}
      </div>
    </main>
  );
}

function UserControl({ target, activity, working, onRun, onReload, adminId }: { target: UserProfile; activity: Array<Record<string, unknown>>; working: string | null; onRun: (key: string, action: () => Promise<unknown>, success: string) => Promise<void>; onReload: () => void; adminId: string }) {
  const [coinAmount, setCoinAmount] = useState("100");
  const plan = target.planTier || "free";
  const action = (key: string, task: () => Promise<unknown>, message: string) => void onRun(key, task, message);
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><UserAvatar user={target} size="lg" clickable={false} /><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 text-2xl font-black">{target.displayName}{target.isVerified ? <VerifiedBadge /> : null}</h2><Link href={profilePath(target.username)} className="text-sm font-bold text-primary">@{target.username}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{target.email}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-[10px] font-black uppercase">{target.moderationStatus}</span></div>
    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"><MiniStat label="Coins" value={target.coins} /><MiniStat label="Plan" value={plan} /><MiniStat label="AskAI" value={`${target.askAIUsage?.used || 0}/${target.askAIUsage?.limit || 20}`} /><MiniStat label="Warnings" value={target.warnCount} /></div>
    <div className="mt-6 rounded-[24px] border border-border p-4"><div className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-500" /><h3 className="font-black">Plan and AskAI</h3></div><div className="mt-4 flex flex-wrap gap-2">{(["free", "basic", "premium"] as FluxPlanTier[]).map((tier) => <Button key={tier} variant={plan === tier ? "default" : "outline"} onClick={() => action(`plan-${tier}`, () => adminSetPlan(adminId, target.uid, tier), `${tier} plan applied`)} disabled={working !== null} className="rounded-full capitalize">{tier === "premium" ? <Crown className="h-4 w-4" /> : tier === "basic" ? <Sparkles className="h-4 w-4" /> : <Users className="h-4 w-4" />}{tier}</Button>)}<Button variant="outline" onClick={() => action("usage", () => adminResetAskAIUsage(adminId, target.uid), "AskAI usage reset")} disabled={working !== null} className="rounded-full"><RefreshCw className="h-4 w-4" />Reset usage</Button></div></div>
    <div className="mt-4 rounded-[24px] border border-border p-4"><div className="flex items-center gap-2"><Coins className="h-5 w-5 text-amber-500" /><h3 className="font-black">Coins and verification</h3></div><div className="mt-4 flex flex-wrap gap-2"><Input type="number" value={coinAmount} onChange={(event) => setCoinAmount(event.target.value)} className="h-10 w-32 rounded-full" /><Button variant="outline" onClick={() => action("coins", () => adjustCoins(adminId, target.uid, Number(coinAmount) || 0), "Coin balance adjusted")} disabled={working !== null} className="rounded-full"><CircleDollarSign className="h-4 w-4" />Apply coins</Button><Button variant="outline" onClick={() => action("verify", () => setUserVerified(adminId, target.uid, !target.isVerified, "flux"), "Verification updated")} disabled={working !== null} className="rounded-full"><BadgeCheck className="h-4 w-4" />{target.isVerified ? "Remove badge" : "Verify"}</Button></div></div>
    <div className="mt-4 rounded-[24px] border border-border p-4"><div className="flex items-center gap-2"><Shield className="h-5 w-5 text-red-500" /><h3 className="font-black">Moderation</h3></div><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={() => action("warn", () => warnUser(adminId, target.uid, "Community guidelines"), "Warning sent")} disabled={working !== null} className="rounded-full"><AlertTriangle className="h-4 w-4" />Warn</Button><Button variant="outline" onClick={() => action("timeout", () => timeoutUser(adminId, target.uid, 24, "Admin timeout"), "User timed out for 24 hours")} disabled={working !== null} className="rounded-full"><Clock3 className="h-4 w-4" />Timeout 24h</Button><Button variant="destructive" onClick={() => action("ban", () => banUser(adminId, target.uid, "Banned by Flux owner"), "User banned")} disabled={working !== null} className="rounded-full"><Ban className="h-4 w-4" />Ban</Button><Button variant="outline" onClick={() => action("unban", () => unbanUser(adminId, target.uid), "Account restored")} disabled={working !== null} className="rounded-full"><UserCheck className="h-4 w-4" />Restore</Button></div></div>
    <div className="mt-4"><div className="flex items-center justify-between"><h3 className="font-black">Recent public posts</h3><button type="button" onClick={onReload} className="text-xs font-black text-primary">Reload</button></div><div className="mt-3 space-y-2">{activity.length ? activity.map((item) => <div key={String(item.id)} className="flex items-start gap-3 rounded-2xl border border-border p-3"><p className="min-w-0 flex-1 text-sm leading-5">{String(item.text || "").slice(0, 180) || "Post without text"}</p><button type="button" onClick={() => action(`post-${String(item.id)}`, () => moderatePost(adminId, String(item.id), true), "Post removed")} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>) : <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">No public post activity.</p>}</div></div>
  </div>;
}

function Tab({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Activity; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={cn("flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black", active ? "bg-foreground text-background" : "border border-border bg-card text-muted-foreground")}><Icon className="h-4 w-4" />{label}</button>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) { return <div className="rounded-[22px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114]"><Icon className="h-5 w-5 text-violet-500" /><p className="mt-4 text-2xl font-black">{value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function MiniStat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-2xl bg-muted/60 p-3"><p className="truncate text-lg font-black">{typeof value === "number" ? formatCount(value) : value}</p><p className="mt-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</p></div>; }
function Empty({ icon: Icon, title, text }: { icon: typeof Eye; title: string; text: string }) { return <div className="grid min-h-[360px] place-items-center rounded-[28px] border border-dashed border-border bg-card text-center"><div><Icon className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-4 text-xl font-black">{title}</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{text}</p></div></div>; }
function AuditList({ logs }: { logs: Array<Record<string, unknown>> }) { return <div className="mt-4 divide-y divide-border">{logs.length ? logs.map((entry) => <div key={String(entry.id)} className="flex items-start gap-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted"><WandSparkles className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{String(entry.action || "admin_action").replaceAll("_", " ")}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">Target {String(entry.targetUid || "system")} · Admin {String(entry.adminId || "owner")}</p></div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No audit entries yet.</p>}</div>; }
