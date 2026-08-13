"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  FileText,
  Globe2,
  Loader2,
  Menu,
  MessageSquarePlus,
  Paperclip,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
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
import { runAskAIGroq, type AskAIGroqMode, type AskAIGroqSource } from "@/lib/ai/askai-groq";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

const MODE_KEY = "flux-askai-groq-mode";

type AttachedFile = { id: string; name: string; text: string; size: number };

export default function AskAIGroqWorkspace() {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<AskAIGroqMode>("instant");
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [research, setResearch] = useState(false);
  const [codeExecution, setCodeExecution] = useState(false);
  const [sources, setSources] = useState<AskAIGroqSource[]>([]);
  const [fluxResults, setFluxResults] = useState<FluxSearchResult[]>([]);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [lastModel, setLastModel] = useState("qwen3:4b-instruct");
  const [lastProvider, setLastProvider] = useState("ripo-local");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "instant" || saved === "pro") setMode(saved);
  }, []);

  const refreshThreads = useCallback(async () => {
    if (!user) return;
    setConversations(await listConversations(user.uid).catch(() => []));
  }, [user]);

  useEffect(() => { void refreshThreads(); }, [refreshThreads]);

  useEffect(() => {
    setSources([]);
    setFluxResults([]);
    if (!activeId) {
      setMessages([]);
      return;
    }
    getMessages(activeId).then(setMessages).catch(() => {
      setMessages([]);
      toast.error("Could not load this AskAI thread.");
    });
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [loading, messages, sources, fluxResults]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const changeMode = (next: AskAIGroqMode) => {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };

  const newThread = async () => {
    if (!user) return;
    try {
      const id = await createConversation(user.uid, "New chat");
      setActiveId(id);
      setMessages([]);
      setSources([]);
      setFluxResults([]);
      setLeftOpen(false);
      await refreshThreads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create chat");
    }
  };

  const removeThread = async (thread: AIConversation) => {
    try {
      await deleteConversation(thread.id);
      if (activeId === thread.id) setActiveId(null);
      await refreshThreads();
    } catch {
      toast.error("Could not delete this chat.");
    }
  };

  const ensureThread = async (text: string): Promise<string> => {
    if (activeId) return activeId;
    if (!user) throw new Error("Sign in to use AskAI.");
    const id = await createConversation(user.uid, titleFromText(text));
    setActiveId(id);
    return id;
  };

  const append = async (threadId: string, role: "user" | "assistant", content: string, meta?: Record<string, unknown>) => {
    const item: AIMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      meta,
      createdAt: null,
    };
    setMessages((current) => [...current, item]);
    await addMessage(threadId, { role, content, meta }).catch(() => undefined);
  };

  const send = async () => {
    if (!user || loading) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    setSources([]);
    setFluxResults([]);
    const controller = new AbortController();
    abortRef.current = controller;
    let threadId: string | null = null;

    try {
      threadId = await ensureThread(text);
      await append(threadId, "user", text, { mode, files: files.map((file) => file.name) });
      if (!messages.length) void renameConversation(threadId, titleFromText(text));

      if (isFluxSearch(text)) {
        setStatus("Searching Flux…");
        const query = cleanFluxQuery(text);
        const found = await searchFlux(query, { max: 30 });
        setFluxResults(found);
        await append(threadId, "assistant", found.length
          ? `I found **${found.length}** public Flux result${found.length === 1 ? "" : "s"} for **${query}**.`
          : `I couldn't find public Flux results for **${query}**.`, { tool: "flux-search" });
      } else {
        const workspaceContext = files.length
          ? `Attached files:\n${files.map((file) => `--- ${file.name} ---\n${file.text}`).join("\n\n").slice(0, 30_000)}`
          : "";
        const cloudToolsOn = mode === "pro" && (research || codeExecution);
        setStatus(cloudToolsOn
          ? "AskAI Pro is using its connected tools…"
          : mode === "pro"
            ? "AskAI Pro is reasoning on the Ripo Team AI server…"
            : "AskAI Instant is answering on the Ripo Team AI server…");
        const result = await runAskAIGroq({
          mode,
          signal: controller.signal,
          research: mode === "pro" && research,
          codeExecution: mode === "pro" && codeExecution,
          workspaceContext,
          messages: [...messages, { id: "current", role: "user", content: text, createdAt: null }]
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
        });
        setLastModel(result.model);
        setLastProvider(result.provider || "unknown");
        setSources(result.sources);
        await append(threadId, "assistant", result.answer, {
          mode,
          model: result.model,
          provider: result.provider,
          sources: result.sources,
        });
      }
      await refreshThreads();
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "AskAI could not finish that request.";
      toast.error(message);
      if (threadId) await append(threadId, "assistant", message, { error: true, mode });
    } finally {
      setLoading(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
    setStatus(null);
  };

  const attachFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []).slice(0, 5);
    for (const file of incoming) {
      if (file.size > 2_000_000) {
        toast.error(`${file.name} is over 2 MB.`);
        continue;
      }
      if (!isTextFile(file)) {
        toast.error(`${file.name}: AskAI currently reads text and code files.`);
        continue;
      }
      const text = (await file.text()).slice(0, 100_000);
      setFiles((current) => [...current, { id: crypto.randomUUID(), name: file.name, text, size: file.size }].slice(-8));
    }
    event.target.value = "";
  };

  const filteredThreads = useMemo(
    () => conversations.filter((thread) => thread.title.toLowerCase().includes(threadSearch.toLowerCase())),
    [conversations, threadSearch]
  );

  const cloudToolsOn = mode === "pro" && (research || codeExecution);

  return (
    <main className="askx-shell">
      <aside className={cn("askx-sidebar", leftOpen && "is-open")}>
        <header className="askx-sidebar-header">
          <Link href="/home" aria-label="Return to Flux"><ArrowLeft className="h-5 w-5" /></Link>
          <strong>AskAI</strong>
          <button type="button" onClick={() => setLeftOpen(false)} className="askx-mobile-only" aria-label="Close chats"><X className="h-5 w-5" /></button>
        </header>
        <button type="button" className="askx-new-chat" onClick={() => void newThread()}><MessageSquarePlus className="h-5 w-5" />New chat</button>
        <label className="askx-thread-search"><Search className="h-4 w-4" /><input value={threadSearch} onChange={(event) => setThreadSearch(event.target.value)} placeholder="Search chats" /></label>
        <div className="askx-thread-list no-scrollbar">
          {filteredThreads.map((thread) => <div key={thread.id} className={cn("askx-thread-row", activeId === thread.id && "is-active")}><button type="button" onClick={() => { setActiveId(thread.id); setLeftOpen(false); }}>{thread.title}</button><button type="button" onClick={() => void removeThread(thread)} aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button></div>)}
        </div>
        <footer className="askx-sidebar-account"><UserAvatar user={profile} size="sm" clickable={false} /><div><strong>{profile?.displayName || "Flux user"}</strong><span>@{profile?.username || "user"}</span></div></footer>
      </aside>

      {leftOpen ? <button type="button" className="askx-overlay" onClick={() => setLeftOpen(false)} aria-label="Close chats" /> : null}

      <section className="askx-chat">
        <header className="askx-chat-header">
          <button type="button" className="askx-mobile-menu" onClick={() => setLeftOpen(true)} aria-label="Open chats"><Menu className="h-5 w-5" /></button>
          <div className="askx-chat-title"><Sparkles className="h-5 w-5" /><div><strong>AskAI</strong><span>{cloudToolsOn ? "Connected tools" : "Ripo Local · Qwen3 4B"}</span></div></div>
          <div className="askx-model-switch" aria-label="AskAI mode">
            <button type="button" className={mode === "instant" ? "is-active" : ""} onClick={() => changeMode("instant")}><Zap className="h-4 w-4" /><span>Instant</span></button>
            <button type="button" className={mode === "pro" ? "is-active" : ""} onClick={() => changeMode("pro")}><Sparkles className="h-4 w-4" /><span>Pro</span></button>
          </div>
          <button type="button" className="askx-context-button" onClick={() => setRightOpen((value) => !value)} aria-label="Open tools"><Globe2 className="h-5 w-5" /></button>
        </header>

        <div className="askx-model-note"><Check className="h-4 w-4" /><span>{cloudToolsOn ? "Connected tools are enabled for this Pro request." : mode === "pro" ? "Self-hosted Qwen with a larger context budget for deeper answers." : "Self-hosted Qwen tuned for fast everyday answers."}</span></div>

        <div className="askx-scroll no-scrollbar">
          {!messages.length && !loading ? <div className="askx-empty"><span><Sparkles className="h-8 w-8" /></span><h1>What can I help with?</h1><p>Chat, analyze files, explain code or search public Flux content.</p><div className="askx-starters">{["Write a natural Flux post", "Explain this code", "Plan a browser game", "Search Flux for gaming posts"].map((starter) => <button key={starter} type="button" onClick={() => setInput(starter)}>{starter}</button>)}</div></div> : <div className="askx-messages">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{status ? <div className="askx-status"><Loader2 className="h-4 w-4 animate-spin" />{status}</div> : null}{fluxResults.length ? <div className="askx-results">{fluxResults.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href}><span className="askx-result-image">{result.imageUrl ? <img src={result.imageUrl} alt="" /> : <Search className="h-5 w-5" />}</span><div><strong>{result.title}</strong><small>{result.subtitle} · {result.meta}</small><p>{result.description}</p></div></Link>)}</div> : null}<div ref={bottomRef} /></div>}
        </div>

        <footer className="askx-composer-wrap">
          {files.length ? <div className="askx-file-chips">{files.map((file) => <button key={file.id} type="button" onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}><FileText className="h-4 w-4" /><span>{file.name}</span><X className="h-3.5 w-3.5" /></button>)}</div> : null}
          <form className="askx-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
            <input ref={fileInputRef} type="file" multiple className="hidden" accept=".txt,.md,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx" onChange={(event) => void attachFiles(event)} />
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach files"><Paperclip className="h-5 w-5" /></button>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={`Message AskAI ${mode === "pro" ? "Pro" : "Instant"}…`} rows={1} />
            <button type={loading ? "button" : "submit"} onClick={loading ? stop : undefined} disabled={!loading && !input.trim()} className="askx-send">{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button>
          </form>
          <p>Primary AI runs on Ripo Team infrastructure behind an authenticated Firebase gateway. Verify important information.</p>
        </footer>
      </section>

      <aside className={cn("askx-context", rightOpen && "is-open")}>
        <header><strong>Tools & model</strong><button type="button" onClick={() => setRightOpen(false)} aria-label="Close panel"><X className="h-4 w-4" /></button></header>
        <section><h2>Current engine</h2><div className="askx-context-card"><strong>{lastProvider === "ripo-local" ? "Ripo Local" : lastProvider}</strong><p>{lastModel} · {mode === "pro" ? "larger context" : "fast context"}</p></div></section>
        <section><h2>Optional Pro tools</h2><label className="askx-context-card flex cursor-pointer items-center gap-3"><input type="checkbox" checked={research} disabled={mode !== "pro"} onChange={(event) => setResearch(event.target.checked)} /><Globe2 className="h-4 w-4" /><div><strong>Web research</strong><p>Use the connected research provider for live web information and citations.</p></div></label><label className="askx-context-card mt-2 flex cursor-pointer items-center gap-3"><input type="checkbox" checked={codeExecution} disabled={mode !== "pro"} onChange={(event) => setCodeExecution(event.target.checked)} /><Code2 className="h-4 w-4" /><div><strong>Cloud compute</strong><p>Use the connected compute provider for calculations when needed.</p></div></label></section>
        <section><h2>Sources</h2>{sources.length ? <div className="askx-source-list">{sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{index + 1}</span><div><strong>{source.title}</strong><p>{source.url}</p></div></a>)}</div> : <p className="askx-context-empty">Sources appear here when a connected research tool is used.</p>}</section>
      </aside>
    </main>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  return <div className={cn("askx-message", isUser ? "is-user" : "is-assistant")}>{!isUser ? <span className="askx-assistant-mark"><Sparkles className="h-4 w-4" /></span> : null}<div className="askx-message-body"><ReactMarkdown>{message.content}</ReactMarkdown>{!isUser ? <button type="button" className="askx-copy" onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1200); }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button> : null}</div></div>;
}

function titleFromText(text: string): string {
  return text.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ").slice(0, 70) || "New chat";
}

function isFluxSearch(text: string): boolean {
  return /\b(search|find|look up)\b/i.test(text) && /\bflux\b/i.test(text);
}

function cleanFluxQuery(text: string): string {
  return text.replace(/^(search|find|look up)\s+(on\s+|in\s+)?flux\s+(for\s+)?/i, "").replace(/\s+(on|in)\s+flux$/i, "").trim();
}

function isTextFile(file: File): boolean {
  return file.type.startsWith("text/") || /\.(txt|md|json|csv|html|css|js|ts|tsx|jsx)$/i.test(file.name);
}
