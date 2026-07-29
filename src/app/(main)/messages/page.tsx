"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Mail, Send, Smile } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  getMyConversations,
  getOrCreateDm,
  sendMessage,
  subscribeMessages,
  setTyping,
  type ChatMessage,
  type Conversation,
} from "@/services/chats";
import { searchUsers } from "@/services/users";
import type { UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const deepLink = searchParams.get("c");
  const [conversations, setConversations] = useState<
    (Conversation & { otherUser?: UserProfile | null })[]
  >([]);
  const [activeId, setActiveId] = useState<string | null>(deepLink);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  useEffect(() => {
    if (!user) return;
    getMyConversations(user.uid)
      .then((list) => {
        setConversations(list);
        if (deepLink) setActiveId(deepLink);
      })
      .finally(() => setLoading(false));
  }, [user, deepLink]);

  useEffect(() => {
    if (!activeId) return;
    const unsub = subscribeMessages(activeId, setMessages);
    return () => unsub();
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!search.trim() || !user) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchUsers(search).then((u) =>
        setResults(u.filter((x) => x.uid !== user.uid).slice(0, 8))
      );
    }, 250);
    return () => clearTimeout(t);
  }, [search, user]);

  const startDm = async (target: UserProfile) => {
    if (!user) return;
    try {
      const id = await getOrCreateDm(user.uid, target.uid);
      setActiveId(id);
      setSearch("");
      setResults([]);
      const list = await getMyConversations(user.uid);
      setConversations(list);
    } catch {
      toast.error("Could not start chat");
    }
  };

  const onSend = async () => {
    if (!user || !activeId || !text.trim()) return;
    setSending(true);
    try {
      await sendMessage(activeId, user.uid, text);
      setText("");
      await setTyping(activeId, user.uid, false);
    } catch {
      toast.error("Message failed — check Firestore rules");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh_-_3.5rem_-_env(safe-area-inset-top))] min-h-0 flex-col lg:h-screen">
      <header className="shrink-0 border-b border-border px-4 py-3 glass">
        <h1 className="text-lg font-bold">Messages</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Conversation list */}
        <div
          className={cn(
            "w-full shrink-0 border-r border-border sm:w-80",
            activeId && "hidden sm:block"
          )}
        >
          <div className="border-b border-border p-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people to message…"
              className="rounded-full"
            />
            {results.length > 0 ? (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-card">
                {results.map((u) => (
                  <li key={u.uid}>
                    <button
                      type="button"
                      onClick={() => startDm(u)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                    >
                      <UserAvatar user={u} size="sm" />
                      <span className="text-sm font-medium">
                        {u.displayName}{" "}
                        <span className="text-muted-foreground">@{u.username}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No conversations yet"
              description="Search for someone above to start a chat."
            />
          ) : (
            <ul className="overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition hover:bg-muted/40",
                      activeId === c.id && "bg-accent/50"
                    )}
                  >
                    <UserAvatar user={c.otherUser} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {c.otherUser?.displayName || "Chat"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessage || "Say hello"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Chat pane */}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col",
            !activeId && "hidden sm:flex"
          )}
        >
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                <button
                  type="button"
                  className="text-sm text-primary sm:hidden"
                  onClick={() => setActiveId(null)}
                >
                  Back
                </button>
                <UserAvatar user={active?.otherUser} size="sm" />
                <div>
                  <p className="font-semibold">
                    {active?.otherUser?.displayName || "Chat"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @{active?.otherUser?.username}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m) => {
                  const mine = m.senderId === user?.uid;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex", mine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-soft",
                          mine
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-muted"
                        )}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-border p-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full p-2 text-primary hover:bg-accent"
                    onClick={() => setText((t) => t + " 👋")}
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <Input
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (user && activeId) {
                        setTyping(activeId, user.uid, e.target.value.length > 0);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onSend();
                      }
                    }}
                    placeholder="Write a message…"
                    className="rounded-full"
                  />
                  <Button
                    size="icon"
                    onClick={onSend}
                    disabled={sending || !text.trim()}
                    className="shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
