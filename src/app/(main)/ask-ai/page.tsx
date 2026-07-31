"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Boxes,
  Braces,
  CircleGauge,
  Code2,
  ExternalLink,
  FileText,
  Gamepad2,
  Globe2,
  Layers3,
  Loader2,
  Menu,
  Monitor,
  Plus,
  Rocket,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addMessage,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation,
  type AIConversation,
  type AIMessage,
} from "@/services/ai-chat";
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
type CreatorArtifact =
  | { id: string; type: "project"; title: string; project: GeneratedProject }
  | { id: string; type: "group"; title: string; href: string }
  | { id: string; type: "agent"; title: string; detail: string };

const SEARCH_FILTERS: Array<{ value: "all" | FluxSearchKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "person", label: "People" },
  { value: "group", label: "Groups" },
  { value: "post", label: "Posts" },
];

const STARTERS = [
  { icon: Search, title: "Search Flux", prompt: "Search Flux for Ripo Team", mode: "search" as const },
  { icon: Gamepad2, title: "Make a game", prompt: "Make a neon multiplayer city defense game", mode: "create" as const },
  { icon: Monitor, title: "Make a website", prompt: "Make a modern website for my gaming community", mode: "create" as const },
  { icon: Bot, title: "Create an agent", prompt: "Create an agent named Builder that plans game updates", mode: "create" as const },
];

export default function AskAIPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<AskMode>("assistant");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | FluxSearchKind>("all");
  const [searchResults, setSearchResults] = useState<FluxSearchResult[]>([]);
  const [artifacts, setArtifacts] = useState<CreatorArtifact[]>([]);
  const [preview, setPreview] = useState<GeneratedProject | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const endpoint = useMemo(() => resolveAskAIEndpoint(), []);
  const percent = usagePercent(profile);

  const refresh = useCallback(async () => {
    if (!user) return;
    setConversations(await listConversations(user.uid));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    setSearchResults([]);
    setArtifacts([]);
    if (!activeId) {
      setMessages([]);
      return;
    }
    getMessages(activeId).then(setMessages).catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [artifacts, loading, messages, searchResults]);

  const ensureConversation = async (title: string): Promise<string> => {
    if (activeId) return activeId;
    if (!user) throw new Error("Sign in to use AskAI");
    const id = await createConversation(user.uid, title.slice(0, 52) || "New chat");
    setActiveId(id);
    return id;
  };

  const append = async (conversationId: string, role: "user" | "assistant", content: string) => {
    const item: AIMessage = { id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, content, createdAt: null };
    setMessages((current) => [...current, item]);
    await addMessage(conversationId, { role, content });
  };

  const newChat = async () => {
    if (!user) return;
    const id = await createConversation(user.uid, "New chat");
    setActiveId(id);
    setMessages([]);
    setArtifacts([]);
    setSearchResults([]);
    setInput("");
    setHistoryOpen(false);
    await refresh();
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStatus(null);
  };

  const runSearch = async (raw: string) => {
    if (!user) return;
    const query = raw.replace(/^(search|find|look up)\s+(flux\s+)?/i, "").trim();
    if (query.length < 2) throw new Error("Type at least two characters to search Flux.");
    const conversationId = await ensureConversation(`Search: ${query}`);
    await append(conversationId, "user", `Search Flux for ${query}`);
    setStatus("Searching people, groups and posts…");
    const kinds = searchFilter === "all" ? undefined : [searchFilter];
    const results = await searchFlux(query, { kinds, max: 30 });
    setSearchResults(results);
    await append(conversationId, "assistant", results.length ? `I found ${results.length} relevant result${results.length === 1 ? "" : "s"} across Flux.` : `I couldn't find a public Flux result for “${query}”. Try a shorter name, username, hashtag or phrase.`);
  };

  const runCreatorCommand = async (text: string): Promise<boolean> => {
    if (!user) return false;
    const lower = text.toLowerCase();
    const conversationId = await ensureConversation(text);

    if (/\b(make|build|create|generate)\b.*\b(game|experience)\b|\bgame\b.*\b(make|build|create|generate)\b/.test(lower)) {
      await consumeAskAIRequest(user.uid);
      await append(conversationId, "user", text);
      setStatus("Designing game systems and writing code…");
      await tinyDelay(520);
      const project = generateProject({ ownerId: user.uid, kind: "game", prompt: text });
      saveLocalProject(project);
      setArtifacts((current) => [...current, { id: project.id, type: "project", title: project.title, project }]);
      await append(conversationId, "assistant", `I built **${project.title}** as an editable responsive browser game. Preview it here, open it in Flux Studio to change the code, then publish it to Flux Games.`);
      await refreshProfile();
      return true;
    }

    if (/\b(make|build|create|generate)\b.*\b(website|site|landing page)\b|\bwebsite\b.*\b(make|build|create|generate)\b/.test(lower)) {
      await consumeAskAIRequest(user.uid);
      await append(conversationId, "user", text);
      setStatus("Building the website and responsive layout…");
      await tinyDelay(460);
      const project = generateProject({ ownerId: user.uid, kind: "website", prompt: text });
      saveLocalProject(project);
      setArtifacts((current) => [...current, { id: project.id, type: "project", title: project.title, project }]);
      await append(conversationId, "assistant", `I created **${project.title}** as a complete editable website. Preview it, copy the code, or continue editing it in Flux Studio.`);
      await refreshProfile();
      return true;
    }

    if (/\b(create|make|launch)\b.*\bagent\b/.test(lower)) {
      await consumeAskAIRequest(user.uid);
      const nameMatch = text.match(/(?:named|called)\s+["']?([a-z0-9 _-]{2,40})/i);
      const name = (nameMatch?.[1] || "Flux Agent").replace(/\b(that|which|to)\b.*$/i, "").trim();
      const instructions = text.replace(/.*\bagent\b/i, "").trim() || "Help with Flux creator tasks.";
      await append(conversationId, "user", text);
      const agent = await saveFluxAgent(user.uid, { name, instructions });
      setArtifacts((current) => [...current, { id: agent.id, type: "agent", title: agent.name, detail: agent.instructions }]);
      await append(conversationId, "assistant", `Agent **${agent.name}** is ready. It is saved to your Flux profile and can be assigned creator tasks.`);
      await refreshProfile();
      return true;
    }

    if (/\b(create|make)\b.*\bgroup\b/.test(lower)) {
      await consumeAskAIRequest(user.uid);
      const nameMatch = text.match(/(?:group\s+(?:called|named)?|called|named)\s+["']?([^"'.]{2,50})/i);
      const name = (nameMatch?.[1] || text.replace(/.*\bgroup\b/i, "")).trim().slice(0, 50) || "New Flux Group";
      await append(conversationId, "user", text);
      const groupId = await createGroup({ ownerId: user.uid, name, description: `A Flux group created with AskAI from: ${text.slice(0, 220)}`, isPrivate: false });
      setArtifacts((current) => [...current, { id: groupId, type: "group", title: name, href: `/groups/${groupId}` }]);
      await append(conversationId, "assistant", `I created **${name}**. Flux limits every user to one owned group, so this is now your creator community.`);
      await refreshProfile();
      return true;
    }

    return false;
  };

  const send = async (override?: string, overrideMode?: AskMode) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    const selectedMode = overrideMode || mode;
    setInput("");
    setLoading(true);
    setStatus("Working…");
    setSearchResults([]);
    setArtifacts([]);

    try {
      if (selectedMode === "search" || /^(search|find|look up)\s+(flux\s+)?/i.test(text)) {
        await runSearch(text);
      } else if (selectedMode === "create" || await runCreatorCommand(text)) {
        if (selectedMode === "create" && !(await commandRecognized(text))) {
          throw new Error("AskAI Create understands games, websites, groups and agents. Tell it which one to make.");
        }
      } else {
        const conversationId = await ensureConversation(text);
        await consumeAskAIRequest(user.uid);
        await append(conversationId, "user", text);
        if (messages.length === 0) void renameConversation(conversationId, text.slice(0, 52));
        setStatus(endpoint ? "Connecting to AskAI…" : "Using instant Flux assistant…");
        const answer = endpoint
          ? await askRemote(endpoint, text, messages, (next) => setStatus(next), abortRef)
          : localAssistantReply(text);
        await append(conversationId, "assistant", answer);
        await refreshProfile();
      }
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "AskAI failed";
      toast.error(message);
      const conversationId = activeId;
      if (conversationId) await append(conversationId, "assistant", `I couldn't finish that request: ${message}`);
    } finally {
      setLoading(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const empty = messages.length === 0 && !loading;

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-[#f5f6f8] text-[#111216] dark:bg-black dark:text-white lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[304px] flex-col border-r border-black/6 bg-white transition-transform dark:border-white/10 dark:bg-[#0b0c0e] md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-[61px] items-center gap-2 border-b border-black/6 px-3 dark:border-white/10"><Button onClick={() => void newChat()} className="h-11 flex-1 rounded-2xl font-black"><Plus className="h-4 w-4" />New chat</Button><button type="button" onClick={() => setHistoryOpen(false)} className="social-action md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2"><p className="px-3 pb-2 pt-3 text-[10px] font-black uppercase tracking-[.16em] text-black/35 dark:text-white/30">Recent</p>{conversations.length ? conversations.map((conversation) => <div key={conversation.id} className={cn("group flex items-center rounded-2xl px-2 transition-colors hover:bg-black/[.035] dark:hover:bg-white/6", activeId === conversation.id && "bg-black/[.05] dark:bg-white/8")}><button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-2 py-3 text-left text-sm font-bold">{conversation.title}</button><button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="social-action h-9 min-h-9 w-9 min-w-9 opacity-0 group-hover:opacity-100" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button></div>) : <p className="px-4 py-8 text-center text-xs text-black/35 dark:text-white/30">Your AskAI chats appear here.</p>}</div>
        <div className="border-t border-black/6 p-3 dark:border-white/10"><div className="rounded-2xl bg-black/[.035] p-3 dark:bg-white/6"><div className="flex items-center gap-2"><UserAvatar user={profile} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{profile?.displayName || "Flux user"}</p><p className="truncate text-[10px] text-black/40 dark:text-white/35">{profile?.planTier || "free"} · {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20}</p></div><CircleGauge className="h-4 w-4 text-primary" /></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div><Link href="/premium" className="mt-2 block text-right text-[9px] font-black uppercase tracking-wider text-primary">Manage usage</Link></div></div>
      </aside>

      {historyOpen ? <button type="button" className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[61px] items-center gap-3 border-b border-black/6 bg-white/90 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/88 sm:px-5"><button type="button" onClick={() => setHistoryOpen(true)} className="social-action md:hidden" aria-label="Open chat history"><Menu className="h-5 w-5" /></button><span className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h1 className="truncate font-black tracking-tight">AskAI</h1><p className="truncate text-[11px] text-black/45 dark:text-white/40">Instant Flux Search · game, website, group and agent creation</p></div><span className={cn("hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black sm:flex", endpoint ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-violet-500/10 text-violet-700 dark:text-violet-300")}><span className={cn("h-1.5 w-1.5 rounded-full", endpoint ? "bg-emerald-500" : "bg-violet-500")} />{endpoint ? "Remote AI ready" : "Instant tools ready"}</span></header>
        <div className="border-b border-black/6 bg-white px-3 py-2 dark:border-white/10 dark:bg-black sm:px-5"><div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto no-scrollbar"><ModeButton active={mode === "assistant"} icon={Bot} label="Assistant" onClick={() => setMode("assistant")} /><ModeButton active={mode === "search"} icon={Search} label="Flux Search" onClick={() => setMode("search")} /><ModeButton active={mode === "create"} icon={WandSparkles} label="Create" onClick={() => setMode("create")} />{mode === "search" ? <div className="ml-2 flex gap-1">{SEARCH_FILTERS.map((filter) => <button key={filter.value} type="button" onClick={() => setSearchFilter(filter.value)} className={cn("rounded-full px-3 py-1.5 text-[10px] font-black", searchFilter === filter.value ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.04] text-black/45 dark:bg-white/7 dark:text-white/40")}>{filter.label}</button>)}</div> : null}</div></div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"><div className="mx-auto max-w-4xl">
          {empty ? <div className="py-8 sm:py-14"><span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-black text-white shadow-xl dark:bg-white dark:text-black"><Zap className="h-7 w-7" /></span><h2 className="mx-auto mt-6 max-w-2xl text-center text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-5xl">Search Flux or build something.</h2><p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-black/48 dark:text-white/42">No local model download. Search is immediate; creator commands generate editable projects directly in your browser.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{STARTERS.map(({ icon: Icon, title, prompt, mode: starterMode }) => <button key={title} type="button" onClick={() => void send(prompt, starterMode)} className="group flex min-h-24 items-center gap-4 rounded-[22px] border border-black/7 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-[#101114]"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-black/[.045] text-primary dark:bg-white/8"><Icon className="h-5 w-5" /></span><span><span className="block font-black">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{prompt}</span></span></button>)}</div></div> : null}

          <div className="space-y-5">{messages.map((message) => <div key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
            {message.role === "assistant" ? <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-4 w-4" /></span> : null}
            <div className={cn("max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-7 sm:max-w-[78%]", message.role === "user" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-black/6 bg-white dark:border-white/10 dark:bg-[#101114]")}><ReactMarkdown>{message.content}</ReactMarkdown></div>
          </div>)}</div>

          {status ? <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{status}</div> : null}

          {searchResults.length ? <section className="mt-6"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">Flux results</h3><span className="text-[10px] font-bold text-muted-foreground">{searchResults.length} matches</span></div><div className="grid gap-3 sm:grid-cols-2">{searchResults.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="flex items-center gap-3 rounded-[20px] border border-black/7 bg-white p-4 transition hover:border-primary/30 hover:shadow-md dark:border-white/10 dark:bg-[#101114]"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted">{result.imageUrl ? <img src={result.imageUrl} alt="" className="h-full w-full object-cover" /> : result.kind === "person" ? <Users className="h-5 w-5" /> : result.kind === "group" ? <Layers3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{result.title}</span><span className="block truncate text-[10px] text-muted-foreground">{result.subtitle} · {result.meta}</span><span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{result.description}</span></span><ExternalLink className="h-4 w-4 text-muted-foreground" /></Link>)}</div></section> : null}

          {artifacts.length ? <section className="mt-6 space-y-3">{artifacts.map((artifact) => artifact.type === "project" ? <div key={artifact.id} className="overflow-hidden rounded-[24px] border border-black/7 bg-white dark:border-white/10 dark:bg-[#101114]"><div className="h-36" style={{ background: artifact.project.thumbnail }} /><div className="p-4"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-300">{artifact.project.kind === "game" ? <Gamepad2 className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><h3 className="truncate font-black">{artifact.title}</h3><p className="mt-1 text-xs text-muted-foreground">Editable {artifact.project.kind} · saved to this device</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setPreview(artifact.project)} className="h-10 rounded-full font-black"><Square className="h-4 w-4" />Preview</Button><Link href={`/studio?project=${encodeURIComponent(artifact.project.id)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-black"><Code2 className="h-4 w-4" />Open in Studio</Link><button type="button" onClick={async () => { await navigator.clipboard.writeText(artifact.project.code); toast.success("Code copied"); }} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-black"><Braces className="h-4 w-4" />Copy code</button></div></div></div> : artifact.type === "group" ? <Link key={artifact.id} href={artifact.href} className="flex items-center gap-3 rounded-[22px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114]"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/12 text-blue-600"><Users className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-black">{artifact.title}</h3><p className="text-xs text-muted-foreground">Group created · open community</p></div><ExternalLink className="h-4 w-4" /></Link> : <div key={artifact.id} className="flex items-center gap-3 rounded-[22px] border border-black/7 bg-white p-4 dark:border-white/10 dark:bg-[#101114]"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><Bot className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-black">{artifact.title}</h3><p className="line-clamp-2 text-xs text-muted-foreground">{artifact.detail}</p></div></div>)}</section> : null}
          <div ref={bottomRef} />
        </div></div>

        <footer className="border-t border-black/6 bg-white p-3 dark:border-white/10 dark:bg-black sm:p-4"><div className="mx-auto max-w-4xl"><div className="relative rounded-[24px] border border-black/10 bg-[#f7f8fa] p-2 shadow-sm focus-within:border-black/20 dark:border-white/12 dark:bg-white/6"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={mode === "search" ? "Search people, groups and posts…" : mode === "create" ? "Describe a game, website, group or agent…" : "Message AskAI…"} className="min-h-12 resize-none border-0 bg-transparent px-3 py-3 pr-14 shadow-none focus-visible:ring-0" /><button type="button" onClick={() => loading ? stop() : void send()} disabled={!loading && !input.trim()} className="absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full bg-black text-white disabled:opacity-30 dark:bg-white dark:text-black" aria-label={loading ? "Stop" : "Send"}>{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button></div><p className="mt-2 text-center text-[9px] text-muted-foreground">AskAI can make mistakes. Published games and assets should be reviewed before sharing.</p></div></footer>
      </section>

      {preview ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-2 sm:p-5"><div className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-[26px] border border-white/12 bg-[#0b0c0f] shadow-2xl"><div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500"><WandSparkles className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black">{preview.title}</h3><p className="text-[10px] text-white/40">Live generated preview</p></div><Link href={`/studio?project=${encodeURIComponent(preview.id)}`} className="hidden h-9 items-center gap-2 rounded-full bg-white px-4 text-xs font-black text-black sm:inline-flex"><Boxes className="h-4 w-4" />Edit</Link><button type="button" onClick={() => setPreview(null)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8" aria-label="Close preview"><X className="h-5 w-5" /></button></div><iframe title={preview.title} srcDoc={preview.code} sandbox="allow-scripts allow-pointer-lock" className="min-h-0 flex-1 border-0 bg-black" /></div></div> : null}
    </main>
  );
}

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Bot; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[11px] font-black", active ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.035] text-black/45 dark:bg-white/6 dark:text-white/40")}><Icon className="h-4 w-4" />{label}</button>;
}

async function tinyDelay(ms: number) { await new Promise((resolve) => window.setTimeout(resolve, ms)); }
async function commandRecognized(text: string) { return /\b(game|website|site|group|agent)\b/i.test(text); }

function resolveAskAIEndpoint(): string | null {
  const configured = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT?.trim();
  if (configured) return configured;
  return process.env.NEXT_PUBLIC_BASE_PATH ? null : "/api/ask-ai";
}

function localAssistantReply(text: string): string {
  return `AskAI's instant Flux tools are ready without downloading a model. I can search Flux, create one group for your account, generate an editable game or website, or save a named agent.\n\nTry: **“Make a multiplayer space game”**, **“Search Flux for Ripo Team”**, or **“Create an agent named Builder.”**\n\nYour message was: “${text.slice(0, 240)}”`;
}

async function askRemote(endpoint: string, text: string, history: AIMessage[], onStatus: (value: string) => void, abortRef: React.MutableRefObject<AbortController | null>): Promise<string> {
  const controller = new AbortController();
  abortRef.current = controller;
  onStatus("AskAI is responding…");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, history: history.slice(-16).map((item) => ({ role: item.role, content: item.content })) }),
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`AskAI service returned ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json() as { answer?: string; message?: string; text?: string };
    return data.answer || data.message || data.text || "AskAI returned an empty response.";
  }
  const raw = await response.text();
  if (contentType.includes("text/event-stream")) {
    const pieces = raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => {
      try { const data = JSON.parse(line) as { token?: string; text?: string; content?: string }; return data.token || data.text || data.content || ""; } catch { return line; }
    });
    return pieces.join("") || "AskAI returned an empty response.";
  }
  return raw || "AskAI returned an empty response.";
}
