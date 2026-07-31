"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Menu, Plus, Send, Square, Trash2, X } from "lucide-react";
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
import { streamLocalAskAI } from "@/lib/ai/local-web-llm";
import { stripThinkingText } from "@/lib/ai/strip-thinking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Help me write a strong Flux post",
  "Give me ideas for a Story",
  "Explain how group chats work",
  "Help me plan a community launch",
];

export default function AskAIPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (user) setConversations(await listConversations(user.uid));
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
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
  }, [messages, streaming, status]);

  const newChat = async () => {
    if (!user) return;
    const id = await createConversation(user.uid, "New chat");
    setActiveId(id);
    setMessages([]);
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

  const send = async (override?: string) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;

    let conversationId = activeId;
    if (!conversationId) {
      conversationId = await createConversation(user.uid, text.slice(0, 52));
      setActiveId(conversationId);
    }

    const userMessage: AIMessage = { id: `local-user-${Date.now()}`, role: "user", content: text, createdAt: null };
    const history = [...messages, userMessage]
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((items) => [...items, userMessage]);
    setInput("");
    setStreaming("");
    setStatus("Thinking…");
    setProgress(null);
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await addMessage(conversationId, { role: "user", content: text });
      if (messages.length === 0) void renameConversation(conversationId, text.slice(0, 52));

      const configuredEndpoint = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT?.trim();
      const isStaticPages = Boolean(process.env.NEXT_PUBLIC_BASE_PATH);
      let answer = "";

      if (isStaticPages && !configuredEndpoint) {
        answer = await streamLocalAskAI({
          messages: history,
          signal: controller.signal,
          onProgress: (label, value) => {
            setStatus(label);
            setProgress(value ?? null);
          },
          onToken: (token) => {
            answer += token;
            setStreaming(stripThinkingText(answer));
            setStatus(null);
          },
        });
      } else {
        answer = await streamServerAskAI({
          endpoint: configuredEndpoint || "/api/ask-ai",
          uid: user.uid,
          message: text,
          history,
          signal: controller.signal,
          onStatus: setStatus,
          onToken: (token) => {
            answer += token;
            setStreaming(stripThinkingText(answer));
            setStatus(null);
          },
        });
      }

      const clean = stripThinkingText(answer).trim() || "I couldn't create a reply. Please try again.";
      await addMessage(conversationId, { role: "assistant", content: clean });
      setMessages((items) => [...items, { id: `local-ai-${Date.now()}`, role: "assistant", content: clean, createdAt: null }]);
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
      setProgress(null);
      setStreaming("");
      abortRef.current = null;
    }
  };

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_env(safe-area-inset-top))] min-h-0 bg-background lg:h-[100dvh]">
      <aside className={cn("fixed inset-y-0 left-0 z-[60] flex w-[300px] flex-col border-r border-border bg-background transition-transform md:static md:z-auto", historyOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0")}>
        <div className="flex h-[53px] items-center gap-2 border-b border-border px-3">
          <Button onClick={() => void newChat()} className="flex-1 rounded-full"><Plus className="h-4 w-4" />New chat</Button>
          <button type="button" onClick={() => setHistoryOpen(false)} className="social-action md:hidden" aria-label="Close history"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {conversations.map((conversation) => (
            <div key={conversation.id} className={cn("group flex items-center rounded-xl px-2 transition-colors hover:bg-muted", activeId === conversation.id && "bg-muted")}>
              <button type="button" onClick={() => { setActiveId(conversation.id); setHistoryOpen(false); }} className="min-w-0 flex-1 truncate px-2 py-3 text-left text-sm font-semibold">{conversation.title}</button>
              <button type="button" onClick={async () => { await deleteConversation(conversation.id); if (activeId === conversation.id) setActiveId(null); await refresh(); }} className="social-action h-9 min-h-9 w-9 min-w-9 opacity-0 group-hover:opacity-100" aria-label="Delete chat"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">AskAI by Ripo Team</p>
      </aside>

      {historyOpen ? <button type="button" className="fixed inset-0 z-50 bg-black/35 md:hidden" onClick={() => setHistoryOpen(false)} aria-label="Close history" /> : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[53px] items-center gap-3 border-b border-border px-3">
          <button type="button" onClick={() => setHistoryOpen(true)} className="social-action md:hidden" aria-label="Open chat history"><Menu className="h-5 w-5" /></button>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-white"><Bot className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h1 className="truncate font-bold">AskAI</h1><p className="truncate text-xs text-muted-foreground">Server AI when available, private local AI on static Flux</p></div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6 sm:px-6">
            {messages.length === 0 && !loading ? (
              <div className="my-auto py-10 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-white"><Bot className="h-7 w-7" /></span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight">What can I help with?</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Ask about Flux, write posts, plan Stories, explain features, or work through an idea.</p>
                <div className="mx-auto mt-7 grid max-w-xl gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="rounded-2xl border border-border p-4 text-left text-sm font-semibold transition-colors hover:bg-muted">{suggestion}</button>)}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((message) => (
                  <article key={message.id} className={cn("flex gap-3", message.role === "user" && "justify-end")}>
                    {message.role === "assistant" ? <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white"><Bot className="h-4 w-4" /></span> : null}
                    <div className={cn("max-w-[88%] text-[15px] leading-7", message.role === "user" ? "rounded-2xl rounded-br-md bg-muted px-4 py-2.5" : "min-w-0 flex-1")}>
                      {message.role === "assistant" ? <ReactMarkdown>{message.content}</ReactMarkdown> : <p className="whitespace-pre-wrap">{message.content}</p>}
                    </div>
                  </article>
                ))}
                {streaming ? <article className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white"><Bot className="h-4 w-4" /></span><div className="min-w-0 flex-1 text-[15px] leading-7"><ReactMarkdown>{streaming}</ReactMarkdown></div></article> : null}
                {status ? <div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span>{status}{progress !== null ? ` ${progress}%` : ""}</span></div> : null}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-border bg-background p-3 story-safe-bottom">
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-input bg-background p-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Message AskAI" className="max-h-40 min-h-10 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0" />
            {loading ? <button type="button" onClick={stop} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background" aria-label="Stop"><Square className="h-4 w-4 fill-current" /></button> : <button type="button" onClick={() => void send()} disabled={!input.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white disabled:opacity-40" aria-label="Send"><Send className="h-4 w-4" /></button>}
          </div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Local mode downloads a compact model once and keeps it in your browser cache.</p>
        </footer>
      </section>
    </main>
  );
}

async function streamServerAskAI(input: {
  endpoint: string;
  uid: string;
  message: string;
  history: Array<{ role: string; content: string }>;
  signal: AbortSignal;
  onStatus: (status: string | null) => void;
  onToken: (token: string) => void;
}): Promise<string> {
  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({ message: input.message, history: input.history, uid: input.uid }),
  });
  if (!response.ok || !response.body) throw new Error("AskAI server is unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

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
        if (data.type === "status") input.onStatus(String(data.label || "Thinking…"));
        if (data.type === "status_clear") input.onStatus(null);
        if (data.type === "token" && data.content) {
          const token = String(data.content);
          full += token;
          input.onToken(token);
        }
        if (data.type === "error") throw new Error(String(data.error || "AskAI failed"));
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  return full;
}
