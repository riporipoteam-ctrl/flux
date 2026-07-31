"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CircleGauge,
  FileText,
  Globe2,
  Image as ImageIcon,
  Layers3,
  Menu,
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
import {
  searchFlux,
  type FluxSearchKind,
  type FluxSearchResult,
} from "@/services/flux-search";
import { stripThinkingText } from "@/lib/ai/strip-thinking";
import { assetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

const SEARCH_FILTERS: Array<{
  value: "all" | FluxSearchKind;
  label: string;
  icon: typeof Search;
}> = [
  { value: "all", label: "All", icon: Search },
  { value: "person", label: "People", icon: Users },
  { value: "group", label: "Groups", icon: Layers3 },
  { value: "post", label: "Posts", icon: FileText },
];

type AskMode = "assistant" | "search";
type AskArtifact =
  | { id: string; type: "group"; title: string; href: string; imageUrl?: string | null }
  | { id: string; type: "image"; title: string; href: string; imageUrl: string };

export default function AskAIPage() {
  const { user, profile } = useAuth();
  const endpoint = useMemo(() => resolveAskAIEndpoint(), []);
  const assistantAvailable = Boolean(endpoint);

  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<AskMode>(assistantAvailable ? "assistant" : "search");
  const [searchFilter, setSearchFilter] = useState<"all" | FluxSearchKind>("all");
  const [searchResults, setSearchResults] = useState<FluxSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [artifacts, setArtifacts] = useState<AskArtifact[]>([]);
  const [sessionRequests, setSessionRequests] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setConversations(await listConversations(user.uid).catch(() => []));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!assistantAvailable) setMode("search");
  }, [assistantAvailable]);

  useEffect(() => {
    setSearchResults([]);
    setArtifacts([]);
    setSearchQuery("");
    if (!activeId) {
      setMessages([]);
      return;
    }
    getMessages(activeId)
      .then((items) => setMessages(items.map((item) => item.role === "assistant" ? { ...item, content: stripThinkingText(item.content) } : item)))
      .catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming, status, searchResults, artifacts]);

  useEffect(() => () => {
    abortRef.current?.abort();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  const ensureConversation = async (title: string): Promise<string> => {
    if (activeId) return activeId;
    const id = await createConversation(user!.uid, title.slice(0, 52) || "New chat");
    setActiveId(id);
    return id;
  };

  const newChat = async () => {
    if (!user) return;
    const id = await createConversation(user.uid, "New chat");
    setActiveId(id);
    setMessages([]);
    setSearchResults([]);
    setArtifacts([]);
    setInput("");
    setHistoryOpen(false);
    await refresh();
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setLoading(false);
    setStatus(null);
  };

  const selectMode = (next: AskMode) => {
    if (next === "assistant" && !assistantAvailable) {
      toast.message("The remote AskAI service is not connected on this deployment. Flux Search is ready now.");
      setMode("search");
      return;
    }
    setMode(next);
  };

  const runFluxSearch = async (rawQuery: string, nextFilter = searchFilter) => {
    if (!user || loading) return;
    const text = rawQuery.trim();
    if (text.length < 2) return;
    setLoading(true);
    setStatus("Searching Flux…");
    setSearchQuery(text);
    setSearchResults([]);
    setArtifacts([]);
    setInput("");

    try {
      const conversationId = await ensureConversation(`Search: ${text}`);
      const userContent = `Search Flux for ${text}`;
      const userMessage: AIMessage = { id: `search-user-${Date.now()}`, role: "user", content: userContent, createdAt: null };
      setMessages((items) => [...items, userMessage]);
      await addMessage(conversationId, { role: "user", content: userContent });

      const kinds = nextFilter === "all" ? undefined : [nextFilter];
      const results = await searchFlux(text, { kinds, max: 30 });
      setSearchResults(results);
      const answer = results.length
        ? `Found ${results.length} ${results.length === 1 ? "match" : "matches"} across Flux.`
        : `No public people, groups, or posts matched “${text}”. Try a username, hashtag, or shorter phrase.`;
      const assistantMessage: AIMessage = { id: `search-ai-${Date.now()}`, role: "assistant", content: answer, createdAt: null };
      setMessages((items) => [...items, assistantMessage]);
      await addMessage(conversationId, { role: "assistant", content: answer });
      setSessionRequests((value) => value + 1);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Flux Search failed");
    } finally {
      setLoading(false);
      setStatus(null);
    }
  };

  const send = async (override?: string, overrideMode?: AskMode) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    const activeMode = overrideMode || mode;

    if (activeMode === "search" || /^\/?(search|find)\s+(flux\s+)?/i.test(text)) {
      await runFluxSearch(text.replace(/^\/?(search|find)\s+(flux\s+)?/i, ""));
      return;
    }

    if (!endpoint) {
      selectMode("assistant");
      return;
    }

    const conversationId = await ensureConversation(text);
    const userMessage: AIMessage = { id: `user-${Date.now()}`, role: "user", content: text, createdAt: null };
    const history = [...messages, userMessage]
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((items) => [...items, userMessage]);
    setInput("");
    setStreaming("");
    setStatus("Connecting…");
    setSearchResults([]);
    setSearchQuery("");
    setArtifacts([]);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    timeoutRef.current = window.setTimeout(() => controller.abort("timeout"), 35_000);

    try {
      await addMessage(conversationId, { role: "user", content: text });
      if (messages.length === 0) void renameConversation(conversationId, text.slice(0, 52));
      let answer = "";

      await streamServerAskAI({
        endpoint,
        uid: user.uid,
        message: text,
        history,
        signal: controller.signal,
        onStatus: setStatus,
        onArtifact: (artifact) => setArtifacts((items) => [...items.filter((item) => item.id !== artifact.id), artifact]),
        onToken: (token) => {
          answer += token;
          setStreaming(stripThinkingText(answer));
          setStatus(null);
        },
      });

      const clean = stripThinkingText(answer).trim() || "AskAI returned an empty reply. Try again.";
      await addMessage(conversationId, { role: "assistant", content: clean });
      setMessages((items) => [...items, { id: `assistant-${Date.now()}`, role: "assistant", content: clean, createdAt: null }]);
      setSessionRequests((value) => value + 1);
      await refresh();
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        const partial = stripThinkingText(streaming).trim();
        const message = controller.signal.reason === "timeout"
          ? "AskAI timed out after 35 seconds. Flux Search still works instantly."
          : partial ? `${partial}\n\n_(stopped)_` : "Generation stopped.";
        setMessages((items) => [...items, { id: `stopped-${Date.now()}`, role: "assistant", content: message, createdAt: null }]);
        if (controller.signal.reason === "timeout") toast.error("AskAI timed out");
      } else {
        const message = error instanceof Error ? error.message : "AskAI failed";
        toast.error(message);
        setMessages((items) => [...items, { id: `error-${Date.now()}`, role: "assistant", content: `AskAI could not answer: ${message}`, createdAt: null }]);
      }
    } finally {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      setLoading(false);
      setStatus(null);
      setStreaming("");
      abortRef.current = null;
    }
  };

  const empty = messages.length === 0 && !loading;

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-background text-foreground lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[292px] flex-col border-r border-border bg-background transition-transform md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-14 items-center gap-2 border-b border-border px-3">
          <Button onClick={() => void newChat()} className="h-10 flex-1 rounded-full font-bold"><Plus className="h-4 w-4" />New chat</Button>
          <button type="button" onClick={() => setHistoryOpen(false)} className="social-action md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <p className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground">Recent</p>
          {conversations.length ? conversations.map((conversation) => (
            <div key={conversation.id} className={cn("group mx-2 flex items-center rounded-xl hover:bg-muted/55", activeId === conversation.id && "bg-muted")}>
              <button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm font-semibold">{conversation.title}</button>
              <button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="social-action h-8 min-h-8 w-8 min-w-8 opacity-0 group-hover:opacity-100" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button>
            </div>
          )) : <p className="px-5 py-8 text-center text-xs text-muted-foreground">No AskAI history yet.</p>}
        </div>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2"><UserAvatar user={profile} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{profile?.displayName || "Flux user"}</p><p className="truncate text-[10px] text-muted-foreground">{sessionRequests} requests this session</p></div><CircleGauge className="h-4 w-4 text-primary" /></div>
        </div>
      </aside>

      {historyOpen ? <button type="button" className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background/96 px-3 backdrop-blur-xl sm:px-5">
          <button type="button" onClick={() => setHistoryOpen(true)} className="social-action md:hidden" aria-label="Open chat history"><Menu className="h-5 w-5" /></button>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background"><Sparkles className="h-4.5 w-4.5" /></span>
          <div className="min-w-0 flex-1"><h1 className="truncate font-extrabold">AskAI</h1><p className="truncate text-[11px] text-muted-foreground">Flux Search is instant · assistant tools need the remote service</p></div>
          <span className={cn("hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-extrabold sm:flex", assistantAvailable ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}><span className={cn("h-1.5 w-1.5 rounded-full", assistantAvailable ? "bg-emerald-500" : "bg-amber-500")} />{assistantAvailable ? "Assistant online" : "Search mode"}</span>
        </header>

        <div className="flex h-12 items-center gap-1 border-b border-border px-3 sm:px-5">
          <ModeButton active={mode === "assistant"} disabled={!assistantAvailable} icon={Bot} label="Assistant" onClick={() => selectMode("assistant")} />
          <ModeButton active={mode === "search"} icon={Search} label="Search Flux" onClick={() => selectMode("search")} />
          <span className="ml-auto hidden text-[10px] font-semibold text-muted-foreground sm:block">No browser model download</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-3 py-5 sm:px-6 sm:py-8">
            {empty ? (
              <div className="my-auto py-8">
                <div className="mx-auto max-w-xl text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-foreground text-background"><Search className="h-6 w-6" /></span>
                  <h2 className="mt-5 text-3xl font-extrabold tracking-[-.04em]">{mode === "search" ? "Search everything on Flux" : "Ask Flux anything"}</h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{mode === "search" ? "Find people, public groups, posts, usernames, and hashtags without waiting for an AI model." : "Research the web, create your one AI group, generate images, and get writing help."}</p>
                </div>
                <div className="mx-auto mt-7 grid max-w-xl gap-2 sm:grid-cols-2">
                  <Suggestion icon={Users} title="Find people" text="Ripo Team" onClick={() => { setMode("search"); void runFluxSearch("Ripo Team", "person"); }} />
                  <Suggestion icon={Layers3} title="Find groups" text="gaming" onClick={() => { setMode("search"); void runFluxSearch("gaming", "group"); }} />
                  <Suggestion icon={FileText} title="Search posts" text="#gaming" onClick={() => { setMode("search"); void runFluxSearch("#gaming", "post"); }} />
                  <Suggestion icon={assistantAvailable ? Globe2 : Search} title={assistantAvailable ? "Web research" : "Search Flux"} text={assistantAvailable ? "Latest gaming technology" : "Find posts and creators"} onClick={() => assistantAvailable ? void send("Search the web for the latest gaming technology", "assistant") : void runFluxSearch("gaming")} />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
                {streaming ? <article className="flex gap-3"><AssistantIcon /><div className="min-w-0 flex-1 pt-1 text-[15px] leading-7"><ReactMarkdown>{streaming}</ReactMarkdown><span className="ml-1 inline-block h-4 w-1 animate-pulse rounded bg-primary" /></div></article> : null}
                {status ? <div className="flex items-center gap-2 border-y border-border py-3 text-sm font-semibold text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />{status}</div> : null}
                {artifacts.length ? <div className="grid gap-3 sm:grid-cols-2">{artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</div> : null}
                {searchQuery ? <SearchResults queryText={searchQuery} results={searchResults} filter={searchFilter} onFilterChange={(value) => { setSearchFilter(value); void runFluxSearch(searchQuery, value); }} /> : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-border bg-background/96 p-3 backdrop-blur-xl story-safe-bottom">
          {mode === "search" ? <div className="mx-auto mb-2 flex max-w-3xl gap-1.5 overflow-x-auto no-scrollbar">{SEARCH_FILTERS.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setSearchFilter(value)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold", searchFilter === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div> : null}
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-input bg-background p-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={mode === "search" ? "Search people, groups, posts, usernames, or hashtags" : "Message AskAI"} className="max-h-36 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0" />
            {loading ? <button type="button" onClick={stop} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background" aria-label="Stop"><Square className="h-4 w-4 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={!input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-35" aria-label="Send"><Send className="h-4 w-4" /></button>}
          </div>
        </footer>
      </section>
    </main>
  );
}

function resolveAskAIEndpoint(): string | null {
  const direct = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT?.trim();
  if (direct) return direct;
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, "");
  if (appOrigin) return `${appOrigin}/api/ask-ai`;
  if (!process.env.NEXT_PUBLIC_BASE_PATH) return "/api/ask-ai";
  return null;
}

function ModeButton({ active, disabled, icon: Icon, label, onClick }: { active: boolean; disabled?: boolean; icon: typeof Bot; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-disabled={disabled} className={cn("flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold", active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted", disabled && "opacity-45")}><Icon className="h-4 w-4" />{label}</button>;
}

function Suggestion({ icon: Icon, title, text, onClick }: { icon: typeof Search; title: string; text: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-3 border border-border bg-background p-4 text-left transition hover:bg-muted/35"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-primary"><Icon className="h-5 w-5" /></span><span className="min-w-0"><strong className="block text-sm">{title}</strong><span className="mt-0.5 block truncate text-xs text-muted-foreground">{text}</span></span></button>;
}

function AssistantIcon() {
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-background"><Sparkles className="h-4 w-4" /></span>;
}

function MessageBubble({ message }: { message: AIMessage }) {
  const userMessage = message.role === "user";
  return <article className={cn("flex gap-3", userMessage && "justify-end")}>{userMessage ? null : <AssistantIcon />}<div className={cn("max-w-[88%] text-[15px] leading-7", userMessage ? "rounded-2xl rounded-br-md bg-muted px-4 py-2.5" : "min-w-0 flex-1 pt-1")}>{userMessage ? <p className="whitespace-pre-wrap">{message.content}</p> : <ReactMarkdown>{message.content}</ReactMarkdown>}</div></article>;
}

function ArtifactCard({ artifact }: { artifact: AskArtifact }) {
  return <Link href={artifact.href} className="overflow-hidden border border-border bg-background transition hover:bg-muted/30">{artifact.imageUrl ? <div className="aspect-[2/1] overflow-hidden bg-muted"><img src={assetUrl(artifact.imageUrl)} alt="" className="h-full w-full object-cover" /></div> : null}<div className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">{artifact.type === "group" ? <Users className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{artifact.title}</p><p className="text-xs text-muted-foreground">Open result</p></div><WandSparkles className="h-4 w-4 text-primary" /></div></Link>;
}

function SearchResults({ queryText, results, filter, onFilterChange }: { queryText: string; results: FluxSearchResult[]; filter: "all" | FluxSearchKind; onFilterChange: (value: "all" | FluxSearchKind) => void }) {
  return <section className="border border-border bg-background"><div className="border-b border-border p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary"><Search className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold">Results for “{queryText}”</h3><p className="text-xs text-muted-foreground">{results.length} matches across Flux</p></div></div><div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar">{SEARCH_FILTERS.map(({ value, label }) => <button key={value} type="button" onClick={() => onFilterChange(value)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold", filter === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{label}</button>)}</div></div>{results.length ? <div className="divide-y divide-border">{results.map((result) => <FluxResultRow key={`${result.kind}-${result.id}`} result={result} />)}</div> : <div className="grid min-h-40 place-items-center p-6 text-center"><div><Search className="mx-auto h-7 w-7 text-muted-foreground/35" /><p className="mt-3 text-sm font-bold">No matching Flux content</p><p className="mt-1 text-xs text-muted-foreground">Try a username, group name, or hashtag.</p></div></div>}</section>;
}

function FluxResultRow({ result }: { result: FluxSearchResult }) {
  const Icon = result.kind === "person" ? Users : result.kind === "group" ? Layers3 : FileText;
  return <Link href={result.href} className="flex gap-3 p-4 transition hover:bg-muted/30">{result.kind === "person" ? <UserAvatar user={{ displayName: result.title, username: result.subtitle.replace(/^@/, ""), avatarUrl: result.imageUrl }} size="md" clickable={false} /> : result.imageUrl ? <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted"><img src={assetUrl(result.imageUrl)} alt="" className="h-full w-full object-cover" /></span> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{result.title}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">{result.kind}</span></div><p className="truncate text-xs text-muted-foreground">{result.subtitle}{result.meta ? ` · ${result.meta}` : ""}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{result.description}</p></div></Link>;
}

async function streamServerAskAI(input: {
  endpoint: string;
  uid: string;
  message: string;
  history: Array<{ role: string; content: string }>;
  signal: AbortSignal;
  onStatus: (status: string | null) => void;
  onToken: (token: string) => void;
  onArtifact: (artifact: AskArtifact) => void;
}): Promise<void> {
  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({ message: input.message, history: input.history, uid: input.uid }),
  });
  if (!response.ok || !response.body) throw new Error("AskAI's remote service is unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const line = block.trim();
      if (!line.startsWith("data:")) continue;
      try {
        const data = JSON.parse(line.slice(5).trim());
        if (data.type === "status") input.onStatus(String(data.label || "Working…"));
        if (data.type === "status_clear") input.onStatus(null);
        if (data.type === "token" && data.content) input.onToken(String(data.content));
        if (data.type === "group" && data.groupId) input.onArtifact({ id: `group-${data.groupId}`, type: "group", title: String(data.name || "New Flux group"), href: `/group?groupId=${encodeURIComponent(data.groupId)}`, imageUrl: data.avatarUrl || data.bannerUrl || null });
        if (data.type === "image" && data.url) input.onArtifact({ id: `image-${data.url}`, type: "image", title: "Generated image", href: String(data.url), imageUrl: String(data.url) });
        if (data.type === "error") throw new Error(String(data.error || "AskAI failed"));
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
}
