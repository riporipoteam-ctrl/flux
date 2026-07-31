"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  ChevronRight,
  CircleGauge,
  Code2,
  ExternalLink,
  FileText,
  Gamepad2,
  History,
  Layers3,
  Loader2,
  Menu,
  Monitor,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  Users,
  WandSparkles,
  Wifi,
  WifiOff,
  X,
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
import { searchFlux, type FluxSearchResult } from "@/services/flux-search";
import { createGroup } from "@/services/groups";
import { consumeAskAIRequest, saveFluxAgent, usagePercent } from "@/services/flux-platform";
import { generateProject } from "@/lib/project-generator";
import { runLocalAskAI } from "@/lib/local-ask-ai";
import { saveLocalProject, type GeneratedProject } from "@/services/studio-projects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

type Artifact =
  | { id: string; type: "project"; project: GeneratedProject; remoteBuilt: boolean }
  | { id: string; type: "group"; title: string; href: string }
  | { id: string; type: "agent"; title: string; detail: string };

type Intent = "search" | "game" | "website" | "group" | "agent" | "answer";

const STARTERS = [
  { label: "Rewrite", prompt: "Rewrite: " },
  { label: "Summarize", prompt: "Summarize: " },
  { label: "Caption", prompt: "Create a caption for " },
  { label: "Hashtags", prompt: "Create hashtags for " },
  { label: "Brainstorm", prompt: "Brainstorm ideas for " },
  { label: "Build game", prompt: "Build a mobile game about " },
];

export default function AskAIProduct() {
  const { user, profile, refreshProfile } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<FluxSearchResult[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [preview, setPreview] = useState<GeneratedProject | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [lastEngine, setLastEngine] = useState<"local" | "remote" | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const endpoint = useMemo(resolveEndpoint, []);
  const percent = usagePercent(profile);

  const refresh = useCallback(async () => {
    if (!user) return;
    setConversations(await listConversations(user.uid).catch(() => []));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setResults([]);
    setArtifacts([]);
    setSuggestions([]);
    if (!activeId) {
      setMessages([]);
      return;
    }
    getMessages(activeId).then(setMessages).catch(() => setMessages([]));
  }, [activeId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [artifacts, loading, messages, results]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const ensureConversation = async (title: string): Promise<string> => {
    if (activeId) return activeId;
    if (!user) throw new Error("Sign in to use AskAI.");
    const id = await createConversation(user.uid, title.slice(0, 52) || "New chat");
    setActiveId(id);
    return id;
  };

  const append = async (conversationId: string, role: "user" | "assistant", content: string, meta?: Record<string, unknown>) => {
    const item: AIMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      meta,
      createdAt: null,
    };
    setMessages((current) => [...current, item]);
    await addMessage(conversationId, { role, content, meta });
  };

  const newChat = async () => {
    if (!user) return;
    const id = await createConversation(user.uid, "New chat");
    setActiveId(id);
    setMessages([]);
    setResults([]);
    setArtifacts([]);
    setSuggestions([]);
    setInput("");
    setHistoryOpen(false);
    await refresh();
  };

  const search = async (conversationId: string, text: string) => {
    const query = text.replace(/^(search|find|look up)\s+(flux\s+)?/i, "").replace(/\s+(on|in)\s+flux$/i, "").trim();
    if (query.length < 2) throw new Error("Type at least two characters to search Flux.");
    setStatus("Searching Flux");
    const found = await searchFlux(query, { max: 32 });
    setResults(found);
    setLastEngine("local");
    await append(conversationId, "assistant", found.length ? `Found ${found.length} public Flux result${found.length === 1 ? "" : "s"} for **${query}**.` : `No public Flux result matched **${query}**.`);
  };

  const createProject = async (conversationId: string, text: string, kind: "game" | "website") => {
    if (!user) return;
    setStatus(endpoint ? `Building ${kind}` : `Creating editable ${kind}`);
    const project = generateProject({ ownerId: user.uid, kind, prompt: text });
    let remoteBuilt = false;

    if (endpoint) {
      try {
        await consumeAskAIRequest(user.uid);
        const prompt = `Create one complete polished browser ${kind}. Use hand-written responsive HTML, CSS and JavaScript. Return ONLY one complete HTML document beginning with <!doctype html>. User request: ${text}`;
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: user.uid, message: prompt, history: [] }) });
        if (!response.ok) throw new Error(`AskAI returned ${response.status}`);
        const raw = await readRemoteResponse(response);
        const html = extractCompleteHtml(raw);
        if (!html) throw new Error("No complete project returned");
        project.code = html;
        remoteBuilt = true;
        setLastEngine("remote");
      } catch (error) {
        console.warn("Remote project build failed, using local editable starter", error);
      }
    }

    if (!remoteBuilt) setLastEngine("local");
    project.assistantHistory = [
      { id: `u-${Date.now()}`, role: "user", content: text, createdAt: Date.now() },
      { id: `a-${Date.now() + 1}`, role: "assistant", content: remoteBuilt ? "Created the first remote version." : "Created an editable local starter.", createdAt: Date.now() + 1 },
    ];
    project.revisions = [];
    saveLocalProject(project);
    setArtifacts([{ id: project.id, type: "project", project, remoteBuilt }]);
    await append(conversationId, "assistant", remoteBuilt
      ? `I built **${project.title}**. Open it in Studio for visual editing, code editing and follow-up changes.`
      : `I created an editable local **${project.title}** starter. It works without a remote model and can be changed visually or in code inside Studio.`);
    await refreshProfile();
  };

  const createCommunity = async (conversationId: string, text: string) => {
    if (!user) return;
    const match = text.match(/(?:group\s+(?:called|named)?|called|named)\s+["']?([^"'.]{2,50})/i);
    const name = (match?.[1] || text.replace(/.*\bgroup\b/i, "")).trim().slice(0, 50) || "New Flux Group";
    setStatus("Creating group");
    const groupId = await createGroup({ ownerId: user.uid, name, description: `Created from AskAI: ${text.slice(0, 220)}`, isPrivate: false });
    setArtifacts([{ id: groupId, type: "group", title: name, href: `/groups/${groupId}` }]);
    setLastEngine("local");
    await append(conversationId, "assistant", `Created **${name}**. Open it to add members, posts and community details.`);
  };

  const createAgent = async (conversationId: string, text: string) => {
    if (!user) return;
    const match = text.match(/(?:named|called)\s+["']?([a-z0-9 _-]{2,40})/i);
    const name = (match?.[1] || "Flux Agent").replace(/\b(that|which|to)\b.*$/i, "").trim();
    const instructions = text.replace(/.*\bagent\b/i, "").trim() || "Help with creator tasks.";
    const agent = await saveFluxAgent(user.uid, { name, instructions });
    setArtifacts([{ id: agent.id, type: "agent", title: agent.name, detail: agent.instructions }]);
    setLastEngine("local");
    await append(conversationId, "assistant", `Saved **${agent.name}** as a reusable agent configuration.`);
  };

  const answer = async (conversationId: string, text: string) => {
    if (!user) return;
    if (endpoint) {
      try {
        setStatus("Using connected AskAI");
        await consumeAskAIRequest(user.uid);
        const remote = await askRemote(endpoint, text, messages, abortRef, user.uid);
        setLastEngine("remote");
        setSuggestions(["Rewrite that more simply", "Give me a plan", "Create a post caption"]);
        await append(conversationId, "assistant", remote);
        await refreshProfile();
        return;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") throw error;
        console.warn("Remote AskAI failed; local fallback used", error);
        toast.message("Remote AskAI was unavailable, so Flux used the local engine.");
      }
    }

    setStatus("Using local AskAI");
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const local = runLocalAskAI(text);
    setLastEngine("local");
    setSuggestions(local.suggestions);
    await append(conversationId, "assistant", `### ${local.title}\n\n${local.answer}`, { engine: "local", intent: local.intent });
  };

  const send = async (override?: string) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    setStatus("Understanding request");
    setResults([]);
    setArtifacts([]);
    setSuggestions([]);

    let conversationId: string | null = null;
    try {
      conversationId = await ensureConversation(text);
      await append(conversationId, "user", text);
      if (!messages.length) void renameConversation(conversationId, text.slice(0, 52));
      const intent = detectIntent(text);
      if (intent === "search") await search(conversationId, text);
      else if (intent === "game") await createProject(conversationId, text, "game");
      else if (intent === "website") await createProject(conversationId, text, "website");
      else if (intent === "group") await createCommunity(conversationId, text);
      else if (intent === "agent") await createAgent(conversationId, text);
      else await answer(conversationId, text);
      await refresh();
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "AskAI could not finish that request.";
      toast.error(message);
      if (conversationId) await append(conversationId, "assistant", `I couldn't finish that request: ${message}`);
    } finally {
      setLoading(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const hasConversation = messages.length > 0 || loading;

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-white text-[#111] dark:bg-[#090909] dark:text-white lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[70] flex w-[286px] flex-col border-r border-black/8 bg-[#f7f7f7] transition-transform dark:border-white/10 dark:bg-[#111] md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-16 items-center gap-2 px-3"><Button onClick={() => void newChat()} className="h-11 flex-1 justify-start rounded-xl bg-black px-4 font-bold text-white hover:bg-black/85 dark:bg-white dark:text-black"><Plus className="h-4 w-4" />New conversation</Button><button type="button" onClick={() => setHistoryOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/8 md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"><div className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-black/35 dark:text-white/32"><History className="h-3.5 w-3.5" />History</div>{conversations.map((conversation) => <div key={conversation.id} className={cn("group flex items-center rounded-xl", activeId === conversation.id ? "bg-white shadow-sm dark:bg-white/8" : "hover:bg-black/4 dark:hover:bg-white/5")}><button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-3 py-3 text-left text-[13px] font-semibold">{conversation.title}</button><button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="mr-1 grid h-8 w-8 place-items-center rounded-lg text-black/25 opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100 dark:text-white/25" aria-label="Delete chat"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
        <div className="border-t border-black/8 p-3 dark:border-white/10"><div className="flex items-center gap-3"><UserAvatar user={profile} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{profile?.displayName || "Flux user"}</p><p className="truncate text-[10px] text-black/40 dark:text-white/35">{profile?.planTier || "free"} · {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20} remote</p></div><CircleGauge className="h-4 w-4 text-black/40 dark:text-white/40" /></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-black/8 dark:bg-white/10"><div className="h-full bg-black dark:bg-white" style={{ width: `${percent}%` }} /></div></div>
      </aside>
      {historyOpen ? <button type="button" className="fixed inset-0 z-[60] bg-black/35 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-3 border-b border-black/8 px-3 dark:border-white/10 sm:px-5"><button type="button" onClick={() => setHistoryOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/8 md:hidden" aria-label="Open history"><Menu className="h-5 w-5" /></button><span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h1 className="text-[15px] font-black">AskAI</h1><p className="truncate text-[11px] text-black/40 dark:text-white/38">One input. Local first. Remote when available.</p></div><div className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-[10px] font-bold dark:border-white/12">{endpoint ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-amber-500" />}<span className="hidden sm:inline">{endpoint ? "Local + remote" : "Local ready"}</span></div></header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6 sm:px-6"><div className="mx-auto max-w-3xl">
          {!hasConversation ? <div className="flex min-h-[58dvh] flex-col justify-center"><h2 className="max-w-2xl text-4xl font-black leading-[.98] tracking-[-.055em] sm:text-6xl">What are we making?</h2><p className="mt-4 max-w-xl text-sm leading-6 text-black/48 dark:text-white/42">Ask a question, rewrite text, create captions, search Flux or start a game. Local tools work even when the remote model is offline.</p><div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">{STARTERS.map((starter) => <button key={starter.label} type="button" onClick={() => setInput(starter.prompt)} className="group flex min-h-20 flex-col justify-between rounded-2xl border border-black/10 p-3 text-left transition hover:-translate-y-0.5 hover:border-black/25 dark:border-white/12 dark:hover:border-white/25"><span className="text-sm font-bold">{starter.label}</span><ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-1 dark:text-white/30" /></button>)}</div></div> : null}

          <div className="space-y-5">{messages.map((message) => <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}><div className={cn("max-w-[92%] text-[14px] leading-7 sm:max-w-[78%]", message.role === "user" ? "rounded-2xl rounded-br-md bg-black px-4 py-3 text-white dark:bg-white dark:text-black" : "pr-2 text-black/82 dark:text-white/82")}><ReactMarkdown>{message.content}</ReactMarkdown></div></div>)}</div>
          {status ? <div className="mt-5 flex items-center gap-2 text-xs text-black/45 dark:text-white/40"><Loader2 className="h-4 w-4 animate-spin" />{status}</div> : null}

          {results.length ? <div className="mt-6 overflow-hidden border-y border-black/8 dark:border-white/10">{results.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="flex items-center gap-3 border-b border-black/8 py-4 last:border-0 hover:opacity-70 dark:border-white/10"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-black/5 dark:bg-white/8">{result.imageUrl ? <img src={result.imageUrl} alt="" className="h-full w-full object-cover" /> : result.kind === "person" ? <Users className="h-5 w-5" /> : result.kind === "group" ? <Layers3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{result.title}</b><span className="block truncate text-[10px] text-black/40 dark:text-white/35">{result.subtitle} · {result.meta}</span><span className="mt-1 line-clamp-2 block text-xs text-black/50 dark:text-white/45">{result.description}</span></span><ExternalLink className="h-4 w-4 text-black/25 dark:text-white/25" /></Link>)}</div> : null}

          {artifacts.map((artifact) => artifact.type === "project" ? <div key={artifact.id} className="mt-6 overflow-hidden rounded-2xl border border-black/10 dark:border-white/12"><div className="h-44" style={{ background: artifact.project.thumbnail }}>{artifact.project.thumbnail.startsWith("data:") ? <img src={artifact.project.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</div><div className="p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-black/5 dark:bg-white/8"><Gamepad2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-black">{artifact.project.title}</h3><p className="text-xs text-black/42 dark:text-white/38">{artifact.remoteBuilt ? "Remote first version" : "Local editable starter"}</p></div></div><div className="mt-4 flex gap-2"><Button onClick={() => setPreview(artifact.project)} className="rounded-xl"><Monitor className="h-4 w-4" />Preview</Button><Link href={`/studio?project=${encodeURIComponent(artifact.project.id)}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/10 px-4 text-sm font-bold dark:border-white/12"><Code2 className="h-4 w-4" />Open Studio</Link></div></div></div> : artifact.type === "group" ? <Link key={artifact.id} href={artifact.href} className="mt-6 flex items-center gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/12"><Users className="h-5 w-5" /><div className="min-w-0 flex-1"><b className="block truncate">{artifact.title}</b><p className="text-xs text-black/42 dark:text-white/38">Open group</p></div><ExternalLink className="h-4 w-4" /></Link> : <div key={artifact.id} className="mt-6 flex items-center gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/12"><Bot className="h-5 w-5" /><div><b>{artifact.title}</b><p className="line-clamp-2 text-xs text-black/42 dark:text-white/38">{artifact.detail}</p></div></div>)}

          {suggestions.length && !loading ? <div className="mt-6 flex flex-wrap gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold hover:bg-black/4 dark:border-white/12 dark:hover:bg-white/6">{suggestion}</button>)}</div> : null}
          <div ref={bottomRef} />
        </div></div>

        <footer className="border-t border-black/8 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#090909] sm:px-6"><div className="mx-auto max-w-3xl"><div className="rounded-2xl border border-black/12 bg-[#f7f7f7] p-2 dark:border-white/14 dark:bg-[#121212]"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask, rewrite, search or create…" className="min-h-14 resize-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between px-2 pb-1"><span className="flex items-center gap-1.5 text-[10px] font-semibold text-black/38 dark:text-white/34">{lastEngine === "remote" ? <Wifi className="h-3.5 w-3.5" /> : <WandSparkles className="h-3.5 w-3.5" />}{lastEngine === "remote" ? "Remote answer" : lastEngine === "local" ? "Local answer" : "Automatic engine"}</span><button type="button" onClick={() => loading ? (abortRef.current?.abort(), setLoading(false)) : void send()} disabled={!loading && !input.trim()} className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white disabled:opacity-25 dark:bg-white dark:text-black">{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button></div></div></div></footer>
      </section>

      {preview ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/82 p-2 sm:p-5"><div className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#0b0c0f]"><div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 text-white"><Gamepad2 className="h-5 w-5" /><b className="min-w-0 flex-1 truncate">{preview.title}</b><Link href={`/studio?project=${encodeURIComponent(preview.id)}`} className="hidden rounded-xl bg-white px-4 py-2 text-xs font-black text-black sm:inline-flex">Edit in Studio</Link><button type="button" onClick={() => setPreview(null)} className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/8"><X className="h-5 w-5" /></button></div><iframe title={preview.title} srcDoc={preview.code} sandbox="allow-scripts allow-pointer-lock" className="min-h-0 flex-1 border-0 bg-black" /></div></div> : null}
    </main>
  );
}

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase();
  if (/^(search|find|look up)\b/.test(lower) || /\b(search|find)\s+(on|in)\s+flux\b/.test(lower)) return "search";
  if (/\b(make|build|create|generate)\b/.test(lower) && /\b(game|experience)\b/.test(lower)) return "game";
  if (/\b(make|build|create|generate)\b/.test(lower) && /\b(website|site|landing page)\b/.test(lower)) return "website";
  if (/\b(make|create)\b/.test(lower) && /\bgroup\b/.test(lower)) return "group";
  if (/\b(make|create|save)\b/.test(lower) && /\bagent\b/.test(lower)) return "agent";
  return "answer";
}

function resolveEndpoint(): string | null {
  const configured = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT?.trim() || process.env.NEXT_PUBLIC_ASK_AI_ENDPOINT?.trim();
  return configured || (process.env.NEXT_PUBLIC_BASE_PATH ? null : "/api/ask-ai");
}

async function askRemote(endpoint: string, text: string, history: AIMessage[], abortRef: React.MutableRefObject<AbortController | null>, uid: string): Promise<string> {
  const controller = new AbortController();
  abortRef.current = controller;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, message: text, history: history.slice(-16).map(({ role, content }) => ({ role, content })) }),
    signal: controller.signal,
  });
  if (!response.ok) throw new Error(`AskAI service returned ${response.status}`);
  return readRemoteResponse(response);
}

async function readRemoteResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json() as { answer?: string; message?: string; text?: string; content?: string };
    return data.answer || data.message || data.text || data.content || "AskAI returned an empty response.";
  }
  const raw = await response.text();
  if (!contentType.includes("text/event-stream")) return raw || "AskAI returned an empty response.";
  return raw.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => {
    try {
      const data = JSON.parse(line) as { token?: string; text?: string; content?: string };
      return data.token || data.text || data.content || "";
    } catch {
      return line;
    }
  }).join("") || "AskAI returned an empty response.";
}

function extractCompleteHtml(raw: string): string | null {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw.trim();
  const doctypeIndex = candidate.toLowerCase().indexOf("<!doctype");
  const htmlIndex = candidate.toLowerCase().indexOf("<html");
  const start = doctypeIndex >= 0 ? doctypeIndex : htmlIndex;
  if (start < 0 || !candidate.toLowerCase().includes("</html>")) return null;
  return candidate.slice(start, candidate.toLowerCase().lastIndexOf("</html>") + 7).trim();
}
