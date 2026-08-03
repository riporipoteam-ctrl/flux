"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Globe2,
  Loader2,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
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
import { runLocalAskAI } from "@/lib/local-ask-ai";
import {
  getLocalAskAIStatus,
  localAskAISupported,
  streamLocalAskAI,
  subscribeLocalAskAIStatus,
  type LocalAskAIStatus,
} from "@/lib/ai/local-web-llm";
import {
  getAskAIProEndpoint,
  getAskAIResearchEndpoint,
  runAskAIPro,
  searchConnectedWeb,
  type AskAIResearchSource,
} from "@/lib/ai/askai-pro";
import {
  buildAskAIWorkspaceContext,
  listAskAIAgents,
  listAskAIFiles,
  saveAskAIFile,
  type AskAIWorkspaceFile,
} from "@/lib/askai-workspace";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

type AskAIMode = "instant" | "pro";

const MODE_KEY = "flux-askai-1-mode";

export default function AskAIWorkspaceV2() {
  const { user, profile } = useAuth();
  const [mode, setMode] = useState<AskAIMode>("instant");
  const [localStatus, setLocalStatus] = useState<LocalAskAIStatus>(() => getLocalAskAIStatus());
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [threadSearch, setThreadSearch] = useState("");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [fluxResults, setFluxResults] = useState<FluxSearchResult[]>([]);
  const [sources, setSources] = useState<AskAIResearchSource[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<AskAIWorkspaceFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const proEndpoint = useMemo(getAskAIProEndpoint, []);
  const researchEndpoint = useMemo(getAskAIResearchEndpoint, []);

  useEffect(() => {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "instant" || saved === "pro") setMode(saved);
    setWorkspaceFiles(listAskAIFiles());
    return subscribeLocalAskAIStatus(setLocalStatus);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const local = readLocalConversations(user.uid);
    const remote = await listConversations(user.uid).catch(() => []);
    const merged = [...remote];
    for (const item of local) if (!merged.some((current) => current.id === item.id)) merged.push(item);
    setConversations(merged.sort((a, b) => conversationTime(b) - conversationTime(a)));
  }, [user]);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);

  useEffect(() => {
    setFluxResults([]);
    setSources([]);
    if (!activeId || !user) {
      setMessages([]);
      return;
    }
    if (activeId.startsWith("local-")) {
      setMessages(readLocalMessages(user.uid, activeId));
      return;
    }
    getMessages(activeId)
      .then((items) => setMessages(items.length ? items : readLocalMessages(user.uid, activeId)))
      .catch(() => setMessages(readLocalMessages(user.uid, activeId)));
  }, [activeId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sources, streaming, fluxResults]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const changeMode = (next: AskAIMode) => {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
  };

  const ensureConversation = async (title: string): Promise<string> => {
    if (activeId) return activeId;
    if (!user) throw new Error("Sign in to use AskAI.");
    try {
      const id = await createConversation(user.uid, titleFromText(title));
      setActiveId(id);
      return id;
    } catch {
      const id = `local-${Date.now()}`;
      saveLocalConversation(user.uid, { id, userId: user.uid, title: titleFromText(title), updatedAt: null, createdAt: Date.now() });
      setActiveId(id);
      return id;
    }
  };

  const append = async (conversationId: string, role: "user" | "assistant", content: string, meta?: Record<string, unknown>) => {
    if (!user) return;
    const item: AIMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      meta,
      createdAt: null,
    };
    setMessages((current) => [...current, item]);
    saveLocalMessage(user.uid, conversationId, item);
    if (!conversationId.startsWith("local-")) {
      await addMessage(conversationId, { role, content, meta }).catch(() => undefined);
    }
  };

  const newThread = async () => {
    if (!user) return;
    const id = `local-${Date.now()}`;
    saveLocalConversation(user.uid, { id, userId: user.uid, title: "New chat", updatedAt: null, createdAt: Date.now() });
    setActiveId(id);
    setMessages([]);
    setSources([]);
    setFluxResults([]);
    setInput("");
    setLeftOpen(false);
    await refreshConversations();
  };

  const removeThread = async (conversation: AIConversation) => {
    if (!user) return;
    if (conversation.id.startsWith("local-")) deleteLocalConversation(user.uid, conversation.id);
    else await deleteConversation(conversation.id).catch(() => deleteLocalConversation(user.uid, conversation.id));
    if (activeId === conversation.id) {
      setActiveId(null);
      setMessages([]);
    }
    await refreshConversations();
  };

  const runInstant = async (text: string, controller: AbortController): Promise<string> => {
    const context = buildAskAIWorkspaceContext(listAskAIAgents()[0], workspaceFiles.filter((file) => selectedFileIds.includes(file.id)));
    if (localAskAISupported()) {
      setStatus("AskAI 1.0 Instant is loading on this device…");
      setStreaming("");
      return streamLocalAskAI({
        messages: [...messages, { id: "current", role: "user", content: text, createdAt: null }].map((item) => ({ role: item.role, content: item.content })),
        signal: controller.signal,
        systemPrompt: `You are AskAI 1.0 Instant inside Flux. Be fast, natural and direct. Use the supplied workspace context. Never pretend to have searched the live web.\n\n${context}`,
        onProgress: (label) => setStatus(label),
        onToken: (token) => setStreaming((current) => current + token),
      });
    }
    setStatus("AskAI 1.0 Instant is answering…");
    return runLocalAskAI(text).answer;
  };

  const runPro = async (text: string, controller: AbortController, researchSources: AskAIResearchSource[]): Promise<string> => {
    if (!proEndpoint) {
      throw new Error("AskAI 1.0 Pro needs a configured Kimi K3-compatible endpoint. GitHub Pages cannot safely store a private API key in the browser.");
    }
    const context = buildAskAIWorkspaceContext(listAskAIAgents()[0], workspaceFiles.filter((file) => selectedFileIds.includes(file.id)));
    setStatus("AskAI 1.0 Pro is reasoning with Kimi K3 at max effort…");
    return runAskAIPro({
      endpoint: proEndpoint,
      workspaceContext: context,
      signal: controller.signal,
      sources: researchSources,
      messages: [...messages, { id: "current", role: "user", content: text, createdAt: null }].map((item) => ({ role: item.role, content: item.content })),
    });
  };

  const send = async (override?: string) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    setStreaming("");
    setSources([]);
    setFluxResults([]);
    const controller = new AbortController();
    abortRef.current = controller;
    let conversationId: string | null = null;

    try {
      conversationId = await ensureConversation(text);
      await append(conversationId, "user", text, { mode, files: selectedFileIds });
      if (messages.length === 0) {
        const title = titleFromText(text);
        if (conversationId.startsWith("local-")) renameLocalConversation(user.uid, conversationId, title);
        else void renameConversation(conversationId, title).catch(() => renameLocalConversation(user.uid, conversationId!, title));
      }

      if (isFluxSearch(text)) {
        setStatus("Searching Flux…");
        const query = cleanFluxQuery(text);
        const found = await searchFlux(query, { max: 30 });
        setFluxResults(found);
        await append(conversationId, "assistant", found.length ? `I found **${found.length}** Flux result${found.length === 1 ? "" : "s"} for **${query}**.` : `I couldn't find public Flux results for **${query}**.`, { mode, tool: "flux-search" });
      } else {
        let researchSources: AskAIResearchSource[] = [];
        if (mode === "pro" && isResearchRequest(text)) {
          if (researchEndpoint) {
            setStatus("Searching connected web sources…");
            researchSources = await searchConnectedWeb({ endpoint: researchEndpoint, query: text, signal: controller.signal, limit: 8 });
            setSources(researchSources);
          } else {
            toast.message("No connected search endpoint is configured, so Pro will answer without live web results.");
          }
        }

        const answer = mode === "pro"
          ? await runPro(text, controller, researchSources)
          : await runInstant(text, controller);
        setStreaming("");
        await append(conversationId, "assistant", answer, { mode, engine: mode === "pro" ? "kimi-k3" : "browser-local", sources: researchSources });
      }
      await refreshConversations();
    } catch (error) {
      setStreaming("");
      if ((error as DOMException)?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "AskAI could not finish that request.";
      toast.error(message);
      if (conversationId) await append(conversationId, "assistant", message, { mode, error: true });
    } finally {
      setLoading(false);
      setStatus(null);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreaming("");
    setLoading(false);
    setStatus(null);
  };

  const onFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []).slice(0, 6);
    for (const file of incoming) {
      try {
        const text = await extractText(file);
        const dataUrl = file.type.startsWith("image/") && file.size < 1_200_000 ? await readDataUrl(file) : null;
        const saved = saveAskAIFile({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          text,
          dataUrl,
          createdAt: Date.now(),
        });
        setSelectedFileIds((current) => [...new Set([...current, saved.id])]);
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "could not read file"}`);
      }
    }
    setWorkspaceFiles(listAskAIFiles());
    event.target.value = "";
  };

  const filteredThreads = conversations.filter((thread) => thread.title.toLowerCase().includes(threadSearch.toLowerCase()));
  const selectedFiles = workspaceFiles.filter((file) => selectedFileIds.includes(file.id));
  const hasConversation = messages.length > 0 || streaming || loading;

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
          {filteredThreads.map((thread) => (
            <div key={thread.id} className={cn("askx-thread-row", activeId === thread.id && "is-active")}>
              <button type="button" onClick={() => { setActiveId(thread.id); setLeftOpen(false); }}>{thread.title}</button>
              <button type="button" onClick={() => void removeThread(thread)} aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <footer className="askx-sidebar-account"><UserAvatar user={profile} size="sm" clickable={false} /><div><strong>{profile?.displayName || "Flux user"}</strong><span>@{profile?.username || "user"}</span></div><MoreHorizontal className="h-4 w-4" /></footer>
      </aside>

      {leftOpen ? <button type="button" className="askx-overlay" onClick={() => setLeftOpen(false)} aria-label="Close chats" /> : null}

      <section className="askx-chat">
        <header className="askx-chat-header">
          <button type="button" className="askx-mobile-menu" onClick={() => setLeftOpen(true)} aria-label="Open chats"><Menu className="h-5 w-5" /></button>
          <div className="askx-chat-title"><Sparkles className="h-5 w-5" /><div><strong>AskAI</strong><span>{mode === "pro" ? "Kimi K3 · max reasoning" : localStatus.phase === "ready" ? "Fast model ready on this device" : "Fast private browser model"}</span></div></div>
          <div className="askx-model-switch" aria-label="AskAI model">
            <button type="button" className={mode === "instant" ? "is-active" : ""} onClick={() => changeMode("instant")}><Zap className="h-4 w-4" /><span>AskAI 1.0 Instant</span></button>
            <button type="button" className={mode === "pro" ? "is-active" : ""} onClick={() => changeMode("pro")}><Sparkles className="h-4 w-4" /><span>AskAI 1.0 Pro</span></button>
          </div>
          <button type="button" className="askx-context-button" onClick={() => setRightOpen((value) => !value)} aria-label="Open research and files"><Globe2 className="h-5 w-5" /></button>
        </header>

        <div className="askx-model-note">
          {mode === "instant" ? <><Check className="h-4 w-4" /><span>Runs privately in your browser. Best for fast chat, rewriting, summaries and planning.</span></> : <><Globe2 className="h-4 w-4" /><span>{proEndpoint ? "Connected to a Kimi K3-compatible endpoint with max reasoning." : "Connection required: configure a private Kimi K3-compatible endpoint."}</span></>}
        </div>

        <div className="askx-scroll no-scrollbar">
          {!hasConversation ? (
            <div className="askx-empty">
              <span><Sparkles className="h-8 w-8" /></span>
              <h1>What can I help with?</h1>
              <p>Ask a question, research a topic, attach a file, search Flux or plan something.</p>
              <div className="askx-starters">
                {["Explain this simply", "Research the latest information", "Write a natural Flux post", "Plan a browser game"].map((starter) => <button key={starter} type="button" onClick={() => { setInput(starter); }}>{starter}</button>)}
              </div>
            </div>
          ) : (
            <div className="askx-messages">
              {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
              {streaming ? <div className="askx-message is-assistant"><span className="askx-assistant-mark"><Sparkles className="h-4 w-4" /></span><div className="askx-message-body"><ReactMarkdown>{streaming}</ReactMarkdown></div></div> : null}
              {status ? <div className="askx-status"><Loader2 className="h-4 w-4 animate-spin" />{status}</div> : null}

              {fluxResults.length ? <div className="askx-results">{fluxResults.map((result) => <Link key={`${result.kind}-${result.id}`} href={result.href}><span className="askx-result-image">{result.imageUrl ? <img src={result.imageUrl} alt="" /> : <Search className="h-5 w-5" />}</span><div><strong>{result.title}</strong><small>{result.subtitle} · {result.meta}</small><p>{result.description}</p></div></Link>)}</div> : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="askx-composer-wrap">
          {selectedFiles.length ? <div className="askx-file-chips">{selectedFiles.map((file) => <button key={file.id} type="button" onClick={() => setSelectedFileIds((current) => current.filter((id) => id !== file.id))}><FileText className="h-4 w-4" /><span>{file.name}</span><X className="h-3.5 w-3.5" /></button>)}</div> : null}
          <form className="askx-composer" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(); }}>
            <input ref={fileRef} type="file" multiple className="hidden" accept="image/*,.txt,.md,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx" onChange={(event) => void onFiles(event)} />
            <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach files"><Paperclip className="h-5 w-5" /></button>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={mode === "pro" ? "Message AskAI 1.0 Pro…" : "Message AskAI 1.0 Instant…"} rows={1} />
            <button type={loading ? "button" : "submit"} onClick={loading ? stop : undefined} disabled={!loading && !input.trim()} className="askx-send">{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button>
          </form>
          <p>{mode === "pro" ? "Pro uses Kimi K3 through your configured server. Verify important information." : "Instant runs locally when WebGPU is available and falls back to fast local tools."}</p>
        </footer>
      </section>

      <aside className={cn("askx-context", rightOpen && "is-open")}>
        <header><strong>Research & files</strong><button type="button" onClick={() => setRightOpen(false)} aria-label="Close panel"><X className="h-4 w-4" /></button></header>
        <section><h2>Model</h2><div className="askx-context-card"><strong>{mode === "pro" ? "AskAI 1.0 Pro" : "AskAI 1.0 Instant"}</strong><p>{mode === "pro" ? "Kimi K3, maximum reasoning effort, connected server." : "Fast Qwen browser model with an instant rules fallback."}</p></div></section>
        <section><h2>Connected search</h2><div className="askx-context-card"><strong>{researchEndpoint ? "Available" : "Not configured"}</strong><p>{researchEndpoint ? "Research requests can retrieve live sources and pass them to Pro with citations." : "Set NEXT_PUBLIC_ASKAI_SEARCH_ENDPOINT to enable live web research."}</p></div></section>
        <section><h2>Sources</h2>{sources.length ? <div className="askx-source-list">{sources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer"><span>{index + 1}</span><div><strong>{source.title}</strong><p>{source.snippet}</p></div></a>)}</div> : <p className="askx-context-empty">Sources from connected research appear here.</p>}</section>
        <section><h2>Workspace files</h2>{workspaceFiles.length ? <div className="askx-workspace-files">{workspaceFiles.map((file) => <button key={file.id} type="button" className={selectedFileIds.includes(file.id) ? "is-selected" : ""} onClick={() => setSelectedFileIds((current) => current.includes(file.id) ? current.filter((id) => id !== file.id) : [...current, file.id])}><FileText className="h-4 w-4" /><span>{file.name}</span>{selectedFileIds.includes(file.id) ? <Check className="h-4 w-4" /> : null}</button>)}</div> : <p className="askx-context-empty">Attach a file to add it to AskAI context.</p>}</section>
      </aside>
    </main>
  );
}

function MessageBubble({ message }: { message: AIMessage }) {
  const [copied, setCopied] = useState(false);
  const user = message.role === "user";
  return <div className={cn("askx-message", user ? "is-user" : "is-assistant")}>{!user ? <span className="askx-assistant-mark"><Sparkles className="h-4 w-4" /></span> : null}<div className="askx-message-body"><ReactMarkdown>{message.content}</ReactMarkdown>{!user ? <button type="button" className="askx-copy" onClick={async () => { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1300); }}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button> : null}</div></div>;
}

function isFluxSearch(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(search|find|look up)\b/.test(lower) && /\bflux\b/.test(lower);
}

function cleanFluxQuery(text: string): string {
  return text.replace(/^(search|find|look up)\s+(on\s+|in\s+)?flux\s+(for\s+)?/i, "").replace(/\s+(on|in)\s+flux$/i, "").trim();
}

function isResearchRequest(text: string): boolean {
  return /\b(search the web|research|latest|today|current|sources|verify|look up online|find online|news)\b/i.test(text);
}

function titleFromText(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.split(" ").slice(0, 8).join(" ").slice(0, 70) || "New chat";
}

async function extractText(file: File): Promise<string> {
  const textLike = file.type.startsWith("text/") || /\.(txt|md|json|csv|html|css|js|ts|tsx|jsx)$/i.test(file.name);
  if (!textLike) return "";
  if (file.size > 2_000_000) throw new Error("Text files must be under 2 MB.");
  return (await file.text()).slice(0, 200_000);
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

function localConversationKey(uid: string): string { return `flux-askai-local-conversations-${uid}`; }
function localMessagesKey(uid: string, id: string): string { return `flux-askai-local-messages-${uid}-${id}`; }

function readLocalConversations(uid: string): AIConversation[] {
  try { return JSON.parse(localStorage.getItem(localConversationKey(uid)) || "[]") as AIConversation[]; } catch { return []; }
}
function saveLocalConversation(uid: string, conversation: AIConversation): void {
  const current = readLocalConversations(uid).filter((item) => item.id !== conversation.id);
  localStorage.setItem(localConversationKey(uid), JSON.stringify([conversation, ...current].slice(0, 50)));
}
function renameLocalConversation(uid: string, id: string, title: string): void {
  const current = readLocalConversations(uid);
  const existing = current.find((item) => item.id === id) || { id, userId: uid, title, updatedAt: null, createdAt: Date.now() };
  saveLocalConversation(uid, { ...existing, title: title.slice(0, 80) });
}
function deleteLocalConversation(uid: string, id: string): void {
  localStorage.setItem(localConversationKey(uid), JSON.stringify(readLocalConversations(uid).filter((item) => item.id !== id)));
  localStorage.removeItem(localMessagesKey(uid, id));
}
function readLocalMessages(uid: string, id: string): AIMessage[] {
  try { return JSON.parse(localStorage.getItem(localMessagesKey(uid, id)) || "[]") as AIMessage[]; } catch { return []; }
}
function saveLocalMessage(uid: string, id: string, message: AIMessage): void {
  const current = readLocalMessages(uid, id);
  localStorage.setItem(localMessagesKey(uid, id), JSON.stringify([...current, message].slice(-160)));
}
function conversationTime(conversation: AIConversation): number {
  if (typeof conversation.updatedAt?.toMillis === "function") return conversation.updatedAt.toMillis();
  return typeof conversation.createdAt === "number" ? conversation.createdAt : 0;
}
