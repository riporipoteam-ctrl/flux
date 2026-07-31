"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import {
  Bot,
  CircleGauge,
  Code2,
  ExternalLink,
  FileText,
  Gamepad2,
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
import { saveLocalProject, type GeneratedProject } from "@/services/studio-projects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

type Artifact =
  | { id: string; type: "project"; project: GeneratedProject; remoteBuilt: boolean }
  | { id: string; type: "group"; title: string; href: string }
  | { id: string; type: "agent"; title: string; detail: string };

const EXAMPLES = [
  "Search Flux for Ripo Team",
  "Build a mobile city defense game",
  "Create a public group called Game Builders",
  "Explain how WebRTC viewers connect",
];

export default function AskAIUnified() {
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
    setInput("");
    setHistoryOpen(false);
    await refresh();
  };

  const handleSearch = async (conversationId: string, text: string) => {
    const query = text
      .replace(/^(search|find|look up)\s+(flux\s+)?/i, "")
      .replace(/\s+(on|in)\s+flux$/i, "")
      .trim();
    if (query.length < 2) throw new Error("Type at least two characters to search Flux.");
    setStatus("Searching Flux…");
    const found = await searchFlux(query, { max: 32 });
    setResults(found);
    await append(
      conversationId,
      "assistant",
      found.length
        ? `I found ${found.length} public Flux result${found.length === 1 ? "" : "s"} for **${query}**.`
        : `No public Flux result matched **${query}**.`
    );
  };

  const handleProjectCreation = async (conversationId: string, text: string, kind: "game" | "website") => {
    if (!user) return;
    setStatus(endpoint ? `Building the ${kind}…` : `Creating an editable ${kind} starter…`);
    await consumeAskAIRequest(user.uid);
    const project = generateProject({ ownerId: user.uid, kind, prompt: text });
    let remoteBuilt = false;

    if (endpoint) {
      try {
        const prompt = `Create a complete polished browser ${kind} from the request below. Use hand-written HTML, CSS and JavaScript. It must work on phones and desktop. Do not include visible text saying AI-generated, template, placeholder, demo or prototype. Return ONLY one complete HTML document beginning with <!doctype html>.\n\nREQUEST: ${text}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prompt, history: [] }),
        });
        if (!response.ok) throw new Error(`AskAI returned ${response.status}`);
        const raw = await readRemoteResponse(response);
        const completeHtml = extractCompleteHtml(raw);
        if (!completeHtml) throw new Error("AskAI did not return a complete HTML project");
        project.code = completeHtml;
        remoteBuilt = true;
      } catch (error) {
        console.warn("Remote project creation failed; using editable starter", error);
      }
    }

    project.assistantHistory = [
      { id: `user-${Date.now()}`, role: "user", content: text, createdAt: Date.now() },
      {
        id: `assistant-${Date.now() + 1}`,
        role: "assistant",
        content: remoteBuilt
          ? `Built the first version of ${project.title}. Continue editing it in Studio.`
          : `Created an editable starter for ${project.title}. Remote generation was not available, so no AI result is being faked.`,
        createdAt: Date.now() + 1,
      },
    ];
    project.revisions = [];
    saveLocalProject(project);
    setArtifacts([{ id: project.id, type: "project", project, remoteBuilt }]);
    await append(
      conversationId,
      "assistant",
      remoteBuilt
        ? `I built **${project.title}**. Open it in Studio to manually edit HTML, CSS and JavaScript or ask for more changes to the same project.`
        : `I created an editable **${project.title}** starter. The remote AI service was not connected or did not return valid project code, so I did not pretend it generated a finished game. Open Studio to build it manually.`
    );
    await refreshProfile();
  };

  const handleGroupCreation = async (conversationId: string, text: string) => {
    if (!user) return;
    const match = text.match(/(?:group\s+(?:called|named)?|called|named)\s+["']?([^"'.]{2,50})/i);
    const name = (match?.[1] || text.replace(/.*\bgroup\b/i, "")).trim().slice(0, 50) || "New Flux Group";
    setStatus("Creating your group…");
    const groupId = await createGroup({
      ownerId: user.uid,
      name,
      description: `Created from AskAI: ${text.slice(0, 220)}`,
      isPrivate: false,
    });
    setArtifacts([{ id: groupId, type: "group", title: name, href: `/groups/${groupId}` }]);
    await append(conversationId, "assistant", `Created **${name}**. Flux allows one owned group per account.`);
  };

  const handleAgentCreation = async (conversationId: string, text: string) => {
    if (!user) return;
    const match = text.match(/(?:named|called)\s+["']?([a-z0-9 _-]{2,40})/i);
    const name = (match?.[1] || "Flux Agent").replace(/\b(that|which|to)\b.*$/i, "").trim();
    const instructions = text.replace(/.*\bagent\b/i, "").trim() || "Help with creator tasks.";
    setStatus("Saving the agent configuration…");
    const agent = await saveFluxAgent(user.uid, { name, instructions });
    setArtifacts([{ id: agent.id, type: "agent", title: agent.name, detail: agent.instructions }]);
    await append(conversationId, "assistant", `Saved agent configuration **${agent.name}**. It is a saved tool profile, not a continuously running background worker.`);
  };

  const handleRemoteAnswer = async (conversationId: string, text: string) => {
    if (!user) return;
    if (!endpoint) {
      throw new Error("General AskAI answers require a connected remote AI endpoint. Flux Search and local creator actions still work without one.");
    }
    await consumeAskAIRequest(user.uid);
    setStatus("AskAI is responding…");
    const answer = await askRemote(endpoint, text, messages, setStatus, abortRef, user.uid);
    await append(conversationId, "assistant", answer);
    await refreshProfile();
  };

  const send = async (override?: string) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    setStatus("Understanding the request…");
    setResults([]);
    setArtifacts([]);

    try {
      const conversationId = await ensureConversation(text);
      await append(conversationId, "user", text);
      if (!messages.length) void renameConversation(conversationId, text.slice(0, 52));
      const intent = detectIntent(text);
      if (intent === "search") await handleSearch(conversationId, text);
      else if (intent === "game") await handleProjectCreation(conversationId, text, "game");
      else if (intent === "website") await handleProjectCreation(conversationId, text, "website");
      else if (intent === "group") await handleGroupCreation(conversationId, text);
      else if (intent === "agent") await handleAgentCreation(conversationId, text);
      else await handleRemoteAnswer(conversationId, text);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "AskAI could not finish that request.";
      toast.error(message);
      const conversationId = activeId;
      if (conversationId) await append(conversationId, "assistant", `I couldn't finish that request: ${message}`);
    } finally {
      setLoading(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-[#f6f7f9] text-[#111216] dark:bg-black dark:text-white lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[304px] flex-col border-r border-black/6 bg-white transition-transform dark:border-white/10 dark:bg-[#0b0c0e] md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-[61px] items-center gap-2 border-b border-black/6 px-3 dark:border-white/10"><Button onClick={() => void newChat()} className="h-11 flex-1 rounded-full font-black"><Plus className="h-4 w-4" />New chat</Button><button type="button" onClick={() => setHistoryOpen(false)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2"><p className="px-3 pb-2 pt-3 text-[10px] font-black uppercase tracking-[.16em] text-black/35 dark:text-white/30">Recent</p>{conversations.map((conversation) => <div key={conversation.id} className={cn("group flex items-center rounded-xl px-2 hover:bg-black/[.035] dark:hover:bg-white/6", activeId === conversation.id && "bg-black/[.05] dark:bg-white/8")}><button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-2 py-3 text-left text-sm font-bold">{conversation.title}</button><button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground opacity-0 hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button></div>)}</div>
        <div className="border-t border-black/6 p-3 dark:border-white/10"><div className="rounded-2xl bg-black/[.035] p-3 dark:bg-white/6"><div className="flex items-center gap-2"><UserAvatar user={profile} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{profile?.displayName || "Flux user"}</p><p className="truncate text-[10px] text-muted-foreground">{profile?.planTier || "free"} · {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20}</p></div><CircleGauge className="h-4 w-4 text-primary" /></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div></div>
      </aside>
      {historyOpen ? <button type="button" className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[61px] items-center gap-3 border-b border-black/6 bg-white/92 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/90 sm:px-5"><button type="button" onClick={() => setHistoryOpen(true)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted md:hidden" aria-label="Open history"><Menu className="h-5 w-5" /></button><span className="grid h-10 w-10 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h1 className="font-black">AskAI</h1><p className="truncate text-[11px] text-muted-foreground">One input · answers, Flux Search and creator actions</p></div><span className={cn("hidden rounded-full px-3 py-1.5 text-[10px] font-black sm:inline", endpoint ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}>{endpoint ? "Remote answers connected" : "Flux tools only"}</span></header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"><div className="mx-auto max-w-4xl">
          {!messages.length && !loading ? <div className="py-8 sm:py-16"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black"><WandSparkles className="h-7 w-7" /></span><h2 className="mx-auto mt-6 max-w-2xl text-center text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-5xl">Just ask. No modes.</h2><p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-muted-foreground">AskAI automatically decides whether to answer, search Flux, create a project, create your group or save an agent configuration.</p><div className="mx-auto mt-7 flex max-w-2xl flex-wrap justify-center gap-2">{EXAMPLES.map((example) => <button key={example} type="button" onClick={() => void send(example)} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted">{example}</button>)}</div></div> : null}

          <div className="space-y-5">{messages.map((message) => <div key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>{message.role === "assistant" ? <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black"><Sparkles className="h-4 w-4" /></span> : null}<div className={cn("max-w-[88%] rounded-[22px] px-4 py-3 text-sm leading-7 sm:max-w-[78%]", message.role === "user" ? "bg-black text-white dark:bg-white dark:text-black" : "border border-border bg-card")}><ReactMarkdown>{message.content}</ReactMarkdown></div></div>)}</div>
          {status ? <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{status}</div> : null}

          {results.length ? <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">{results.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href} className="flex items-center gap-3 p-4 hover:bg-muted/60"><span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">{result.imageUrl ? <img src={result.imageUrl} alt="" className="h-full w-full object-cover" /> : result.kind === "person" ? <Users className="h-5 w-5" /> : result.kind === "group" ? <Layers3 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{result.title}</b><span className="block truncate text-[10px] text-muted-foreground">{result.subtitle} · {result.meta}</span><span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{result.description}</span></span><ExternalLink className="h-4 w-4 text-muted-foreground" /></Link>)}</div> : null}

          {artifacts.map((artifact) => artifact.type === "project" ? <div key={artifact.id} className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"><div className="h-40" style={{ background: artifact.project.thumbnail }}>{artifact.project.thumbnail.startsWith("data:") ? <img src={artifact.project.thumbnail} alt="" className="h-full w-full object-cover" /> : null}</div><div className="p-4"><div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-muted"><Gamepad2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate font-black">{artifact.project.title}</h3><p className="text-xs text-muted-foreground">{artifact.remoteBuilt ? "Remote first version" : "Editable starter"} · saved on this device</p></div></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setPreview(artifact.project)} className="rounded-full"><Monitor className="h-4 w-4" />Preview</Button><Link href={`/studio?project=${encodeURIComponent(artifact.project.id)}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-black"><Code2 className="h-4 w-4" />Open Studio</Link></div></div></div> : artifact.type === "group" ? <Link key={artifact.id} href={artifact.href} className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><Users className="h-5 w-5 text-primary" /><div className="min-w-0 flex-1"><b className="block truncate">{artifact.title}</b><p className="text-xs text-muted-foreground">Open your group</p></div><ExternalLink className="h-4 w-4" /></Link> : <div key={artifact.id} className="mt-6 flex items-center gap-3 rounded-2xl border border-border bg-card p-4"><Bot className="h-5 w-5 text-emerald-500" /><div><b>{artifact.title}</b><p className="line-clamp-2 text-xs text-muted-foreground">{artifact.detail}</p></div></div>)}
          <div ref={bottomRef} />
        </div></div>

        <footer className="border-t border-border bg-background p-3 sm:p-4"><div className="mx-auto max-w-4xl"><div className="relative rounded-[24px] border border-border bg-muted/40 p-2"><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask anything, search Flux, or create something…" className="min-h-12 resize-none border-0 bg-transparent px-3 py-3 pr-14 shadow-none focus-visible:ring-0" /><button type="button" onClick={() => loading ? (abortRef.current?.abort(), setLoading(false)) : void send()} disabled={!loading && !input.trim()} className="absolute bottom-2.5 right-2.5 grid h-10 w-10 place-items-center rounded-full bg-foreground text-background disabled:opacity-30">{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button></div></div></footer>
      </section>

      {preview ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-2 sm:p-5"><div className="flex h-[min(92dvh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#0b0c0f]"><div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 text-white"><Gamepad2 className="h-5 w-5" /><b className="min-w-0 flex-1 truncate">{preview.title}</b><Link href={`/studio?project=${encodeURIComponent(preview.id)}`} className="hidden rounded-full bg-white px-4 py-2 text-xs font-black text-black sm:inline-flex">Edit in Studio</Link><button type="button" onClick={() => setPreview(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/8"><X className="h-5 w-5" /></button></div><iframe title={preview.title} srcDoc={preview.code} sandbox="allow-scripts allow-pointer-lock" className="min-h-0 flex-1 border-0 bg-black" /></div></div> : null}
    </main>
  );
}

function detectIntent(text: string): "search" | "game" | "website" | "group" | "agent" | "answer" {
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

async function askRemote(endpoint: string, text: string, history: AIMessage[], onStatus: (value: string) => void, abortRef: MutableRefObject<AbortController | null>, uid: string): Promise<string> {
  const controller = new AbortController();
  abortRef.current = controller;
  onStatus("AskAI is responding…");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      uid,
      message: text,
      history: history.slice(-16).map(({ role, content }) => ({ role, content })),
    }),
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
