"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ImagePlus,
  Loader2,
  Menu,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Globe,
  Search,
  Wand2,
  Users,
  X,
  Copy,
  Check,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { groupPath } from "@/lib/routes";
import { toast } from "sonner";
import { ImageViewer } from "@/components/shared/image-viewer";
import { ASKAI_BYLINE, ASKAI_NAME, APP_TEAM } from "@/lib/constants";
import { UserAvatar } from "@/components/shared/user-avatar";
import { stripThinkingText } from "@/lib/ai/strip-thinking";

type Status = { status: string; label: string };

export default function AskAIPage() {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [mobileHistory, setMobileHistory] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const list = await listConversations(user.uid);
    setConversations(list);
  }, [user]);

  useEffect(() => {
    refreshConversations().catch(() => undefined);
  }, [refreshConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    getMessages(activeId)
      .then((msgs) =>
        setMessages(
          msgs.map((m) =>
            m.role === "assistant"
              ? { ...m, content: stripThinkingText(m.content) }
              : m
          )
        )
      )
      .catch(() => setMessages([]));
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, status]);

  const newChat = async () => {
    if (!user) return;
    try {
      const id = await createConversation(user.uid, "New chat");
      setActiveId(id);
      setMessages([]);
      setStreaming("");
      setStatus(null);
      setFollowUps([]);
      await refreshConversations();
      setMobileHistory(false);
      inputRef.current?.focus();
    } catch {
      toast.error("Could not create chat");
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setStatus(null);
  };

  const startVoice = () => {
    type Rec = {
      lang: string;
      interimResults: boolean;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      start: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => Rec;
      webkitSpeechRecognition?: new () => Rec;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("Voice input failed");
    };
    rec.onresult = (ev) => {
      const said = ev.results?.[0]?.[0]?.transcript || "";
      if (said) setInput((t) => (t ? `${t} ${said}` : said));
    };
    rec.start();
  };

  const buildFollowUps = (answer: string, question: string) => {
    const base = [
      "Explain that simpler",
      "Give me an example",
      "What should I do next on Flux?",
    ];
    if (/group/i.test(answer) || /group/i.test(question)) {
      base.unshift("Help me write group rules");
    }
    if (/image|logo|banner/i.test(question)) {
      base.unshift("Generate another variation");
    }
    if (/post|trend|feed/i.test(question) || /post|trend/i.test(answer)) {
      base.unshift("Draft a post about this");
    }
    setFollowUps([...new Set(base)].slice(0, 4));
  };

  const send = async (overrideText?: string) => {
    if (!user || loading) return;
    const text = (overrideText ?? input).trim();
    if (!text && !imageData) return;

    let convId = activeId;
    if (!convId) {
      convId = await createConversation(
        user.uid,
        text.slice(0, 48) || "Image chat"
      );
      setActiveId(convId);
    }

    const userMsg: AIMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      imageUrl: imageData,
      createdAt: null,
    };
    setMessages((m) => [...m, userMsg]);
    if (!overrideText) setInput("");
    const attached = imageData;
    setImageData(null);
    setLoading(true);
    setStreaming("");
    setFollowUps([]);
    setStatus({ status: "thinking", label: "Thinking…" });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      await addMessage(convId, {
        role: "user",
        content: text || "(image)",
        imageUrl: attached,
      });

      if (messages.length === 0 && text) {
        renameConversation(convId, text.slice(0, 48)).catch(() => undefined);
      }

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          message: text,
          history,
          imageBase64: attached,
          uid: user.uid,
        }),
      });

      if (!res.ok || !res.body) throw new Error("AskAI request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let genImage: string | null = null;
      let groupId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.type === "status") {
              setStatus({ status: data.status, label: data.label });
            } else if (data.type === "status_clear") {
              setStatus(null);
            } else if (data.type === "token") {
              setStatus(null);
              full += data.content;
              // Live strip think tags while streaming
              setStreaming(stripThinkingText(full));
            } else if (data.type === "image") {
              genImage = data.url;
            } else if (data.type === "group") {
              groupId = data.groupId;
              toast.success(`Group “${data.name}” created`);
            } else if (data.type === "error") {
              throw new Error(data.error || "Error");
            } else if (data.type === "done") {
              genImage = data.generatedImageUrl || genImage;
              groupId = data.groupId || groupId;
              setStatus(null);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            if (e instanceof Error && e.message !== "Error") {
              if (
                e.message.includes("unavailable") ||
                e.message.includes("required") ||
                e.message.includes("failed") ||
                e.message.includes("configured")
              ) {
                throw e;
              }
            }
          }
        }
      }

      let content = stripThinkingText(full);
      if (genImage && !content.includes(genImage)) {
        content += `\n\n![generated](${genImage})`;
      }
      if (groupId) content += `\n\nOpen your group: ${groupPath(groupId)}`;
      if (!content) content = "I couldn't generate a reply. Try again.";

      await addMessage(convId, {
        role: "assistant",
        content,
        generatedImageUrl: genImage,
        meta: groupId ? { groupId } : undefined,
      });

      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content,
          generatedImageUrl: genImage,
          createdAt: null,
        },
      ]);
      setStreaming("");
      buildFollowUps(content, text);
      await refreshConversations();
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        const partial = stripThinkingText(streaming);
        if (partial) {
          setMessages((m) => [
            ...m,
            {
              id: `stop-${Date.now()}`,
              role: "assistant",
              content: partial + "\n\n_(stopped)_",
              createdAt: null,
            },
          ]);
        }
      } else {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "AskAI failed");
        setMessages((m) => [
          ...m,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "Something went wrong. Please try again in a moment.",
            createdAt: null,
          },
        ]);
      }
    } finally {
      setLoading(false);
      setStatus(null);
      setStreaming("");
      abortRef.current = null;
    }
  };

  const regenerate = () => {
    // Find last user message and resend
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // drop last assistant if present
    setMessages((m) => {
      const copy = [...m];
      if (copy[copy.length - 1]?.role === "assistant") copy.pop();
      if (copy[copy.length - 1]?.role === "user") copy.pop();
      return copy;
    });
    setTimeout(() => send(lastUser.content), 50);
  };

  const onPickImage = (file: File | null) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
  };

  const empty = messages.length === 0 && !streaming && !loading;

  return (
    <div className="flex h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))] min-h-0 w-full bg-background lg:h-[100dvh]">
      {/* Desktop history */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-background transition-all duration-200 md:flex",
          historyOpen ? "w-[280px]" : "w-0 overflow-hidden border-0"
        )}
      >
        <div className="flex items-center gap-2 p-3">
          <Button className="flex-1" variant="outline" onClick={newChat}>
            <Plus className="h-4 w-4" /> New chat
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setHistoryOpen(false)}
            title="Hide sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-xl px-2.5 py-2.5 text-sm",
                activeId === c.id
                  ? "bg-muted font-semibold"
                  : "hover:bg-muted/60"
              )}
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => setActiveId(c.id)}
              >
                {c.title}
              </button>
              <button
                type="button"
                className="rounded p-1 opacity-0 hover:bg-background group-hover:opacity-100"
                onClick={async () => {
                  await deleteConversation(c.id);
                  if (activeId === c.id) {
                    setActiveId(null);
                    setMessages([]);
                  }
                  refreshConversations();
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {ASKAI_BYLINE}
        </p>
      </aside>

      {/* Main chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:px-4">
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileHistory(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {!historyOpen ? (
            <Button
              size="icon"
              variant="ghost"
              className="hidden md:inline-flex"
              onClick={() => setHistoryOpen(true)}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-extrabold leading-tight">
                {ASKAI_NAME}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                by {APP_TEAM}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={newChat}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
            {empty ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground text-background shadow-soft"
                >
                  <Sparkles className="h-8 w-8" />
                </motion.div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  How can I help?
                </h1>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {ASKAI_BYLINE}. I can read Flux posts & profiles, search the
                  web, analyze images, generate pictures, and create one group
                  for you.
                </p>
                <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {[
                    "What's trending on Flux?",
                    "Search the web for AI news",
                    "Generate a minimal logo for my brand",
                    "Create a private group for builders",
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setInput(s);
                        inputRef.current?.focus();
                      }}
                      className="rounded-2xl border border-border px-4 py-3 text-left text-sm font-medium transition hover:bg-muted active:scale-[0.99]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((m) => (
              <ChatRow
                key={m.id}
                message={m}
                profile={profile}
                onImageClick={setViewer}
              />
            ))}

            {/* Status only before first token */}
            <AnimatePresence>
              {status && !streaming ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    <StatusIcon status={status.status} />
                    <span className="animate-pulse">{status.label}</span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {streaming ? (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-7 sm:text-base">
                  <Markdown
                    content={stripThinkingText(streaming)}
                    onImageClick={setViewer}
                  />
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground align-middle" />
                </div>
              </div>
            ) : null}

            {!loading && followUps.length > 0 ? (
              <div className="flex flex-wrap gap-2 pl-11">
                {followUps.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => send(f)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    {f}
                  </button>
                ))}
              </div>
            ) : null}

            {!loading &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "assistant" ? (
              <div className="flex gap-2 pl-11">
                <Button size="sm" variant="outline" onClick={regenerate}>
                  Regenerate
                </Button>
              </div>
            ) : null}

            <div ref={bottomRef} className="h-2" />
          </div>
        </div>

        {/* Composer — ChatGPT style bottom dock */}
        <div className="shrink-0 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-4 sm:py-4">
          <div className="mx-auto w-full max-w-3xl">
            {imageData ? (
              <div className="relative mb-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageData}
                  alt=""
                  className="h-20 rounded-xl border border-border object-cover"
                />
                <button
                  type="button"
                  className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"
                  onClick={() => setImageData(null)}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-1 rounded-[28px] border border-border bg-muted/40 p-2 shadow-soft focus-within:border-[#1d9bf0]/50 sm:gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 shrink-0 rounded-full"
                onClick={() => fileRef.current?.click()}
                title="Attach image"
              >
                <ImagePlus className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-10 w-10 shrink-0 rounded-full",
                  listening && "text-[#1d9bf0]"
                )}
                onClick={startVoice}
                title="Voice input"
              >
                <MicIcon listening={listening} />
              </Button>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message AskAI…"
                className="min-h-[44px] max-h-40 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 text-[15px] shadow-none focus-visible:ring-0"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              {loading ? (
                <Button
                  size="icon"
                  variant="outline"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={stop}
                  title="Stop"
                >
                  <SquareIcon />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="sky"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={() => send()}
                  disabled={!input.trim() && !imageData}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {ASKAI_BYLINE} · Flux by {APP_TEAM}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile history drawer */}
      <AnimatePresence>
        {mobileHistory ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileHistory(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed bottom-0 left-0 top-0 z-50 flex w-[85vw] max-w-xs flex-col border-r border-border bg-background md:hidden"
            >
              <div className="flex items-center justify-between border-b border-border p-3">
                <p className="font-bold">Chats</p>
                <button type="button" onClick={() => setMobileHistory(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-3">
                <Button className="w-full" variant="outline" onClick={newChat}>
                  <Plus className="h-4 w-4" /> New chat
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-2">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="mb-0.5 w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setActiveId(c.id);
                      setMobileHistory(false);
                    }}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
              <p className="border-t border-border p-3 text-[11px] text-muted-foreground">
                {ASKAI_BYLINE}
              </p>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <ImageViewer
        open={!!viewer}
        src={viewer}
        onClose={() => setViewer(null)}
      />
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "searching")
    return <Search className="h-3.5 w-3.5 animate-pulse" />;
  if (status === "generating_image")
    return <Wand2 className="h-3.5 w-3.5 animate-spin" />;
  if (status === "creating_group") return <Users className="h-3.5 w-3.5" />;
  if (status === "loading_flux")
    return <Globe className="h-3.5 w-3.5 animate-pulse" />;
  return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
}

function MicIcon({ listening }: { listening: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5", listening && "animate-pulse")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SquareIcon() {
  return <span className="block h-3.5 w-3.5 rounded-sm bg-current" />;
}

function ChatRow({
  message,
  profile,
  onImageClick,
}: {
  message: AIMessage;
  profile: ReturnType<typeof useAuth>["profile"];
  onImageClick: (src: string) => void;
}) {
  const mine = message.role === "user";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-start gap-3">
      {mine ? (
        <UserAvatar user={profile} size="sm" clickable={false} />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-bold text-muted-foreground">
          {mine ? "You" : ASKAI_NAME}
        </p>
        {message.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.imageUrl}
            alt=""
            className="mb-2 max-h-56 cursor-zoom-in rounded-2xl border border-border object-cover"
            onClick={() => onImageClick(message.imageUrl!)}
          />
        ) : null}
        <div className="text-[15px] leading-7 sm:text-base">
          {mine ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Markdown content={message.content} onImageClick={onImageClick} />
          )}
        </div>
        {!mine ? (
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Markdown({
  content,
  onImageClick,
}: {
  content: string;
  onImageClick: (src: string) => void;
}) {
  return (
    <div className="max-w-none space-y-3 [&_a]:text-[#1d9bf0] [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        components={{
          img: ({ src, alt }) => {
            const url = typeof src === "string" ? src : "";
            if (!url) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={alt || ""}
                className="my-2 max-h-80 cursor-zoom-in rounded-2xl border border-border object-cover"
                onClick={() => onImageClick(url)}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
