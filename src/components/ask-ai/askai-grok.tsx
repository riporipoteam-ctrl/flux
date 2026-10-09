"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  Clock,
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
/* Types + storage — Grok Bot style: persistent named teammates         */
/* ------------------------------------------------------------------ */

type Role = "user" | "assistant";
type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  imageUrl?: string;
  imagePrompt?: string;
  routineName?: string;
  createdAt: number;
};
type Conversation = { id: string; title: string; createdAt: number; routineId?: string };
type Bot = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  personality: string;
  createdAt: number;
};
type MemoryItem = { id: string; text: string; createdAt: number };
type Routine = {
  id: string;
  botId: string;
  name: string;
  prompt: string;
  intervalMinutes: number;
  lastRun: number | null;
  enabled: boolean;
};

const BOTS_KEY = "flux-askai-v3-bots";
const ACTIVE_BOT_KEY = "flux-askai-v3-active-bot";
const CHATS_KEY = (botId: string) => `flux-askai-v3-chats-${botId}`;
const MSGS_KEY = (chatId: string) => `flux-askai-v3-msgs-${chatId}`;
const MEMORY_KEY = (botId: string) => `flux-askai-v3-memory-${botId}`;
const ROUTINES_KEY = "flux-askai-v3-routines";
const THINK_KEY = "flux-askai-v2-think";

const BOT_EMOJIS = ["🤖", "✨", "🧠", "⚡", "🔥", "💜", "🎨", "🚀", "👾", "🦾", "💡", "🎯"];
const BOT_COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#db2777", "#e11d48", "#65a30d"];

const ROUTINE_INTERVALS = [
  { label: "Every hour", minutes: 60 },
  { label: "Every 3 hours", minutes: 180 },
  { label: "Daily", minutes: 1440 },
  { label: "Weekly", minutes: 10080 },
];

const SUGGESTIONS = [
  { icon: Zap, label: "Explain like I'm 5", prompt: "Explain how black holes work like I'm 5 years old." },
  { icon: Brain, label: "Think hard", prompt: "Think step by step: is it better to learn guitar or piano first, and why?" },
  { icon: ImageIcon, label: "Imagine", prompt: "/imagine a cozy cyberpunk ramen shop at night, neon rain" },
  { icon: Sparkles, label: "Write something", prompt: "Write a short funny poem about Mondays." },
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "null");
    return (raw as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full/blocked */ }
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
        <span>{streaming ? "Thinking…" : "Thought"}</span>
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
  botEmoji,
  onCopy,
  copied,
  onRegenerate,
  isLast,
  streaming,
}: {
  message: ChatMessage;
  botEmoji: string;
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
          {botEmoji}
        </span>
      ) : null}
      <div className="askg-msg-main">
        {message.routineName ? <div className="askg-routine-tag"><Clock className="h-3 w-3" />{message.routineName}</div> : null}
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
/* Main AskAI — Grok Bot style teammates                               */
/* ------------------------------------------------------------------ */

export default function AskAIGrok() {
  const { profile } = useAuth();
  const [bots, setBots] = useState<Bot[]>([]);
  const [activeBotId, setActiveBotId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinkMode, setThinkMode] = useState(false);
  const [imagineMode, setImagineMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"memory" | "routines" | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  /* bot creator */
  const [showCreator, setShowCreator] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState(BOT_EMOJIS[0]);
  const [newColor, setNewColor] = useState(BOT_COLORS[0]);
  const [newPersonality, setNewPersonality] = useState("");
  /* routine creator */
  const [showRoutineCreator, setShowRoutineCreator] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routinePrompt, setRoutinePrompt] = useState("");
  const [routineMinutes, setRoutineMinutes] = useState(1440);
  /* memory adder */
  const [memoryDraft, setMemoryDraft] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recogRef = useRef<{ stop: () => void } | null>(null);
  const routineRunningRef = useRef<Set<string>>(new Set());

  const activeBot = useMemo(() => bots.find((b) => b.id === activeBotId) || null, [bots, activeBotId]);

  /* ------------------------- init + migration ------------------------- */

  useEffect(() => {
    let list = readJSON<Bot[]>(BOTS_KEY, []);
    if (!list.length) {
      // First run: create the default AskAI teammate, migrate v2 chats to it.
      const bot: Bot = {
        id: uid(),
        name: "AskAI",
        emoji: "✨",
        color: "#7c3aed",
        personality: "",
        createdAt: Date.now(),
      };
      list = [bot];
      writeJSON(BOTS_KEY, list);
      try {
        const v2 = JSON.parse(localStorage.getItem("flux-askai-v2-chats") || "[]");
        if (Array.isArray(v2) && v2.length) {
          writeJSON(CHATS_KEY(bot.id), v2.slice(0, 100));
          for (const c of v2.slice(0, 100)) {
            const msgs = localStorage.getItem(`flux-askai-v2-msgs-${c.id}`);
            if (msgs) localStorage.setItem(MSGS_KEY(c.id), msgs);
          }
        }
      } catch { /* no v2 data */ }
    }
    setBots(list);
    const savedActive = (() => { try { return localStorage.getItem(ACTIVE_BOT_KEY); } catch { return null; } })();
    const first = list.find((b) => b.id === savedActive) || list[0];
    setActiveBotId(first.id);
    setRoutines(readJSON<Routine[]>(ROUTINES_KEY, []));
    try { setThinkMode(localStorage.getItem(THINK_KEY) === "1"); } catch { /* ignore */ }
  }, []);

  /* Load per-bot data when the active bot changes */
  useEffect(() => {
    if (!activeBotId) return;
    setConversations(readJSON<Conversation[]>(CHATS_KEY(activeBotId), []));
    setMemories(readJSON<MemoryItem[]>(MEMORY_KEY(activeBotId), []));
    setActiveId(null);
    setMessages([]);
    try { localStorage.setItem(ACTIVE_BOT_KEY, activeBotId); } catch { /* ignore */ }
  }, [activeBotId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setMessages(readJSON<ChatMessage[]>(MSGS_KEY(activeId), []));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  /* Keyboard shortcuts */
  const newChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); newChat(); }
      else if (mod && e.key === "/") { e.preventDefault(); textareaRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  /* ------------------------- bots ------------------------- */

  const createBot = useCallback(() => {
    const name = newName.trim().slice(0, 24);
    if (!name) { toast.error("Give your teammate a name"); return; }
    const bot: Bot = { id: uid(), name, emoji: newEmoji, color: newColor, personality: newPersonality.trim().slice(0, 2000), createdAt: Date.now() };
    setBots((prev) => {
      const next = [...prev, bot];
      writeJSON(BOTS_KEY, next);
      return next;
    });
    setNewName(""); setNewPersonality(""); setNewEmoji(BOT_EMOJIS[0]); setNewColor(BOT_COLORS[0]);
    setShowCreator(false);
    setActiveBotId(bot.id);
    toast.success(`${bot.emoji} ${bot.name} joined the team`);
  }, [newName, newEmoji, newColor, newPersonality]);

  const deleteBot = useCallback((id: string) => {
    setBots((prev) => {
      if (prev.length <= 1) { toast.error("Keep at least one teammate"); return prev; }
      const next = prev.filter((b) => b.id !== id);
      writeJSON(BOTS_KEY, next);
      return next;
    });
    setRoutines((prev) => {
      const next = prev.filter((r) => r.botId !== id);
      writeJSON(ROUTINES_KEY, next);
      return next;
    });
    if (activeBotId === id) {
      const remaining = bots.filter((b) => b.id !== id);
      if (remaining[0]) setActiveBotId(remaining[0].id);
    }
  }, [activeBotId, bots]);

  /* ------------------------- memory ------------------------- */

  const addMemory = useCallback((text: string) => {
    const clean = text.trim().slice(0, 500);
    if (!clean || !activeBotId) return;
    const item: MemoryItem = { id: uid(), text: clean, createdAt: Date.now() };
    setMemories((prev) => {
      const next = [item, ...prev].slice(0, 200);
      writeJSON(MEMORY_KEY(activeBotId), next);
      return next;
    });
  }, [activeBotId]);

  const deleteMemory = useCallback((id: string) => {
    if (!activeBotId) return;
    setMemories((prev) => {
      const next = prev.filter((m) => m.id !== id);
      writeJSON(MEMORY_KEY(activeBotId), next);
      return next;
    });
  }, [activeBotId]);

  /* "remember ..." auto-capture */
  const maybeCaptureMemory = useCallback((text: string): boolean => {
    const m = text.match(/^remember (?:that )?(.+)/i);
    if (m && m[1].trim().length > 3) {
      addMemory(m[1]);
      toast.success("Got it — I'll remember that");
      return true;
    }
    return false;
  }, [addMemory]);

  const botSystemPrompt = useCallback((bot: Bot, mems: MemoryItem[], think: boolean) => {
    const base = think ? ASKAI_THINK_SYSTEM_PROMPT : ASKAI_SYSTEM_PROMPT;
    const identity = `Your name is ${bot.name}.`;
    const personality = bot.personality ? `Your personality and instructions from your owner: ${bot.personality}` : "";
    const memory = mems.length
      ? `Things you remember about the user (use them naturally, never recite the list):\n${mems.map((m, i) => `${i + 1}. ${m.text}`).join("\n")}`
      : "";
    return [base, identity, personality, memory].filter(Boolean).join("\n\n");
  }, []);

  /* ------------------------- routines ------------------------- */

  const createRoutine = useCallback(() => {
    if (!activeBotId) return;
    const name = routineName.trim().slice(0, 40);
    const prompt = routinePrompt.trim().slice(0, 2000);
    if (!name || !prompt) { toast.error("Name your routine and tell it what to do"); return; }
    const routine: Routine = { id: uid(), botId: activeBotId, name, prompt, intervalMinutes: routineMinutes, lastRun: null, enabled: true };
    setRoutines((prev) => {
      const next = [...prev, routine];
      writeJSON(ROUTINES_KEY, next);
      return next;
    });
    setRoutineName(""); setRoutinePrompt(""); setRoutineMinutes(1440);
    setShowRoutineCreator(false);
    toast.success(`Routine "${name}" set — runs ${ROUTINE_INTERVALS.find((r) => r.minutes === routineMinutes)?.label.toLowerCase()}`);
  }, [activeBotId, routineName, routinePrompt, routineMinutes]);

  const toggleRoutine = useCallback((id: string) => {
    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
      writeJSON(ROUTINES_KEY, next);
      return next;
    });
  }, []);

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => {
      const next = prev.filter((r) => r.id !== id);
      writeJSON(ROUTINES_KEY, next);
      return next;
    });
  }, []);

  const runRoutine = useCallback(async (routine: Routine) => {
    if (routineRunningRef.current.has(routine.id)) return;
    routineRunningRef.current.add(routine.id);
    try {
      const bot = readJSON<Bot[]>(BOTS_KEY, []).find((b) => b.id === routine.botId);
      if (!bot) return;
      const mems = readJSON<MemoryItem[]>(MEMORY_KEY(bot.id), []);
      const system = botSystemPrompt(bot, mems, false);

      // Find or create the routine's conversation.
      const chatsKey = CHATS_KEY(bot.id);
      const chats = readJSON<Conversation[]>(chatsKey, []);
      let convo = chats.find((c) => c.routineId === routine.id);
      if (!convo) {
        convo = { id: uid(), title: `⚡ ${routine.name}`, createdAt: Date.now(), routineId: routine.id };
        const nextChats = [convo, ...chats].slice(0, 100);
        writeJSON(chatsKey, nextChats);
        if (bot.id === activeBotId) setConversations(nextChats);
      }
      const chatId = convo.id;
      const runMsg: ChatMessage = { id: uid(), role: "assistant", content: "", reasoning: "", routineName: routine.name, createdAt: Date.now() };
      const existing = readJSON<ChatMessage[]>(MSGS_KEY(chatId), []);
      const withRun = [...existing, runMsg];
      writeJSON(MSGS_KEY(chatId), withRun.slice(-100));
      if (chatId === activeId) setMessages(withRun);

      const { content } = await streamChat(
        [
          { role: "system", content: system },
          { role: "user", content: `Routine "${routine.name}": ${routine.prompt}` },
        ],
        {
          onContent: (text) => {
            const updated = withRun.map((m) => (m.id === runMsg.id ? { ...m, content: text } : m));
            writeJSON(MSGS_KEY(chatId), updated.slice(-100));
            if (chatId === activeId) setMessages(updated);
          },
        }
      );
      void content;
      setRoutines((prev) => {
        const next = prev.map((r) => (r.id === routine.id ? { ...r, lastRun: Date.now() } : r));
        writeJSON(ROUTINES_KEY, next);
        return next;
      });
    } catch {
      // Routine failures stay silent; the next tick retries.
    } finally {
      routineRunningRef.current.delete(routine.id);
    }
  }, [activeBotId, activeId, botSystemPrompt]);

  /* Routine ticker — checks every 30s while AskAI is open */
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      for (const r of readJSON<Routine[]>(ROUTINES_KEY, [])) {
        if (!r.enabled) continue;
        const due = !r.lastRun || now - r.lastRun >= r.intervalMinutes * 60_000;
        if (due) void runRoutine(r);
      }
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [runRoutine]);

  /* ------------------------- chats ------------------------- */

  const persistMessages = useCallback((chatId: string, next: ChatMessage[]) => {
    if (chatId === activeId) setMessages(next);
    writeJSON(MSGS_KEY(chatId), next.slice(-100));
  }, [activeId]);

  const openChat = useCallback((id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
  }, []);

  const deleteChat = useCallback((id: string) => {
    if (!activeBotId) return;
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      writeJSON(CHATS_KEY(activeBotId), next);
      return next;
    });
    try { localStorage.removeItem(MSGS_KEY(id)); } catch { /* ignore */ }
    if (activeId === id) { setActiveId(null); setMessages([]); }
  }, [activeBotId, activeId]);

  const ensureChat = useCallback((firstText: string): string => {
    if (activeId) return activeId;
    if (!activeBotId) throw new Error("Pick a teammate first");
    const id = uid();
    const convo: Conversation = { id, title: titleFromText(firstText), createdAt: Date.now() };
    setConversations((prev) => {
      const next = [convo, ...prev].slice(0, 100);
      writeJSON(CHATS_KEY(activeBotId), next);
      return next;
    });
    setActiveId(id);
    return id;
  }, [activeId, activeBotId]);

  /* ------------------------- send ------------------------- */

  const send = useCallback(async (rawText?: string, opts?: { regenerate?: boolean }) => {
    const text = (rawText ?? input).trim();
    if (!text || streaming || !activeBot) return;

    /* "remember ..." goes straight to memory, no AI call needed */
    if (!opts?.regenerate && maybeCaptureMemory(text)) {
      setInput("");
      return;
    }

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
    const mems = readJSON<MemoryItem[]>(MEMORY_KEY(activeBot.id), []);
    const system = botSystemPrompt(activeBot, mems, thinkMode);

    /* --- Imagine mode --- */
    if (isImagine) {
      const userMsg: ChatMessage = { id: uid(), role: "user", content: cleanText, createdAt: Date.now() };
      const placeholder: ChatMessage = { id: uid(), role: "assistant", content: "", imagePrompt: cleanText, createdAt: Date.now() };
      const base = opts?.regenerate
        ? messages.filter((m) => m.id !== messages[messages.length - 1]?.id)
        : [...messages, userMsg];
      const withPlaceholder = [...base, placeholder];
      persistMessages(chatId, withPlaceholder);
      setImageLoading(true);
      try {
        const url = imagineUrl(cleanText);
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image generation failed"));
          img.src = url;
          window.setTimeout(() => reject(new Error("Image took too long")), 120_000);
        });
        persistMessages(chatId, withPlaceholder.map((m) => (m.id === placeholder.id ? { ...m, imageUrl: url } : m)));
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

    /* --- Chat mode --- */
    const history: ChatMsg[] = [
      { role: "system", content: system },
      ...messages
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content && !m.imageUrl)
        .slice(-20)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    let next: ChatMessage[];
    if (opts?.regenerate) {
      const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf("assistant");
      next = lastAssistantIdx >= 0 ? messages.slice(0, lastAssistantIdx) : messages;
    } else {
      next = [...messages, { id: uid(), role: "user", content: text, createdAt: Date.now() }];
    }
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", reasoning: "", createdAt: Date.now() };
    persistMessages(chatId, [...next, assistantMsg]);

    try {
      await streamChat([...history, { role: "user", content: text }], {
        signal: controller.signal,
        onReasoning: (reasoning) => {
          setMessages((cur) => {
            if (!cur.some((m) => m.id === assistantMsg.id)) return cur;
            const updated = cur.map((m) => (m.id === assistantMsg.id ? { ...m, reasoning } : m));
            writeJSON(MSGS_KEY(chatId), updated.slice(-100));
            return updated;
          });
        },
        onContent: (content) => {
          setMessages((cur) => {
            if (!cur.some((m) => m.id === assistantMsg.id)) return cur;
            const updated = cur.map((m) => (m.id === assistantMsg.id ? { ...m, content } : m));
            writeJSON(MSGS_KEY(chatId), updated.slice(-100));
            return updated;
          });
        },
      });
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        const msg = error instanceof Error ? error.message : "AskAI hiccuped.";
        setMessages((cur) => {
          const updated = cur.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: m.content || `Hmm, that didn't work — ${msg}` } : m
          );
          writeJSON(MSGS_KEY(chatId), updated.slice(-100));
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [input, streaming, activeBot, imagineMode, thinkMode, messages, ensureChat, persistMessages, maybeCaptureMemory, botSystemPrompt]);

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

  /* ------------------------- voice ------------------------- */

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
    if (!Rec) { toast.error("Voice input isn't supported in this browser."); return; }
    try {
      const recog = new Rec()!;
      recog.lang = "en-US";
      recog.interimResults = true;
      recog.onresult = (e) => {
        setInput(Array.from(e.results).map((r) => r[0]?.transcript || "").join(""));
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
  const botRoutines = useMemo(() => routines.filter((r) => r.botId === activeBotId), [routines, activeBotId]);
  const showEmpty = messages.length === 0 && !streaming;

  /* ------------------------- render ------------------------- */

  return (
    <main className="askg-shell">
      {/* Sidebar: teammates + chats */}
      <aside className={cn("askg-sidebar", sidebarOpen && "is-open")}>
        <div className="askg-side-head">
          <Link href="/home" className="askg-back" aria-label="Back to Flux home">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="askg-brand">
            <span className="askg-orb askg-orb-sm" aria-hidden />
            <strong>AskAI</strong>
          </div>
          <button type="button" className="askg-icon-btn askg-only-mobile" onClick={() => setSidebarOpen(false)} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="askg-team-head">
          <span>Teammates</span>
          <button type="button" className="askg-hire" onClick={() => setShowCreator(true)}>
            <Plus className="h-3.5 w-3.5" /> Hire
          </button>
        </div>
        <div className="askg-team-list">
          {bots.map((bot) => (
            <div key={bot.id} className={cn("askg-team-row", bot.id === activeBotId && "is-active")}>
              <button
                type="button"
                className="askg-team-btn"
                onClick={() => { setActiveBotId(bot.id); setSidebarOpen(false); }}
                style={{ ["--bot-color" as string]: bot.color }}
              >
                <span className="askg-team-emoji">{bot.emoji}</span>
                <span className="askg-team-name">{bot.name}</span>
              </button>
              {bots.length > 1 ? (
                <button type="button" className="askg-icon-btn askg-delete" onClick={() => deleteBot(bot.id)} aria-label={`Remove ${bot.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
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
      {sidebarOpen ? <button type="button" className="askg-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close" /> : null}

      {/* Main chat */}
      <section className="askg-main">
        <header className="askg-topbar">
          <button type="button" className="askg-icon-btn askg-only-mobile" onClick={() => setSidebarOpen(true)} aria-label="Open">
            <Menu className="h-5 w-5" />
          </button>
          {activeBot ? (
            <div className="askg-model-badge">
              <span className="askg-bot-emoji-lg" style={{ ["--bot-color" as string]: activeBot.color }}>{activeBot.emoji}</span>
              <div>
                <strong>{activeBot.name}</strong>
                <span>Your AI teammate · remembers you · runs routines</span>
              </div>
            </div>
          ) : null}
          <div className="askg-top-actions">
            <button
              type="button"
              className={cn("askg-icon-btn", panelTab === "memory" && "is-active-tab")}
              onClick={() => setPanelTab((t) => (t === "memory" ? null : "memory"))}
              aria-label="Memory"
              title="What this teammate remembers"
            >
              <Brain className="h-5 w-5" />
            </button>
            <button
              type="button"
              className={cn("askg-icon-btn", panelTab === "routines" && "is-active-tab")}
              onClick={() => setPanelTab((t) => (t === "routines" ? null : "routines"))}
              aria-label="Routines"
              title="Routines — jobs this teammate runs on its own"
            >
              <Clock className="h-5 w-5" />
            </button>
            <button type="button" className="askg-icon-btn" onClick={newChat} aria-label="New chat">
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="askg-scroll">
          {showEmpty ? (
            <div className="askg-empty">
              <span className="askg-orb askg-orb-lg" aria-hidden />
              <h1>{activeBot ? `Ask ${activeBot.name} anything` : "Ask anything"}</h1>
              <p>Chat, think deeper, or imagine images — your teammate remembers what matters.</p>
              <div className="askg-suggestions">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    className="askg-suggestion"
                    style={{ animationDelay: `${i * 70}ms` }}
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
              <p className="askg-empty-hint">Tip: type <code>remember that …</code> and {activeBot?.name || "your teammate"} will never forget it.</p>
            </div>
          ) : (
            <div className="askg-messages">
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  botEmoji={activeBot?.emoji || "✨"}
                  isLast={i === messages.length - 1}
                  streaming={streaming}
                  copied={copiedId === m.id}
                  onCopy={() => copyMessage(m)}
                  onRegenerate={m.role === "assistant" ? regenerate : undefined}
                />
              ))}
              {imageLoading ? (
                <div className="askg-msg is-assistant">
                  <span className="askg-assistant-mark" aria-hidden>{activeBot?.emoji || "✨"}</span>
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
              placeholder={imagineMode ? "Describe the image to imagine…" : `Message ${activeBot?.name || "AskAI"}…`}
              rows={1}
              aria-label="Message"
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
                    <span className="askg-wave" aria-hidden><span /><span /><span /><span /></span>
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

      {/* Right panel: memory + routines */}
      {panelTab ? (
        <aside className="askg-panel">
          <header className="askg-panel-head">
            <div className="askg-panel-tabs">
              <button type="button" className={cn("askg-panel-tab", panelTab === "memory" && "is-active")} onClick={() => setPanelTab("memory")}>
                <Brain className="h-4 w-4" /> Memory
              </button>
              <button type="button" className={cn("askg-panel-tab", panelTab === "routines" && "is-active")} onClick={() => setPanelTab("routines")}>
                <Clock className="h-4 w-4" /> Routines
              </button>
            </div>
            <button type="button" className="askg-icon-btn" onClick={() => setPanelTab(null)} aria-label="Close panel">
              <X className="h-5 w-5" />
            </button>
          </header>

          {panelTab === "memory" ? (
            <div className="askg-panel-body">
              <p className="askg-panel-desc">
                What {activeBot?.name || "your teammate"} remembers about you. It uses this in every chat.
              </p>
              <form
                className="askg-add-row"
                onSubmit={(e) => { e.preventDefault(); if (memoryDraft.trim()) { addMemory(memoryDraft); setMemoryDraft(""); } }}
              >
                <input value={memoryDraft} onChange={(e) => setMemoryDraft(e.target.value)} placeholder="Remember that I…" maxLength={500} />
                <button type="submit" aria-label="Add memory"><Plus className="h-4 w-4" /></button>
              </form>
              <div className="askg-memory-list">
                {memories.map((m) => (
                  <div key={m.id} className="askg-memory-item">
                    <span>{m.text}</span>
                    <button type="button" onClick={() => deleteMemory(m.id)} aria-label="Forget" className="askg-icon-btn askg-delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {memories.length === 0 ? <p className="askg-history-empty">Nothing remembered yet. Tell {activeBot?.name || "your teammate"} <code>remember that …</code> in chat.</p> : null}
              </div>
            </div>
          ) : (
            <div className="askg-panel-body">
              <p className="askg-panel-desc">
                Routines are jobs {activeBot?.name || "your teammate"} runs on its own — on a schedule, even while you chat. Results land in this teammate&apos;s chats.
              </p>
              <button type="button" className="askg-new-chat" onClick={() => setShowRoutineCreator(true)}>
                <Plus className="h-5 w-5" />
                <span>New routine</span>
              </button>
              <div className="askg-routine-list">
                {botRoutines.map((r) => (
                  <div key={r.id} className={cn("askg-routine-item", !r.enabled && "is-off")}>
                    <button type="button" className="askg-routine-toggle" onClick={() => toggleRoutine(r.id)} aria-pressed={r.enabled} aria-label={r.enabled ? "Pause routine" : "Resume routine"}>
                      <span className={cn("askg-switch", r.enabled && "is-on")} />
                    </button>
                    <div className="askg-routine-info">
                      <strong>{r.name}</strong>
                      <span>{ROUTINE_INTERVALS.find((i) => i.minutes === r.intervalMinutes)?.label}{r.lastRun ? ` · last run ${new Date(r.lastRun).toLocaleString()}` : " · not run yet"}</span>
                      <p>{r.prompt}</p>
                    </div>
                    <button type="button" onClick={() => deleteRoutine(r.id)} aria-label="Delete routine" className="askg-icon-btn askg-delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {botRoutines.length === 0 ? <p className="askg-history-empty">No routines yet. Give your teammate a recurring job.</p> : null}
              </div>
            </div>
          )}
        </aside>
      ) : null}

      {/* Bot creator modal */}
      {showCreator ? (
        <div className="askg-modal-scrim" onClick={() => setShowCreator(false)}>
          <div className="askg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Hire a teammate">
            <h2>Hire a teammate</h2>
            <p className="askg-modal-sub">A persistent AI bot with its own chats, memory and routines.</p>
            <label className="askg-field">
              <span>Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Code Buddy" maxLength={24} autoFocus />
            </label>
            <div className="askg-field">
              <span>Emoji</span>
              <div className="askg-emoji-grid">
                {BOT_EMOJIS.map((e) => (
                  <button key={e} type="button" className={cn("askg-emoji-pick", newEmoji === e && "is-active")} onClick={() => setNewEmoji(e)}>{e}</button>
                ))}
              </div>
            </div>
            <div className="askg-field">
              <span>Color</span>
              <div className="askg-color-grid">
                {BOT_COLORS.map((c) => (
                  <button key={c} type="button" className={cn("askg-color-pick", newColor === c && "is-active")} style={{ background: c }} onClick={() => setNewColor(c)} aria-label={c} />
                ))}
              </div>
            </div>
            <label className="askg-field">
              <span>Personality <em>(optional)</em></span>
              <textarea value={newPersonality} onChange={(e) => setNewPersonality(e.target.value)} placeholder="e.g. A senior game dev who reviews my Roblox code harshly but fairly." rows={3} maxLength={2000} />
            </label>
            <div className="askg-modal-actions">
              <button type="button" className="askg-btn-ghost" onClick={() => setShowCreator(false)}>Cancel</button>
              <button type="button" className="askg-btn-primary" onClick={createBot}>Hire {newEmoji || "🤖"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Routine creator modal */}
      {showRoutineCreator ? (
        <div className="askg-modal-scrim" onClick={() => setShowRoutineCreator(false)}>
          <div className="askg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="New routine">
            <h2>New routine</h2>
            <p className="askg-modal-sub">A job {activeBot?.name || "your teammate"} runs on its own, on schedule.</p>
            <label className="askg-field">
              <span>Name</span>
              <input value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="e.g. Morning briefing" maxLength={40} autoFocus />
            </label>
            <label className="askg-field">
              <span>What should it do?</span>
              <textarea value={routinePrompt} onChange={(e) => setRoutinePrompt(e.target.value)} placeholder="e.g. Summarize today's top gaming news in 5 bullets." rows={3} maxLength={2000} />
            </label>
            <div className="askg-field">
              <span>How often?</span>
              <div className="askg-interval-grid">
                {ROUTINE_INTERVALS.map((i) => (
                  <button key={i.minutes} type="button" className={cn("askg-interval-pick", routineMinutes === i.minutes && "is-active")} onClick={() => setRoutineMinutes(i.minutes)}>
                    {i.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="askg-modal-actions">
              <button type="button" className="askg-btn-ghost" onClick={() => setShowRoutineCreator(false)}>Cancel</button>
              <button type="button" className="askg-btn-primary" onClick={createRoutine}>Set routine</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
