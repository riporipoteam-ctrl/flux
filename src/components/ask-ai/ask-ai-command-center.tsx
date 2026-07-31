"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { Bot, Boxes, Braces, CircleGauge, Code2, ExternalLink, FileText, Gamepad2, Layers3, Loader2, Menu, Monitor, Plus, Search, Send, Sparkles, Square, Trash2, Users, WandSparkles, X, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { addMessage, createConversation, deleteConversation, getMessages, listConversations, renameConversation, type AIConversation, type AIMessage } from "@/services/ai-chat";
import { searchFlux, type FluxSearchKind, type FluxSearchResult } from "@/services/flux-search";
import { createGroup } from "@/services/groups";
import { consumeAskAIRequest, saveFluxAgent, usagePercent } from "@/services/flux-platform";
import { generateProject } from "@/lib/project-generator";
import { saveLocalProject, type GeneratedProject } from "@/services/studio-projects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

type AskMode = "assistant" | "search" | "create";
type Artifact =
  | { id: string; type: "project"; project: GeneratedProject }
  | { id: string; type: "group"; title: string; href: string }
  | { id: string; type: "agent"; title: string; detail: string };

const FILTERS: Array<{ value: "all" | FluxSearchKind; label: string }> = [
  { value: "all", label: "All" }, { value: "person", label: "People" }, { value: "group", label: "Groups" }, { value: "post", label: "Posts" },
];
const STARTERS = [
  { icon: Search, title: "Search Flux", prompt: "Search Flux for Ripo Team", mode: "search" as AskMode },
  { icon: Gamepad2, title: "Make a game", prompt: "Make a neon multiplayer city defense game", mode: "create" as AskMode },
  { icon: Monitor, title: "Make a website", prompt: "Make a modern website for my gaming community", mode: "create" as AskMode },
  { icon: Bot, title: "Create an agent", prompt: "Create an agent named Builder that plans game updates", mode: "create" as AskMode },
];

export default function AskAICommandCenter() {
  const { user, profile, refreshProfile } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AskMode>("assistant");
  const [filter, setFilter] = useState<"all" | FluxSearchKind>("all");
  const [results, setResults] = useState<FluxSearchResult[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [preview, setPreview] = useState<GeneratedProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const endpoint = useMemo(resolveEndpoint, []);
  const percent = usagePercent(profile);

  const refresh = useCallback(async () => {
    if (user) setConversations(await listConversations(user.uid));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setResults([]); setArtifacts([]);
    if (!activeId) { setMessages([]); return; }
    getMessages(activeId).then(setMessages).catch(() => setMessages([]));
  }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [artifacts, loading, messages, results]);

  const ensureConversation = async (title: string) => {
    if (activeId) return activeId;
    if (!user) throw new Error("Sign in to use AskAI");
    const id = await createConversation(user.uid, title.slice(0, 52) || "New chat");
    setActiveId(id);
    return id;
  };

  const append = async (id: string, role: "user" | "assistant", content: string) => {
    const item: AIMessage = { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, content, createdAt: null };
    setMessages((current) => [...current, item]);
    await addMessage(id, { role, content });
  };

  const newChat = async () => {
    if (!user) return;
    const id = await createConversation(user.uid, "New chat");
    setActiveId(id); setMessages([]); setResults([]); setArtifacts([]); setInput(""); setHistoryOpen(false);
    await refresh();
  };

  const runSearch = async (text: string) => {
    const query = text.replace(/^(search|find|look up)\s+(flux\s+)?/i, "").trim();
    if (query.length < 2) throw new Error("Type at least two characters to search Flux.");
    const id = await ensureConversation(`Search: ${query}`);
    await append(id, "user", `Search Flux for ${query}`);
    setStatus("Searching people, groups and posts…");
    const found = await searchFlux(query, { kinds: filter === "all" ? undefined : [filter], max: 30 });
    setResults(found);
    await append(id, "assistant", found.length ? `I found ${found.length} matching Flux result${found.length === 1 ? "" : "s"}.` : `No public Flux result matched “${query}”.`);
  };

  const runCreator = async (text: string): Promise<boolean> => {
    if (!user) return false;
    const lower = text.toLowerCase();
    const id = await ensureConversation(text);
    const isGame = /\b(game|experience)\b/.test(lower) && /\b(make|build|create|generate)\b/.test(lower);
    const isWebsite = /\b(website|site|landing page)\b/.test(lower) && /\b(make|build|create|generate)\b/.test(lower);
    const isAgent = /\bagent\b/.test(lower) && /\b(make|create|launch)\b/.test(lower);
    const isGroup = /\bgroup\b/.test(lower) && /\b(make|create)\b/.test(lower);
    if (!isGame && !isWebsite && !isAgent && !isGroup) return false;

    await consumeAskAIRequest(user.uid);
    await append(id, "user", text);

    if (isGame || isWebsite) {
      const kind = isGame ? "game" : "website";
      setStatus(kind === "game" ? "Designing gameplay and writing code…" : "Building responsive pages and code…");
      await delay(420);
      const project = generateProject({ ownerId: user.uid, kind, prompt: text });
      saveLocalProject(project);
      setArtifacts([{ id: project.id, type: "project", project }]);
      await append(id, "assistant", `I created **${project.title}** as an editable ${kind}. Preview it here, copy its code, or continue in Flux Studio.`);
    } else if (isAgent) {
      const match = text.match(/(?:named|called)\s+["']?([a-z0-9 _-]{2,40})/i);
      const name = (match?.[1] || "Flux Agent").replace(/\b(that|which|to)\b.*$/i, "").trim();
      const agent = await saveFluxAgent(user.uid, { name, instructions: text.replace(/.*\bagent\b/i, "").trim() || "Help with creator tasks." });
      setArtifacts([{ id: agent.id, type: "agent", title: agent.name, detail: agent.instructions }]);
      await append(id, "assistant", `Agent **${agent.name}** is saved to your Flux profile and ready for a task.`);
    } else {
      const match = text.match(/(?:group\s+(?:called|named)?|called|named)\s+["']?([^"'.]{2,50})/i);
      const name = (match?.[1] || text.replace(/.*\bgroup\b/i, "")).trim().slice(0, 50) || "New Flux Group";
      const groupId = await createGroup({ ownerId: user.uid, name, description: `Created with AskAI from: ${text.slice(0, 220)}`, isPrivate: false });
      setArtifacts([{ id: groupId, type: "group", title: name, href: `/groups/${groupId}` }]);
      await append(id, "assistant", `I created **${name}**. Each Flux account can own one group.`);
    }
    await refreshProfile();
    return true;
  };

  const send = async (override?: string, overrideMode?: AskMode) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    const selected = overrideMode || mode;
    setInput(""); setLoading(true); setStatus("Working…"); setResults([]); setArtifacts([]);
    try {
      if (selected === "search" || /^(search|find|look up)\s+(flux\s+)?/i.test(text)) {
        await runSearch(text);
      } else if (selected === "create") {
        if (!(await runCreator(text))) throw new Error("Create mode supports games, websites, groups and agents.");
      } else if (!(await runCreator(text))) {
        const id = await ensureConversation(text);
        await consumeAskAIRequest(user.uid);
        await append(id, "user", text);
        if (!messages.length) void renameConversation(id, text.slice(0, 52));
        const answer = endpoint ? await askRemote(endpoint, text, messages, setStatus, abortRef) : localReply(text);
        await append(id, "assistant", answer);
        await refreshProfile();
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "AskAI failed";
      toast.error(message);
      if (activeId) await append(activeId, "assistant", `I couldn't finish that request: ${message}`);
    } finally {
      setLoading(false); setStatus(null); abortRef.current = null;
    }
  };

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-[#f5f6f8] text-[#111216] dark:bg-black dark:text-white lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[304px] flex-col border-r border-black/6 bg-white transition-transform dark:border-white/10 dark:bg-[#0b0c0e] md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-[61px] items-center gap-2 border-b border-black/6 px-3 dark:border-white/10"><Button onClick={() => void newChat()} className="h-11 flex-1 rounded-2xl font-black"><Plus className="h-4 w-4" />New chat</Button><button type="button" onClick={() => setHistoryOpen(false)} className="social-action md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2"><p className="px-3 pb-2 pt-3 text-[10px] font-black uppercase tracking-[.16em] text-black/35 dark:text-white/30">Recent</p>{conversations.map((conversation) => <div key={conversation.id} className={cn("group flex items-center rounded-2xl px-2 hover:bg-black/[.035] dark:hover:bg-white/6", activeId === conversation.id && "bg-black/[.05] dark:bg-white/8")}><button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-2 py-3 text-left text-sm font-bold">{conversation.title}</button><button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="social-action h-9 min-h-9 w-9 min-w-9 opacity-0 group-hover:opacity-100" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        <div className="border-t border-black/6 p-3 dark:border-white/10"><div className="rounded-2xl bg-black/[.035] p-3 dark:bg-white/6"><div className="flex items-center gap-2"><UserAvatar user={profile} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{profile?.displayName || "Flux user"}</p><p className="truncate text-[10px] text-black/40 dark:text-white/35">{profile?.planTier || "free"} · {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20}</p></div><CircleGauge className="h-4 w-4 text-primary" /></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div><Link href="/premium" className="mt-2 block text-right text-[9px] font-black uppercase tracking-wider text-primary">Manage usage</Link></div></div>
      </aside>
      {historyOpen ? <button type="button" className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[61px] items-center gap-3 border-b border-black/6 bg-white/90 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/88 sm:px-5"><button type="button" onClick={() => setHistoryOpen(true)} className="social-action md:hidden"><Menu className="h-5 w-5" /></button><span className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h1 className="font-black">AskAI</h1><p className="truncate text-[11px] text-muted-foreground">Instant Flux Search · games · websites · groups · agents</p></div><span className="hidden rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300 sm:inline">{endpoint ? "Remote AI ready" : "Instant tools ready"}</span></header>
        <div className="border-b border-black/6 bg-white px-3 py-2 dark:border-white/10 dark:bg-black sm:px-5"><div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto no-scrollbar"><Mode active={mode === "assistant"} icon={Bot} label="Assistant" onClick={() => setMode("assistant")} /><Mode active={mode === "search"} icon={Search} label="Flux Search" onClick={() => setMode("search")} /><Mode active={mode === "create"} icon={WandSparkles} label="Create" onClick={() => setMode("create")} />{mode === "search" ? FILTERS.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={cn("rounded-full px-3 py-1.5 text-[10px] font-black", filter === item.value ? "bg-black text-white dark:bg-white dark:text-black" : "bg-muted text-muted-foreground")}>{item.label}</button>) : null}</div></div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"><div className="mx-auto max-w-4xl">
          {!messages.length && !loading ? <div className="py-8 sm:py-14"><span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-black text-white dark:bg-white dark:text-black"><Zap className="h-7 w-7" /></span><h2 className="mx-auto mt-6 max-w-2xl text-center text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-5xl">Search Flux or build something.</h2><p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-muted-foreground">No local model installation. Creator commands produce editable browser projects immediately.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{STARTERS.map(({ icon: Icon, title, prompt, mode: starterMode }) => <button key={title} onClick={() => void send(prompt, starterMode)} className="flex min-h-24 items-center gap-4 rounded-[22px] border border-border bg-card p-4 text-left shadow-sm hover:shadow-lg"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-muted text-primary"><Icon className="h-5 w-5" /></span><span><b className="block">{title}</b><span className="mt-1 block text-xs text-muted-foreground">{prompt}</span></span></button>)}</div></div> : null}
          <div className="space-y-5">{messages.map((message) => <div key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>{message.role === "assistant" ? <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-4 w-4" /></span> : null}<div className={cn("max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-7 sm:max-w-[78%]", message.role === "user" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-border bg-card")}><ReactMarkdown>{message.content}</ReactMarkdown></div></div>)}</div>
          {status ? <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{status}</div> : null}
          {results.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2">{results.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-4 hover:shadow-md"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">{result.imageUrl ? <img src={result.imageUrl} alt="" className="h-full w-full object-cover" /> : result.kind === "person" ? <Users className="h-5 w-5" /> : result.kind === "group" ? <Layers3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{result.title}</b><span className="block truncate text-[10px] text-muted-foreground">{result.subtitle} · {result.meta}</span><span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{result.description}</span></span><ExternalLink className="h-4 w-4 text-muted-foreground" /></Link>)}</div> : null}
          {artifacts.map((artifact) => artifact.type === "project" ? <div key={artifact.id} className="mt-6 overflow-hidden rounded-[24px] border border-border bg-card"><div className="h-36" style={{ background: artifact.project.thumbnail }} /><div className="p-4"><h3 className="font-black">{artifact.project.title}</h3><p className="mt-1 text-xs text-muted-foreground">Editable {artifact.project.kind} saved on this device</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setPreview(artifact.project)} className="rounded-full"><Square className="h-4 w-4" />Preview</Button><Link href={`/studio?project=${encodeURIComponent(artifact.project.id)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-black"><Code2 className="h-4 w-4" />Studio</Link><button onClick={async () => { await navigator.clipboard.writeText(artifact.project.code); toast.success("Code copied"); }} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-black"><Braces className="h-4 w-4" />Copy code</button></div></div></div> : artifact.type === "group" ? <Link key={artifact.id} href={artifact.href} className="mt-6 flex items-center gap-3 rounded-[22px] border border-border bg-card p-4"><Users className="h-5 w-5 text-primary" /><div className="flex-1"><b>{artifact.title}</b><p className="text-xs text-muted-foreground">Open your new group</p></div><ExternalLink className="h-4 w-4" /></Link> : <div key={artifact.id} className="mt-6 flex items-center gap-3 rounded-[22px] border border-border bg-card p-4"><Bot className="h-5 w-5 text-emerald-500" /><div><b>{artifact.title}</b><p className="line-clamp-2 text-xs text-muted-foreground">{artifact.detail}</p></div></div>)}
          <div ref={bottomRef} />
        </div></div>

        <footer className="border-t border-border bg-background p-3 sm:p-4"><div className="mx-auto max-w-4xl"><div className="relative rounded-[24px] border border-border bg-muted/40 p-2"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={mode === "search" ? "Search people, groups and posts…" : mode === "create" ? "Describe a game, website, group or agent…" : "Message AskAI…"} className="min-h-12 resize-none border-0 bg-transparent px-3 py-3 pr-14 shadow-none focus-visible:ring-0" /><button onClick={() => loading ? (abortRef.current?.abort(), setLoading(false)) : void send()} disabled={!loading && !input.trim()} className="absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-30">{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button></div></div></footer>
      </section>

      {preview ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-2 sm:p-5"><div className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-white/12 bg-[#0b0c0f]"><div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 text-white"><Boxes className="h-5 w-5 text-violet-400" /><b className="min-w-0 flex-1 truncate">{preview.title}</b><Link href={`/studio?project=${encodeURIComponent(preview.id)}`} className="hidden rounded-full bg-white px-4 py-2 text-xs font-black text-black sm:inline-flex">Edit in Studio</Link><button onClick={() => setPreview(null)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8"><X className="h-5 w-5" /></button></div><iframe title={preview.title} srcDoc={preview.code} sandbox="allow-scripts allow-pointer-lock" className="min-h-0 flex-1 border-0 bg-black" /></div></div> : null}
    </main>
  );
}

function Mode({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Bot; label: string; onClick: () => void }) { return <button onClick={onClick} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[11px] font-black", active ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}><Icon className="h-4 w-4" />{label}</button>; }
function resolveEndpoint() { const configured = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT?.trim(); return configured || (process.env.NEXT_PUBLIC_BASE_PATH ? null : "/api/ask-ai"); }
function localReply(text: string) { return `Instant Flux tools are ready without downloading a model. I can search Flux, create one group, generate an editable game or website, or save an agent.\n\nYou said: “${text.slice(0, 220)}”`; }
function delay(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }
async function askRemote(endpoint: string, text: string, history: AIMessage[], onStatus: (value: string) => void, abortRef: MutableRefObject<AbortController | null>) {
  const controller = new AbortController(); abortRef.current = controller; onStatus("AskAI is responding…");
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: history.slice(-16).map(({ role, content }) => ({ role, content })) }), signal: controller.signal });
  if (!response.ok) throw new Error(`AskAI service returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) { const data = await response.json() as { answer?: string; message?: string; text?: string }; return data.answer || data.message || data.text || "AskAI returned an empty response."; }
  const raw = await response.text();
  if (!contentType.includes("text/event-stream")) return raw || "AskAI returned an empty response.";
  return raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => { try { const data = JSON.parse(line) as { token?: string; text?: string; content?: string }; return data.token || data.text || data.content || ""; } catch { return line; } }).join("") || "AskAI returned an empty response.";
}
