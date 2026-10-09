"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  Copy,
  Image as ImageIcon,
  Menu,
  MessageSquarePlus,
  Mic,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import {
  ASKAI_SYSTEM_PROMPT,
  ASKAI_THINK_SYSTEM_PROMPT,
  imagineUrl,
  streamChat,
  type ChatMsg,
} from "@/lib/ai/pollinations";

/* ------------------------------------------------------------------ */
/* Types + storage                                                     */
/* ------------------------------------------------------------------ */

type Role = "user" | "assistant";
type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  imageUrl?: string;
  imagePrompt?: string;
  createdAt: number;
};
type Conversation = { id: string; title: string; createdAt: number };

const CHATS_KEY = "flux-askai-v2-chats";
const MSGS_KEY = (id: string) => `flux-askai-v2-msgs-${id}`;
const THINK_KEY = "flux-askai-v2-think";

const SUGGESTIONS = [
  { icon: Zap, label: "Explain like I'm 5", prompt: "Explain how black holes work like I'm 5 years old." },
  { icon: Brain, label: "Think hard", prompt: "Think step by step: is it better to learn guitar or piano first, and why?" },
  { icon: ImageIcon, label: "Imagine", prompt: "/imagine a cozy cyberpunk ramen shop at night, neon rain" },
  { icon: Sparkles, label: "Write something", prompt: "Write a short funny poem about Mondays." },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadChats(): Conversation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CHATS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((c) => c && c.id && c.title) : [];
  } catch {
    return [];
  }
}

function loadMessages(id: string): ChatMessage[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MSGS_KEY(id)) || "[]");
    return Array.isArray(raw) ? raw.filter((m) => m && m.id && m.role && typeof m.content === "string") : [];
  } catch {
    return [];
  }
}

function titleFromText(text: string): string {
  const clean = text.replace(/^\/imagine\s+/i, "").replace(/\s+/g, " ").trim();
  return clean.split(" ").slice(0, 8).join(" ").slice(0, 60) || "New chat";
}

/* ------------------------------------------------------------------ */
/* Markdown with copyable code blocks                                  */
/* ------------------------------------------------------------------ */

function Markdown({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="askg-md">
      <ReactMarkdown
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code(props: any) {
            const { className, children } = props;
            const code = String(children || "").replace(/\n$/, "");
            const isBlock = /language-/.test(className || "") || code.includes("\n");
            if (!isBlock) {
              return <code className="askg-inline-code">{children}</code>;
            }
            return (
              <span className="askg-codeblock">
                <span className="askg-codeblock-bar">
                  <span>code</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(code);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1200);
                      } catch { /* clipboard unavailable */ }
                    }}
                    aria-label="Copy code"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </span>
                <code>{children}</code>
              </span>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thinking block — collapsible reasoning stream                       */
/* ------------------------------------------------------------------ */

function ThinkingBlock({ reasoning, streaming }: { reasoning: string; streaming: boolean }) {
  const [open, setOpen] = useState(true);
  if (!reasoning && !streaming) return null;
  return (
    <div className="askg-thinking">
      <button type="button" onClick={() => setOpen((v) => !v)} className="askg-thinking-head" aria-expanded={open}>
        <span className={cn("askg-thinking-dot", streaming && "is-live")} />
        <span>{streaming && !reasoning ? "Thinking…" : streaming ? "Thinking…" : "Thought"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
      </button>
      {open ? (
        <div className="askg-thinking-body">
          {reasoning ? <Markdown text={reasoning} /> : <span className="askg-shimmer">Reasoning…</span>}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Message bubble                                                      */
/* ------------------------------------------------------------------ */

function MessageItem({
  message,
  onCopy,
  copied,
  onRegenerate,
  isLast,
  streaming,
}: {
  message: ChatMessage;
  onCopy: () => void;
  copied: boolean;
  onRegenerate?: () => void;
  isLast: boolean;
  streaming: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={cn("askg-msg", isUser ? "is-user" : "is-assistant")}>
      {!isUser ? (
        <span className="askg-assistant-mark" aria-hidden>
          <span className="askg-orb askg-orb-sm" />
        </span>
      ) : null}
      <div className="askg-msg-main">
        {message.reasoning ? <ThinkingBlock reasoning={message.reasoning} streaming={streaming && isLast} /> : null}
        {message.imageUrl ? (
          <div className="askg-image-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={message.imageUrl} alt={message.imagePrompt || "Generated image"} loading="lazy" />
            {message.imagePrompt ? <p className="askg-image-prompt">{message.imagePrompt}</p> : null}
          </div>
        ) : null}
        {message.content ? (
          isUser ? (
            <div className="askg-user-text">{message.content}</div>
          ) : (
            <Markdown text={message.content} />
          )
        ) : streaming && isLast && !message.imageUrl ? (
          <span className="askg-typing"><span /><span /><span /></span>
        ) : null}
        {!isUser && (message.content || message.imageUrl) ? (
          <div className="askg-msg-actions">
            <button type="button" onClick={onCopy} aria-label="Copy response" className="askg-icon-btn">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {isLast && onRegenerate ? (
              <button type="button" onClick={onRegenerate} aria-label="Regenerate response" className="askg-icon-btn">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main AskAI — Grok-equivalent experience, AskAI branding              */
/* ------------------------------------------------------------------ */

export default function AskAIGrok() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinkMode, setThinkMode] = useState(false);
  const [imagineMode, setImagineMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);

  /* Auto-grow textarea */
  useEffect(() => {
    setConversations(loadChats());
    try {
      setThinkMode(localStorage.getItem(THINK_KEY) === "1");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    setMessages(loadMessages(activeId));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* Auto-grow textarea */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  const persistMessages = useCallback((id: string, next: ChatMessage[]) => {
    setMessages(next);
    try {
      localStorage.setItem(MSGS_KEY(id), JSON.stringify(next.slice(-100)));
    } catch { /* storage full */ }
  }, []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, []);

  const openChat = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  /* Keyboard shortcuts — Grok-style: Ctrl/Cmd+N new chat, Ctrl/Cmd+/ focus composer */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "n") {
        e.preventDefault();
        newChat();
      } else if (mod && e.key === "/") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  const deleteChat = useCallback((id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      try {
        localStorage.setItem(CHATS_KEY, JSON.stringify(next));
        localStorage.removeItem(MSGS_KEY(id));
      } catch { /* ignore */ }
      return next;
    });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }, [activeId]);

  const ensureChat = useCallback((firstText: string): string => {
    if (activeId) return activeId;
    const id = uid();
    const convo: Conversation = { id, title: titleFromText(firstText), createdAt: Date.now() };
    setConversations((prev) => {
      const next = [convo, ...prev].slice(0, 100);
      try {
        localStorage.setItem(CHATS_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    setActiveId(id);
    return id;
  }, [activeId]);

  /* ------------------------------ send ------------------------------ */

  const send = useCallback(async (rawText?: string, opts?: { regenerate?: boolean }) => {
    const text = (rawText ?? input).trim();
    if (!text || streaming) return;

    const isImagine = imagineMode || /^\/imagine\s+/i.test(text);
    const cleanText = text.replace(/^\/imagine\s+/i, "").trim();
    if (isImagine && !cleanText) {
      toast.error("Describe what to imagine after /imagine");
      return;
    }

    const chatId = ensureChat(text);
    const controller = new AbortController();
    abortRef.current = controller;
    setInput("");
    setStreaming(true);

    /* --- Imagine mode: generate an image --- */
    if (isImagine) {
      const userMsg: ChatMessage = { id: uid(), role: "user", content: cleanText, createdAt: Date.now() };
      const placeholder: ChatMessage = { id: uid(), role: "assistant", content: "", imagePrompt: cleanText, createdAt: Date.now() };
      const base = opts?.regenerate ? messages.filter((m) => m.id !== messages[messages.length - 1]?.id) : [...messages, userMsg];
      const withPlaceholder = [...base, placeholder];
      persistMessages(chatId, withPlaceholder);
      setImageLoading(true);
      try {
        const url = imagineUrl(cleanText);
        // Preload so the shimmer only lifts when the image is ready.
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image generation failed"));
          img.src = url;
          window.setTimeout(() => reject(new Error("Image took too long")), 120_000);
        });
        persistMessages(chatId, withPlaceholder.map((m) =>
          m.id === placeholder.id ? { ...m, imageUrl: url } : m
        ));
      } catch {
        persistMessages(chatId, withPlaceholder.map((m) =>
          m.id === placeholder.id ? { ...m, content: "The image didn't come through — try again in a moment." } : m
        ));
      } finally {
        setImageLoading(false);
        setStreaming(false);
        abortRef.current = null;
      }
      return;
    }

    /* --- Chat mode: stream from Pollinations (same AI as the Discord bots) --- */
    const history: ChatMsg[] = [
      { role: "system", content: thinkMode ? ASKAI_THINK_SYSTEM_PROMPT : ASKAI_SYSTEM_PROMPT },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content && !m.imageUrl)
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    let next: ChatMessage[];
    if (opts?.regenerate) {
      // Drop the last assistant message, keep everything else.
      const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");
      next = lastAssistantIdx >= 0 ? messages.slice(0, lastAssistantIdx) : messages;
    } else {
      const userMsg: ChatMessage = { id: uid(), role: "user", content: text, createdAt: Date.now() };
      next = [...messages, userMsg];
    }
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", reasoning: "", createdAt: Date.now() };
    persistMessages(chatId, [...next, assistantMsg]);

    try {
      const result = await streamChat(
        [...history, { role: "user", content: text }],
        {
          signal: controller.signal,
          onReasoning: (reasoning) => {
            setMessages((cur) => {
              const updated = cur.map((m) => (m.id === assistantMsg.id ? { ...m, reasoning } : m));
              try { localStorage.setItem(MSGS_KEY(chatId), JSON.stringify(updated.slice(-100))); } catch { /* ignore */ }
              return updated;
            });
          },
          onContent: (content) => {
            setMessages((cur) => {
              const updated = cur.map((m) => (m.id === assistantMsg.id ? { ...m, content } : m));
              try { localStorage.setItem(MSGS_KEY(chatId), JSON.stringify(updated.slice(-100))); } catch { /* ignore */ }
              return updated;
            });
          },
        }
      );
      void result;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        // Keep whatever streamed so far.
      } else {
        const msg = error instanceof Error ? error.message : "AskAI hiccuped.";
        setMessages((cur) => {
          const updated = cur.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content || `Hmm, that didn't work — ${msg}` }
              : m
          );
          try { localStorage.setItem(MSGS_KEY(chatId), JSON.stringify(updated.slice(-100))); } catch { /* ignore */ }
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, imagineMode, thinkMode, messages, ensureChat, persistMessages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    setImageLoading(false);
  }, []);

  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser && !streaming) void send(lastUser.content, { regenerate: true });
  }, [messages, streaming, send]);

  const copyMessage = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch { /* clipboard unavailable */ }
  }, []);

  /* ------------------------------ voice ------------------------------ */

  const toggleListening = useCallback(() => {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Rec = (SR.SpeechRecognition || SR.webkitSpeechRecognition) as (new () => {
      lang: string; interimResults: boolean;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onend: (() => void) | null; onerror: (() => void) | null;
      start: () => void; stop: () => void;
    } | undefined);
    if (!Rec) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    try {
      const recog = new Rec()!;
      recog.lang = "en-US";
      recog.interimResults = true;
      recog.onresult = (e) => {
        const transcript = Array.from(e.results).map((r) => r[0]?.transcript || "").join("");
        setInput(transcript);
      };
      recog.onend = () => { setListening(false); recogRef.current = null; };
      recog.onerror = () => { setListening(false); recogRef.current = null; };
      recogRef.current = recog;
      recog.start();
      setListening(true);
    } catch {
      toast.error("Couldn't start voice input.");
    }
  }, [listening]);

  const toggleThink = useCallback(() => {
    setThinkMode((v) => {
      try { localStorage.setItem(THINK_KEY, v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send();
  };

  const filtered = useMemo(
    () => conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase())),
    [conversations, search]
  );

  const showEmpty = messages.length === 0 && !streaming;

  /* ------------------------------ render ------------------------------ */

  return (
    <main className="askg-shell">
      {/* Sidebar */}
      <aside className={cn("askg-sidebar", sidebarOpen && "is-open")}>
        <div className="askg-side-head">
          <Link href="/home" className="askg-back" aria-label="Back to Flux home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="askg-brand">
            <span className="askg-orb askg-orb-sm" aria-hidden />
            <strong>AskAI</strong>
          </div>
          <button type="button" className="askg-icon-btn askg-only-mobile" onClick={() => setSidebarOpen(false)} aria-label="Close chats">
            <X className="h-5 w-5" />
          </button>
        </div>

        <button type="button" className="askg-new-chat" onClick={newChat}>
          <MessageSquarePlus className="h-5 w-5" />
          <span>New chat</span>
        </button>

        <label className="askg-search">
          <span className="askg-search-icon">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" />
        </label>

        <div className="askg-history">
          {filtered.map((c) => (
            <div key={c.id} className={cn("askg-history-row", activeId === c.id && "is-active")}>
              <button type="button" onClick={() => openChat(c.id)} className="askg-history-title">
                {c.title}
              </button>
              <button type="button" onClick={() => deleteChat(c.id)} aria-label="Delete chat" className="askg-icon-btn askg-delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {filtered.length === 0 ? <p className="askg-history-empty">No chats yet.</p> : null}
        </div>

        <div className="askg-side-foot">
          <UserAvatar user={profile} size="sm" clickable={false} />
          <div className="askg-side-user">
            <strong>{profile?.displayName || "Flux user"}</strong>
            <span>@{profile?.username || "user"}</span>
          </div>
        </div>
      </aside>
      {sidebarOpen ? <button type="button" className="askg-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close chats" /> : null}

      {/* Main chat */}
      <section className="askg-main">
        <header className="askg-topbar">
          <button type="button" className="askg-icon-btn askg-only-mobile" onClick={() => setSidebarOpen(true)} aria-label="Open chats">
            <Menu className="h-5 w-5" />
          </button>
          <div className="askg-model-badge">
            <span className="askg-orb askg-orb-xs" aria-hidden />
            <div>
              <strong>AskAI</strong>
              <span>Same AI as the RipoBot Discord bots · Free</span>
            </div>
          </div>
          <button type="button" className="askg-icon-btn" onClick={newChat} aria-label="New chat">
            <Plus className="h-5 w-5" />
          </button>
        </header>

        <div className="askg-scroll">
          {showEmpty ? (
            <div className="askg-empty">
              <span className="askg-orb askg-orb-lg" aria-hidden />
              <h1>Ask anything</h1>
              <p>Chat, think deeper, or imagine images — powered by the same AI as our Discord bots.</p>
              <div className="askg-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className="askg-suggestion"
                    style={{ animationDelay: `${SUGGESTIONS.indexOf(s) * 70}ms` }}
                    onClick={() => {
                      if (s.prompt.startsWith("/imagine")) setImagineMode(true);
                      void send(s.prompt);
                    }}
                  >
                    <s.icon className="h-4 w-4" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="askg-messages">
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1}
                  streaming={streaming}
                  copied={copiedId === m.id}
                  onCopy={() => copyMessage(m)}
                  onRegenerate={m.role === "assistant" ? regenerate : undefined}
                />
              ))}
              {imageLoading ? (
                <div className="askg-msg is-assistant">
                  <span className="askg-assistant-mark" aria-hidden><span className="askg-orb askg-orb-sm" /></span>
                  <div className="askg-msg-main"><div className="askg-image-shimmer"><span className="askg-shimmer">Dreaming up your image…</span></div></div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="askg-composer-zone">
          <form className={cn("askg-composer", thinkMode && "is-think", imagineMode && "is-imagine")} onSubmit={submit}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={imagineMode ? "Describe the image to imagine…" : "Ask anything…"}
              rows={1}
              aria-label="Message AskAI"
            />
            <div className="askg-composer-bar">
              <div className="askg-modes">
                <button
                  type="button"
                  className={cn("askg-mode-pill", thinkMode && "is-active")}
                  onClick={toggleThink}
                  aria-pressed={thinkMode}
                  title="Think — deeper reasoning, shows its thoughts"
                >
                  <Brain className="h-3.5 w-3.5" />
                  <span>Think</span>
                </button>
                <button
                  type="button"
                  className={cn("askg-mode-pill", imagineMode && "is-active")}
                  onClick={() => setImagineMode((v) => !v)}
                  aria-pressed={imagineMode}
                  title="Imagine — generate images"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Imagine</span>
                </button>
              </div>
              <div className="askg-composer-actions">
                <button
                  type="button"
                  className={cn("askg-icon-btn", listening && "is-live")}
                  onClick={toggleListening}
                  aria-label={listening ? "Stop voice input" : "Voice input"}
                  title="Voice input"
                >
                  {listening ? (
                    <span className="askg-wave" aria-hidden>
                      <span /><span /><span /><span />
                    </span>
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
                {streaming ? (
                  <button type="button" className="askg-send is-stop" onClick={stop} aria-label="Stop generating">
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button type="submit" className="askg-send" disabled={!input.trim()} aria-label="Send">
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </form>
          <p className="askg-disclaimer">AskAI can make mistakes. Verify important information.</p>
        </footer>
      </section>
    </main>
  );
}
