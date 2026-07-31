"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Boxes,
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
import { stripThinkingText } from "@/lib/ai/strip-thinking";
import { assetUrl } from "@/lib/asset-url";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { icon: Search, title: "Search Flux", prompt: "Search Flux for Ripo Team", mode: "search" as const },
  { icon: FileText, title: "Write a post", prompt: "Help me write a strong Flux post", mode: "assistant" as const },
  { icon: Users, title: "Create a group", prompt: "Create a group called Gaming Builders", mode: "assistant" as const },
  { icon: Globe2, title: "Research", prompt: "Search the web for the latest gaming technology news", mode: "assistant" as const },
];

const SEARCH_FILTERS: Array<{ value: "all" | FluxSearchKind; label: string; icon: typeof Search }> = [
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
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [mode, setMode] = useState<AskMode>("assistant");
  const [searchFilter, setSearchFilter] = useState<"all" | FluxSearchKind>("all");
  const [searchResults, setSearchResults] = useState<FluxSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [artifacts, setArtifacts] = useState<AskArtifact[]>([]);
  const [sessionRequests, setSessionRequests] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const endpoint = useMemo(() => resolveAskAIEndpoint(), []);
  const endpointConnected = Boolean(endpoint);

  const refresh = useCallback(async () => {
    if (user) setConversations(await listConversations(user.uid));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, status, searchResults, artifacts]);

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
    setLoading(false);
    setStatus(null);
  };

  const ensureConversation = async (title: string): Promise<string> => {
    if (activeId) return activeId;
    const id = await createConversation(user!.uid, title.slice(0, 52) || "New chat");
    setActiveId(id);
    return id;
  };

  const runFluxSearch = async (rawQuery: string) => {
    if (!user || loading) return;
    const text = rawQuery.trim();
    if (text.length < 2) return;
    setLoading(true);
    setStatus("Searching Flux…");
    setSearchResults([]);
    setSearchQuery(text);
    setInput("");

    try {
      const conversationId = await ensureConversation(`Search: ${text}`);
      const userMessage: AIMessage = { id: `search-user-${Date.now()}`, role: "user", content: `Search Flux for ${text}`, createdAt: null };
      setMessages((items) => [...items, userMessage]);
      await addMessage(conversationId, { role: "user", content: userMessage.content });

      const kinds = searchFilter === "all" ? undefined : [searchFilter];
      const results = await searchFlux(text, { kinds, max: 24 });
      setSearchResults(results);
      const answer = results.length
        ? `I found ${results.length} matching ${results.length === 1 ? "result" : "results"} across Flux. The strongest matches are shown below.`
        : `I couldn't find a matching person, group, or public post for “${text}”. Try a username, group name, hashtag, or a shorter phrase.`;
      const assistantMessage: AIMessage = { id: `search-ai-${Date.now()}`, role: "assistant", content: answer, createdAt: null };
      setMessages((items) => [...items, assistantMessage]);
      await addMessage(conversationId, { role: "assistant", content: answer });
      setSessionRequests((value) => value + 1);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Flux search failed";
      toast.error(message);
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

    const conversationId = await ensureConversation(text);
    const userMessage: AIMessage = { id: `local-user-${Date.now()}`, role: "user", content: text, createdAt: null };
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

    try {
      await addMessage(conversationId, { role: "user", content: text });
      if (messages.length === 0) void renameConversation(conversationId, text.slice(0, 52));

      if (!endpoint) {
        throw new Error("AskAI's remote service is not connected to this deployment yet. Flux Search is ready and does not require an AI download.");
      }

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

      const clean = stripThinkingText(answer).trim() || "I couldn't create a reply. Please try again.";
      await addMessage(conversationId, { role: "assistant", content: clean });
      setMessages((items) => [...items, { id: `local-ai-${Date.now()}`, role: "assistant", content: clean, createdAt: null }]);
      setSessionRequests((value) => value + 1);
      await refresh();
    } catch (error) {
      if ((error as Error)?.name === "AbortError") {
        const partial = stripThinkingText(streaming).trim();
        if (partial) setMessages((items) => [...items, { id: `stopped-${Date.now()}`, role: "assistant", content: `${partial}\n\n_(stopped)_`, createdAt: null }]);
      } else {
        const message = error instanceof Error ? error.message : "AskAI failed";
        toast.error(message);
        setMessages((items) => [...items, { id: `error-${Date.now()}`, role: "assistant", content: `AskAI could not answer: ${message}`, createdAt: null }]);
      }
    } finally {
      setLoading(false);
      setStatus(null);
      setStreaming("");
      abortRef.current = null;
    }
  };

  const empty = messages.length === 0 && !loading;

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-[#f7f8fa] text-[#111216] dark:bg-black dark:text-white lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[304px] flex-col border-r border-black/6 bg-white transition-transform dark:border-white/10 dark:bg-[#0b0c0e] md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-[61px] items-center gap-2 border-b border-black/6 px-3 dark:border-white/10">
          <Button onClick={() => void newChat()} className="h-11 flex-1 rounded-2xl font-black"><Plus className="h-4 w-4" />New chat</Button>
          <button type="button" onClick={() => setHistoryOpen(false)} className="social-action md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="px-3 pb-2 pt-3 text-[10px] font-black uppercase tracking-[.16em] text-black/35 dark:text-white/30">Recent</p>
          {conversations.length ? conversations.map((conversation) => (
            <div key={conversation.id} className={cn("group flex items-center rounded-2xl px-2 transition-colors hover:bg-black/[.035] dark:hover:bg-white/6", activeId === conversation.id && "bg-black/[.05] dark:bg-white/8")}>
              <button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-2 py-3 text-left text-sm font-bold">{conversation.title}</button>
              <button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="social-action h-9 min-h-9 w-9 min-w-9 opacity-0 group-hover:opacity-100" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button>
            </div>
          )) : <p className="px-4 py-8 text-center text-xs text-black/35 dark:text-white/30">Your AskAI chats appear here.</p>}
        </div>
        <div className="border-t border-black/6 p-3 dark:border-white/10">
          <div className="rounded-2xl bg-black/[.035] p-3 dark:bg-white/6">
            <div className="flex items-center gap-2"><UserAvatar user={profile} size="sm" clickable={false} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{profile?.displayName || "Flux user"}</p><p className="truncate text-[10px] text-black/40 dark:text-white/35">{sessionRequests} requests this session</p></div><CircleGauge className="h-4 w-4 text-primary" /></div>
          </div>
        </div>
      </aside>

      {historyOpen ? <button type="button" className="fixed inset-0 z-50 bg-black/45 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[61px] items-center gap-3 border-b border-black/6 bg-white/90 px-3 backdrop-blur-xl dark:border-white/10 dark:bg-black/88 sm:px-5">
          <button type="button" onClick={() => setHistoryOpen(true)} className="social-action md:hidden" aria-label="Open chat history"><Menu className="h-5 w-5" /></button>
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white shadow-sm dark:bg-white dark:text-black"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h1 className="truncate font-black tracking-tight">AskAI</h1><p className="truncate text-[11px] text-black/45 dark:text-white/40">Instant Flux Search · remote AI tools · no model downloads</p></div>
          <span className={cn("hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black sm:flex", endpointConnected ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300")}><span className={cn("h-1.5 w-1.5 rounded-full", endpointConnected ? "bg-emerald-500" : "bg-amber-500")} />{endpointConnected ? "AI connected" : "Search only"}</span>
        </header>

        <div className="border-b border-black/6 bg-white px-3 py-2 dark:border-white/10 dark:bg-black sm:px-5">
          <div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto no-scrollbar">
            <ModeButton active={mode === "assistant"} icon={Bot} label="Assistant" onClick={() => setMode("assistant")} />
            <ModeButton active={mode === "search"} icon={Search} label="Search Flux" onClick={() => setMode("search")} />
            <span className="mx-1 h-6 w-px shrink-0 bg-black/8 dark:bg-white/10" />
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet-500/8 px-3 py-2 text-[11px] font-bold text-violet-700 dark:text-violet-300"><WandSparkles className="h-3.5 w-3.5" />Groups + images</span>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-blue-500/8 px-3 py-2 text-[11px] font-bold text-blue-700 dark:text-blue-300"><Globe2 className="h-3.5 w-3.5" />Web research</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-4xl flex-col px-3 py-5 sm:px-6 sm:py-8">
            {empty ? (
              <div className="my-auto py-8">
                <div className="mx-auto max-w-2xl text-center">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-black text-white shadow-[0_12px_40px_rgba(0,0,0,.18)] dark:bg-white dark:text-black"><Bot className="h-7 w-7" /></span>
                  <h2 className="mt-5 text-3xl font-black tracking-[-.04em] sm:text-4xl">What are we building?</h2>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-black/50 dark:text-white/45">Search Flux instantly, research the web, create your one AI group, generate images, or work through an idea with AskAI.</p>
                </div>
                <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
                  {SUGGESTIONS.map(({ icon: Icon, title, prompt, mode: suggestionMode }) => <button key={title} type="button" onClick={() => { setMode(suggestionMode); void send(prompt, suggestionMode); }} className="group rounded-[22px] border border-black/7 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black/15 hover:shadow-md dark:border-white/10 dark:bg-[#101114] dark:hover:border-white/20"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-black/[.045] text-black/65 transition group-hover:bg-primary group-hover:text-white dark:bg-white/8 dark:text-white/65"><Icon className="h-5 w-5" /></span><strong className="mt-4 block text-sm">{title}</strong><span className="mt-1 block text-xs leading-5 text-black/40 dark:text-white/35">{prompt}</span></button>)}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <article key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                    {message.role === "assistant" ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-black text-white dark:bg-white dark:text-black"><Bot className="h-4 w-4" /></span> : null}
                    <div className={cn("max-w-[90%] text-[15px] leading-7", message.role === "user" ? "rounded-[22px] rounded-br-md bg-[#e9edf2] px-4 py-2.5 text-[#111216] dark:bg-[#202226] dark:text-white" : "min-w-0 flex-1 pt-1")}>
                      {message.role === "assistant" ? <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{message.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap">{message.content}</p>}
                    </div>
                  </article>
                ))}

                {streaming ? <article className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-black text-white dark:bg-white dark:text-black"><Bot className="h-4 w-4" /></span><div className="min-w-0 flex-1 pt-1 text-[15px] leading-7"><ReactMarkdown>{streaming}</ReactMarkdown><span className="ml-1 inline-block h-4 w-1 animate-pulse rounded bg-primary" /></div></article> : null}

                {status ? <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm font-bold text-black/50 shadow-sm dark:border-white/8 dark:bg-[#101114] dark:text-white/45"><span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-30" /><span className="relative inline-flex h-3 w-3 rounded-full bg-primary" /></span><span>{status}</span></div> : null}

                {artifacts.length ? <div className="grid gap-3 sm:grid-cols-2">{artifacts.map((artifact) => <ArtifactCard key={artifact.id} artifact={artifact} />)}</div> : null}

                {searchQuery ? <SearchResults queryText={searchQuery} results={searchResults} filter={searchFilter} onFilterChange={(value) => { setSearchFilter(value); void runFluxSearch(searchQuery); }} /> : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-black/6 bg-white/92 p-3 backdrop-blur-xl story-safe-bottom dark:border-white/10 dark:bg-black/92">
          {mode === "search" ? <div className="mx-auto mb-2 flex max-w-4xl gap-2 overflow-x-auto no-scrollbar">{SEARCH_FILTERS.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setSearchFilter(value)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black", searchFilter === value ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.045] text-black/50 dark:bg-white/7 dark:text-white/45")}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div> : null}
          <div className="mx-auto flex max-w-4xl items-end gap-2 rounded-[24px] border border-black/10 bg-[#f6f7f9] p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 dark:border-white/12 dark:bg-[#111216]">
            <span className="mb-1 ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-black shadow-sm dark:bg-black dark:text-white">{mode === "search" ? <Search className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}</span>
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={mode === "search" ? "Search people, groups, posts, or hashtags" : "Message AskAI"} className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:ring-0" />
            {loading ? <button type="button" onClick={stop} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black" aria-label="Stop"><Square className="h-4 w-4 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={!input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm disabled:opacity-35" aria-label="Send"><Send className="h-4 w-4" /></button>}
          </div>
          <p className="mt-2 text-center text-[10px] text-black/35 dark:text-white/30">No local model installation. Flux Search works directly with public Flux content.</p>
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

function ModeButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Bot; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-black transition", active ? "bg-black text-white shadow-sm dark:bg-white dark:text-black" : "text-black/50 hover:bg-black/[.04] dark:text-white/45 dark:hover:bg-white/7")}><Icon className="h-4 w-4" />{label}</button>;
}

function ArtifactCard({ artifact }: { artifact: AskArtifact }) {
  return <Link href={artifact.href} className="group overflow-hidden rounded-[22px] border border-black/7 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#101114]">{artifact.imageUrl ? <div className="aspect-[2/1] overflow-hidden bg-muted">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={assetUrl(artifact.imageUrl)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /></div> : null}<div className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300">{artifact.type === "group" ? <Users className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{artifact.title}</p><p className="text-xs text-black/40 dark:text-white/35">Open result</p></div><Zap className="h-4 w-4 text-primary" /></div></Link>;
}

function SearchResults({ queryText, results, filter, onFilterChange }: { queryText: string; results: FluxSearchResult[]; filter: "all" | FluxSearchKind; onFilterChange: (value: "all" | FluxSearchKind) => void }) {
  return <section className="overflow-hidden rounded-[24px] border border-black/7 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f1013]"><div className="border-b border-black/6 p-4 dark:border-white/10"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Search className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black">Results for “{queryText}”</h3><p className="text-xs text-black/40 dark:text-white/35">{results.length} matches across Flux</p></div></div><div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">{SEARCH_FILTERS.map(({ value, label }) => <button key={value} type="button" onClick={() => onFilterChange(value)} className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black", filter === value ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[.045] text-black/45 dark:bg-white/7 dark:text-white/40")}>{label}</button>)}</div></div>{results.length ? <div className="divide-y divide-black/6 dark:divide-white/8">{results.map((result) => <FluxResultRow key={`${result.kind}-${result.id}`} result={result} />)}</div> : <div className="grid min-h-40 place-items-center p-6 text-center"><div><Search className="mx-auto h-7 w-7 text-black/15 dark:text-white/15" /><p className="mt-3 text-sm font-black">No matching Flux content</p><p className="mt-1 text-xs text-black/35 dark:text-white/30">Try a username, group name, or hashtag.</p></div></div>}</section>;
}

function FluxResultRow({ result }: { result: FluxSearchResult }) {
  const Icon = result.kind === "person" ? Users : result.kind === "group" ? Layers3 : FileText;
  return <Link href={result.href} className="flex gap-3 p-4 transition hover:bg-black/[.025] dark:hover:bg-white/[.035]">{result.kind === "person" ? <UserAvatar user={{ displayName: result.title, username: result.subtitle.replace(/^@/, ""), avatarUrl: result.imageUrl }} size="md" clickable={false} /> : result.imageUrl ? <span className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-muted">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={assetUrl(result.imageUrl)} alt="" className="h-full w-full object-cover" /></span> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/8 text-primary"><Icon className="h-5 w-5" /></span>}<div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black">{result.title}</p><span className="shrink-0 rounded-full bg-black/[.04] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-black/40 dark:bg-white/7 dark:text-white/35">{result.kind}</span></div><p className="truncate text-xs text-black/40 dark:text-white/35">{result.subtitle}{result.meta ? ` · ${result.meta}` : ""}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-black/55 dark:text-white/50">{result.description}</p></div></Link>;
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
