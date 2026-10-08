"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { groupPath } from "@/lib/routes";
import {
  addMessage,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation,
  type AIConversation,
} from "@/services/ai-chat";
import { cn } from "@/lib/utils";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
  generatedImageUrl?: string | null;
  groupCard?: { groupId: string; name: string; avatarUrl?: string | null } | null;
  toolNote?: string | null;
  pending?: boolean;
}

interface SseEvent {
  type: string;
  status?: string;
  label?: string;
  content?: string;
  url?: string;
  error?: string;
  tool?: string;
  preview?: string;
  groupId?: string;
  name?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  generatedImageUrl?: string | null;
}

const SUGGESTIONS = [
  "What's happening on Flux today?",
  "Help me write a viral post about gaming",
  "Create a group for retro gamers",
  "Generate a logo for my community",
];

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AskAIPage() {
  const { user } = useAuth();
  const authedUid = user?.uid ?? null;
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ dataUrl: string; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => {
      const el = msgsRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  useEffect(scrollDown, [messages, statusLabel, scrollDown]);

  const refreshConversations = useCallback(async () => {
    if (!authedUid) return;
    try {
      setConversations(await listConversations(authedUid));
    } catch {
      /* ignore */
    }
  }, [authedUid]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  const openConversation = useCallback(
    async (id: string | null) => {
      setActiveId(id);
      setError(null);
      if (!id) {
        setMessages([]);
        return;
      }
      try {
        const stored = await getMessages(id);
        setMessages(
          stored.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            imageUrl: m.imageUrl,
            generatedImageUrl: m.generatedImageUrl,
            groupCard: (m.meta?.groupCard as ChatMsg["groupCard"]) ?? null,
            toolNote: (m.meta?.toolNote as string) ?? null,
          }))
        );
      } catch {
        setMessages([]);
      }
    },
    []
  );

  const startNew = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setImagePreview(null);
  }, []);

  const removeConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id);
      } catch {
        /* ignore */
      }
      setConversations((cs) => cs.filter((c) => c.id !== id));
      if (activeIdRef.current === id) startNew();
    },
    [startNew]
  );

  const pickImage = () => fileRef.current?.click();

  const onFile = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview({ dataUrl: String(reader.result), mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  const send = useCallback(
    async (text?: string) => {
      const message = (text ?? input).trim();
      if ((!message && !imagePreview) || busy) return;
      setError(null);
      setBusy(true);
      setStatusLabel("Thinking…");

      const img = imagePreview;
      setImagePreview(null);
      setInput("");

      // Ensure a conversation exists (persisted only when signed in)
      let convoId = activeIdRef.current;
      if (!convoId && authedUid) {
        try {
          convoId = await createConversation(
            authedUid,
            message.slice(0, 48) || "Image chat"
          );
          setActiveId(convoId);
          void refreshConversations();
        } catch {
          convoId = null;
        }
      }

      const userMsg: ChatMsg = {
        id: uid(),
        role: "user",
        content: message,
        imageUrl: img?.dataUrl ?? null,
      };
      setMessages((ms) => [...ms, userMsg]);
      if (convoId) {
        try {
          await addMessage(convoId, {
            role: "user",
            content: message,
            imageUrl: img?.dataUrl ?? null,
          });
        } catch {
          /* ignore */
        }
      }

      const history = [...messages, userMsg]
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const assistantId = uid();
      setMessages((ms) => [
        ...ms,
        { id: assistantId, role: "assistant", content: "", pending: true },
      ]);

      let acc = "";
      let toolNote: string | null = null;
      let groupCard: ChatMsg["groupCard"] = null;
      let generatedImageUrl: string | null = null;

      const patchAssistant = (patch: Partial<ChatMsg>) =>
        setMessages((ms) =>
          ms.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );

      try {
        const res = await fetch("/api/ask-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history,
            imageBase64: img?.dataUrl ?? undefined,
            imageMime: img?.mime ?? undefined,
            uid: authedUid ?? undefined,
          }),
        });
        if (!res.ok || !res.body) throw new Error("Flux AI is unreachable right now.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            let evt: SseEvent;
            try {
              evt = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (evt.type === "status") {
              setStatusLabel(evt.label ?? "Working…");
            } else if (evt.type === "status_clear") {
              setStatusLabel(null);
            } else if (evt.type === "token") {
              acc += evt.content ?? "";
              patchAssistant({ content: acc, pending: false });
            } else if (evt.type === "image") {
              generatedImageUrl = evt.url ?? null;
              patchAssistant({ generatedImageUrl });
            } else if (evt.type === "tool") {
              toolNote = evt.preview
                ? `${evt.tool === "web_search" ? "Web search" : evt.tool}: ${evt.preview.slice(0, 160)}…`
                : null;
              patchAssistant({ toolNote });
            } else if (evt.type === "group" && evt.groupId) {
              groupCard = {
                groupId: evt.groupId,
                name: evt.name ?? "New group",
                avatarUrl: evt.avatarUrl ?? null,
              };
              patchAssistant({ groupCard });
            } else if (evt.type === "error") {
              throw new Error(evt.error || "Flux AI failed.");
            } else if (evt.type === "done") {
              if (evt.generatedImageUrl) {
                generatedImageUrl = evt.generatedImageUrl;
                patchAssistant({ generatedImageUrl });
              }
            }
          }
          scrollDown();
        }
        setStatusLabel(null);
        patchAssistant({ pending: false, toolNote, groupCard, generatedImageUrl });

        const finalText = acc.trim();
        if (convoId && (finalText || generatedImageUrl)) {
          try {
            await addMessage(convoId, {
              role: "assistant",
              content: finalText || "(image)",
              generatedImageUrl,
              meta: {
                ...(toolNote ? { toolNote } : {}),
                ...(groupCard ? { groupCard } : {}),
              },
            });
            if (messages.length === 0) {
              try {
                await renameConversation(convoId, message.slice(0, 48) || "Chat");
              } catch {
                /* ignore */
              }
              void refreshConversations();
            }
          } catch {
            /* ignore */
          }
        }
        if (!finalText && !generatedImageUrl) {
          patchAssistant({ content: "I couldn't come up with a reply — try again." });
        }
      } catch (e) {
        setStatusLabel(null);
        const msg = e instanceof Error ? e.message : "Flux AI failed.";
        setError(msg);
        patchAssistant({ content: `⚠️ ${msg}`, pending: false });
      } finally {
        setBusy(false);
        scrollDown();
      }
    },
    [input, imagePreview, busy, messages, authedUid, refreshConversations, scrollDown]
  );

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="fai-shell">
      {/* Conversation history */}
      <aside className="fai-side" aria-label="Chat history">
        <div className="fai-side-head">
          <img src="/flux-logo.png" alt="Flux AI" />
          <div>
            <strong>Flux AI</strong>
            <span>by Ripo Team</span>
          </div>
        </div>
        <button type="button" className="fai-newchat" onClick={startNew}>
          <MessageSquarePlus className="h-4 w-4" /> New chat
        </button>
        <div className="fai-convos">
          {!authedUid ? (
            <p className="fai-hint" style={{ padding: "0 16px" }}>
              Sign in to save your conversations.
            </p>
          ) : conversations.length === 0 ? (
            <p className="fai-hint" style={{ padding: "0 16px" }}>
              No chats yet — start one below.
            </p>
          ) : (
            conversations.map((c) => (
              <div key={c.id} style={{ position: "relative" }}>
                <button
                  type="button"
                  className={cn("fai-convo", c.id === activeId && "is-active")}
                  onClick={() => void openConversation(c.id)}
                >
                  <span>{c.title}</span>
                </button>
                <button
                  type="button"
                  className="fai-convo-del"
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}
                  aria-label="Delete conversation"
                  onClick={() => void removeConversation(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="fai-model-badge">
          <img src="/flux-logo.png" alt="" />
          <div>
            <strong>Flux AI</strong>
            <span>Ripo Team model · live Flux context</span>
          </div>
        </div>
      </aside>

      {/* Chat */}
      <div className="fai-main">
        <div className="fai-topbar">
          <img src="/flux-logo.png" alt="Flux AI" />
          <strong>Flux AI</strong>
          <span className="fai-live-pill">
            <Sparkles className="mr-1 inline h-3 w-3" /> Online
          </span>
        </div>

        <div className="fai-msgs" ref={msgsRef}>
          {messages.length === 0 ? (
            <div className="fai-empty">
              <img src="/flux-logo.png" alt="Flux AI" />
              <h1>Ask Flux AI anything</h1>
              <p>
                Your built-in assistant — it knows what&apos;s happening on Flux,
                can search the web, generate images, and even set up groups for you.
              </p>
              <div className="fai-suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("fai-msg", m.role)}>
                <div className="fai-ava">
                  {m.role === "assistant" ? (
                    <img src="/flux-logo.png" alt="Flux AI" />
                  ) : (
                    <span style={{ fontWeight: 800, color: "#1d9bf0" }}>You</span>
                  )}
                </div>
                <div className="fai-bubble">
                  {m.imageUrl ? (
                    <img src={m.imageUrl} alt="Uploaded" className="fai-upimg" />
                  ) : null}
                  {m.pending && !m.content ? (
                    <span className="fai-status">
                      <span className="fai-spin" /> {statusLabel ?? "Thinking…"}
                    </span>
                  ) : (
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  )}
                  {m.generatedImageUrl && !m.content.includes(m.generatedImageUrl) ? (
                    <img src={m.generatedImageUrl} alt="Generated by Flux AI" />
                  ) : null}
                  {m.toolNote ? <div className="fai-tool">{m.toolNote}</div> : null}
                  {m.groupCard ? (
                    <a
                      className="fai-group-card"
                      href={groupPath(m.groupCard.groupId)}
                    >
                      {m.groupCard.avatarUrl ? (
                        <img src={m.groupCard.avatarUrl} alt="" />
                      ) : null}
                      <div>
                        <strong>{m.groupCard.name}</strong>
                        <span>Group created — tap to open →</span>
                      </div>
                    </a>
                  ) : null}
                  {m.pending && m.content && statusLabel ? (
                    <div className="fai-status">
                      <span className="fai-spin" /> {statusLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {error ? <p className="fai-error" style={{ textAlign: "center" }}>{error}</p> : null}
        </div>

        <div className="fai-composer">
          <div className="fai-composer-inner">
            {imagePreview ? (
              <div className="fai-preview">
                <img src={imagePreview.dataUrl} alt="Upload preview" />
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => setImagePreview(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <div className="fai-inputrow">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="fai-iconbtn"
                aria-label="Upload image"
                title="Upload image"
                onClick={pickImage}
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <textarea
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Message Flux AI…"
                aria-label="Message Flux AI"
              />
              <button
                type="button"
                className="fai-sendbtn"
                aria-label="Send"
                disabled={busy || (!input.trim() && !imagePreview)}
                onClick={() => void send()}
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
            <p className="fai-hint">
              Flux AI can make mistakes — double-check important info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
