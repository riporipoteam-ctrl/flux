"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft,
  File,
  FileImage,
  Film,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Search,
  Send,
  Users,
  Video,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  canCallUser,
  createGroupConversation,
  getMyConversations,
  getOrCreateDm,
  markRead,
  sendMessage,
  subscribeMessages,
  setTyping,
  type ChatMessage,
  type Conversation,
} from "@/services/chats";
import { uploadChatMedia } from "@/services/media";
import { searchUsers } from "@/services/users";
import type { UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { GifPicker, type GifResult } from "@/components/posts/gif-picker";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/asset-url";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* ------------------------------------------------------------------ */
/* Timestamp helpers                                                   */
/* ------------------------------------------------------------------ */

type TsLike = { toMillis?: () => number; toDate?: () => Date } | number | null | undefined;

function toMs(ts: TsLike): number {
  if (ts == null) return 0;
  if (typeof ts === "number") return ts;
  try {
    if (typeof ts.toMillis === "function") return ts.toMillis() ?? 0;
    if (typeof ts.toDate === "function") return ts.toDate()?.getTime() ?? 0;
  } catch {
    return 0;
  }
  return 0;
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function formatClock(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Compact timestamp for the conversation list: "2:14 PM", "Yesterday", "Tue", "9/24/26". */
function formatListTime(ms: number): string {
  if (!ms) return "";
  const now = Date.now();
  if (sameDay(ms, now)) return formatClock(ms);
  if (sameDay(ms, now - 86400000)) return "Yesterday";
  if (now - ms < 7 * 86400000) return new Date(ms).toLocaleDateString([], { weekday: "short" });
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString([], {
    month: "numeric",
    day: "numeric",
    ...(sameYear ? {} : { year: "2-digit" }),
  });
}

/** Day divider label: "Today", "Yesterday", "Monday", "Monday, September 22". */
function formatDayLabel(ms: number): string {
  if (!ms) return "";
  const now = Date.now();
  if (sameDay(ms, now)) return "Today";
  if (sameDay(ms, now - 86400000)) return "Yesterday";
  if (now - ms < 7 * 86400000) return new Date(ms).toLocaleDateString([], { weekday: "long" });
  return new Date(ms).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <MessagesInner />
    </Suspense>
  );
}

type ConversationWithUser = Conversation & { otherUser?: UserProfile | null };

function MessagesInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLink = searchParams.get("c");
  const sharedPostId = searchParams.get("post");
  const sharedStoryId = searchParams.get("story");
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [activeId, setActiveId] = useState<string | null>(deepLink);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupResults, setGroupResults] = useState<UserProfile[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserProfile[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId) || null, [conversations, activeId]);
  const activeName = active?.type === "group" ? active.name || "Group chat" : active?.otherUser?.displayName || "Chat";

  const reloadConversations = async () => {
    if (!user) return;
    const list = await getMyConversations(user.uid);
    setConversations(list);
  };

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
    return subscribeMessages(activeId, setMessages);
  }, [activeId]);

  /* Typing indicator: watch the conversation's typing subcollection. */
  useEffect(() => {
    if (!activeId || !user) {
      setTypingUids([]);
      return;
    }
    const ref = collection(db, "conversations", activeId, "typing");
    return onSnapshot(ref, (snap) => {
      const now = Date.now();
      const uids: string[] = [];
      for (const item of snap.docs) {
        if (item.id === user.uid) continue;
        const at = toMs(item.data()?.at);
        if (at === 0 || now - at < 15000) uids.push(item.id);
      }
      setTypingUids(uids);
    });
  }, [activeId, user]);

  /* Mark incoming messages as read while the chat is open (drives "Seen"). */
  useEffect(() => {
    if (!user || !activeId || messages.length === 0) return;
    for (const message of messages) {
      if (message.senderId !== user.uid && !(message.readBy || []).includes(user.uid)) {
        void markRead(activeId, message.id, user.uid);
      }
    }
  }, [user, activeId, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUids]);

  useEffect(() => {
    if (!search.trim() || !user) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchUsers(search).then((profiles) => setResults(profiles.filter((profile) => profile.uid !== user.uid).slice(0, 8)));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [search, user]);

  useEffect(() => {
    if (!groupSearch.trim() || !user) {
      setGroupResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchUsers(groupSearch).then((profiles) => setGroupResults(profiles.filter((profile) => profile.uid !== user.uid).slice(0, 10)));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [groupSearch, user]);

  const startDm = async (target: UserProfile) => {
    if (!user) return;
    try {
      const id = await getOrCreateDm(user.uid, target.uid);
      setActiveId(id);
      setSearch("");
      setResults([]);
      await reloadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start chat");
    }
  };

  const onSend = async () => {
    if (!user || !activeId || sending) return;
    const trimmed = text.trim();
    if (!trimmed && !sharedPostId && !sharedStoryId) return;
    setSending(true);
    try {
      await sendMessage(activeId, user.uid, {
        text: trimmed,
        sharedPostId,
        sharedStoryId,
      });
      setText("");
      await setTyping(activeId, user.uid, false);
      if (sharedPostId || sharedStoryId) router.replace(`/messages?c=${activeId}`);
      await reloadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message failed");
    } finally {
      setSending(false);
    }
  };

  const onFile = async (file: File | null) => {
    if (!file || !user || !activeId || uploading) return;
    setUploading(true);
    try {
      const mediaUrl = await uploadChatMedia(user.uid, activeId, file);
      const mediaType = file.type.startsWith("image/")
        ? file.type === "image/gif" ? "gif" : "image"
        : file.type.startsWith("video/") ? "video" : "file";
      await sendMessage(activeId, user.uid, {
        text,
        mediaUrl,
        mediaType,
        fileName: file.name,
        fileSize: file.size,
      });
      setText("");
      await reloadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onGif = async (gif: GifResult) => {
    if (!user || !activeId) return;
    try {
      await sendMessage(activeId, user.uid, {
        mediaUrl: gif.url,
        mediaType: "gif",
        fileName: "GIF",
      });
      await reloadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GIF failed to send");
    }
  };

  const createGroup = async () => {
    if (!user) return;
    try {
      const id = await createGroupConversation({
        ownerId: user.uid,
        memberIds: selectedMembers.map((profile) => profile.uid),
        name: groupName,
      });
      setGroupOpen(false);
      setGroupName("");
      setGroupSearch("");
      setSelectedMembers([]);
      setActiveId(id);
      await reloadConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create group chat");
    }
  };

  const startCall = async (mode: "voice" | "video") => {
    if (!user || !active || active.type !== "dm" || !active.otherUser) return;
    if (!(await canCallUser(user.uid, active.otherUser.uid))) {
      toast.error("Calls are only available between mutual friends. Business accounts cannot call.");
      return;
    }
    router.push(`/messages/call?c=${active.id}&mode=${mode}`);
  };

  /* Group consecutive messages from the same sender (within 5 minutes) so
     bubbles stack like a real chat app instead of one bubble per row. */
  const groups = useMemo(() => {
    const out: { senderId: string; items: ChatMessage[] }[] = [];
    for (const message of messages) {
      const last = out[out.length - 1];
      const ms = toMs(message.createdAt);
      const lastMs = last ? toMs(last.items[last.items.length - 1].createdAt) : 0;
      if (last && last.senderId === message.senderId && ms - lastMs < 5 * 60 * 1000 && sameDay(ms, lastMs)) {
        last.items.push(message);
      } else {
        out.push({ senderId: message.senderId, items: [message] });
      }
    }
    return out;
  }, [messages]);

  const renderItems = useMemo(() => {
    const items: Array<{ kind: "day"; ms: number } | { kind: "group"; group: { senderId: string; items: ChatMessage[] } }> = [];
    let lastDay = "";
    for (const group of groups) {
      const ms = toMs(group.items[0]?.createdAt);
      const day = ms ? new Date(ms).toDateString() : "";
      if (day && day !== lastDay) {
        items.push({ kind: "day", ms });
        lastDay = day;
      }
      items.push({ kind: "group", group });
    }
    return items;
  }, [groups]);

  /* Read receipt: for DMs, "Seen" shows when the other participant read our
     latest message. For groups, any other reader counts. */
  const lastOwnMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === user?.uid) return messages[i];
    }
    return null;
  }, [messages, user]);
  const seenByOther = useMemo(() => {
    if (!lastOwnMessage || !user) return false;
    const readers = (lastOwnMessage.readBy || []).filter((id) => id !== user.uid);
    return readers.length > 0;
  }, [lastOwnMessage, user]);
  const isLastOwnGroup = (group: { senderId: string; items: ChatMessage[] }) =>
    user != null && group.senderId === user.uid && lastOwnMessage != null && group.items[group.items.length - 1]?.id === lastOwnMessage.id;

  const typingNames = useMemo(() => {
    if (!typingUids.length) return "";
    const names = typingUids
      .map((id) => messages.find((m) => m.senderId === id)?.sender?.displayName || "Someone")
      .filter((name, index, list) => list.indexOf(name) === index);
    if (names.length === 1) return `${names[0]} is typing`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
    return "Several people are typing";
  }, [typingUids, messages]);

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_58px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] min-h-0 bg-background lg:h-[100dvh]">
      {/* ---------------- Conversation list ---------------- */}
      <section className={cn("w-full shrink-0 border-r border-border bg-background sm:w-[340px] lg:w-[380px]", activeId && "hidden sm:flex sm:flex-col")}>
        <header className="flex h-[60px] shrink-0 items-center gap-2 px-5">
          <h1 className="flex-1 text-[22px] font-extrabold tracking-tight">Messages</h1>
          <button
            type="button"
            onClick={() => setGroupOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-muted"
            aria-label="Create group chat"
          >
            <Users className="h-5 w-5" />
          </button>
        </header>

        <div className="shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              className="h-10 rounded-full border-0 bg-muted pl-10 text-[15px] shadow-none focus-visible:ring-1"
            />
          </div>
          {results.length ? (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
              {results.map((profile) => (
                <li key={profile.uid}>
                  <button type="button" onClick={() => void startDm(profile)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted">
                    <UserAvatar user={profile} size="sm" />
                    <span className="min-w-0">
                      <strong className="block truncate text-[15px]">{profile.displayName}</strong>
                      <span className="block truncate text-[13px] text-muted-foreground">@{profile.username}{profile.accountType === "business" ? " · Business" : ""}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          {loading ? (
            <ConversationSkeleton />
          ) : conversations.length === 0 ? (
            <div className="px-6 pt-10">
              <EmptyState icon={Mail} title="No conversations yet" description="Message a mutual friend, or contact a business account." />
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = activeId === conversation.id;
              const stamp = toMs(conversation.lastMessageAt) || toMs(conversation.updatedAt);
              const name = conversation.type === "group" ? conversation.name || "Group chat" : conversation.otherUser?.displayName || "Chat";
              const sub = conversation.type === "group"
                ? `${conversation.participantIds.length} people`
                : conversation.otherUser ? `@${conversation.otherUser.username}` : "";
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    isActive ? "bg-muted" : "hover:bg-muted/50"
                  )}
                >
                  {conversation.type === "group" ? (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Users className="h-5 w-5" />
                    </span>
                  ) : (
                    <UserAvatar user={conversation.otherUser} size="md" className="shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <strong className="min-w-0 flex-1 truncate text-[15px]">{name}</strong>
                      {stamp ? <span className="shrink-0 text-xs text-muted-foreground">{formatListTime(stamp)}</span> : null}
                    </span>
                    <span className="mt-0.5 flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {conversation.lastMessage || "Say hello"}
                      </span>
                      {sub && conversation.type === "group" ? <span className="shrink-0 text-xs text-muted-foreground">{sub}</span> : null}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* ---------------- Active chat ---------------- */}
      <section className={cn("flex min-w-0 flex-1 flex-col bg-background", !activeId && "hidden sm:flex")}>
        {!activeId ? (
          <div className="grid flex-1 place-items-center p-8">
            <div className="max-w-xs text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-muted">
                <Mail className="h-7 w-7 text-muted-foreground" />
              </span>
              <h2 className="mt-5 text-xl font-extrabold tracking-tight">Your messages</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pick a conversation to catch up, or start a new one with a friend.
              </p>
              <Button onClick={() => setGroupOpen(true)} className="mt-5 rounded-full px-6">
                Start a group chat
              </Button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border px-3 sm:px-4">
              <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted sm:hidden" onClick={() => setActiveId(null)} aria-label="Back to conversations">
                <ArrowLeft className="h-5 w-5" />
              </button>
              {active?.type === "group" ? (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <Users className="h-5 w-5" />
                </span>
              ) : (
                <UserAvatar user={active?.otherUser} size="md" className="shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold leading-5">{activeName}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {typingNames || (active?.type === "group" ? `${active.participantIds.length} people` : `@${active?.otherUser?.username || "user"}`)}
                </p>
              </div>
              {active?.type === "dm" ? (
                <div className="flex shrink-0 items-center">
                  <button type="button" onClick={() => void startCall("voice")} className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-muted" aria-label="Voice call">
                    <Phone className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => void startCall("video")} className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-muted" aria-label="Video call">
                    <Video className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </header>

            {(sharedPostId || sharedStoryId) ? (
              <div className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">Ready to share {sharedPostId ? "a post" : "a story"} in this chat</span>
                <button type="button" onClick={() => router.replace(`/messages?c=${activeId}`)} className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-muted" aria-label="Cancel share">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center pt-16 text-center">
                    {active?.type === "group" ? (
                      <span className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground"><Users className="h-7 w-7" /></span>
                    ) : (
                      <UserAvatar user={active?.otherUser} size="xl" />
                    )}
                    <h3 className="mt-4 text-lg font-extrabold tracking-tight">{activeName}</h3>
                    <p className="mt-1 max-w-[260px] text-sm text-muted-foreground">
                      {active?.type === "group" ? "This is the start of your group chat." : "This is the very beginning of your conversation."}
                    </p>
                  </div>
                ) : (
                  renderItems.map((item, index) => {
                    if (item.kind === "day") {
                      return (
                        <div key={`day-${item.ms}`} className="my-4 flex items-center gap-3">
                          <span className="h-px flex-1 bg-border" />
                          <span className="text-xs font-medium text-muted-foreground">{formatDayLabel(item.ms)}</span>
                          <span className="h-px flex-1 bg-border" />
                        </div>
                      );
                    }
                    const { group } = item;
                    const mine = group.senderId === user?.uid;
                    const showSeen = isLastOwnGroup(group);
                    return (
                      <MessageGroup
                        key={`g-${group.items[0]?.id ?? index}`}
                        group={group}
                        mine={mine}
                        isGroupChat={active?.type === "group"}
                        showSeen={showSeen}
                        seen={seenByOther}
                      />
                    );
                  })
                )}
                {typingUids.length > 0 ? (
                  <div className="mt-2 flex justify-start">
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3.5" aria-label={typingNames}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="shrink-0 border-t border-border bg-background px-3 pb-3 pt-2.5 sm:px-4 story-safe-bottom">
              <div className="mx-auto flex max-w-3xl items-end gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-primary transition-colors hover:bg-muted"
                  aria-label="Attach a file"
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setGifOpen(true)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[11px] font-black tracking-wide text-primary transition-colors hover:bg-muted"
                  aria-label="Choose a GIF"
                >
                  GIF
                </button>
                <div className="min-w-0 flex-1">
                  <Input
                    value={text}
                    onChange={(event) => {
                      setText(event.target.value);
                      if (user && activeId) void setTyping(activeId, user.uid, event.target.value.length > 0);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void onSend();
                      }
                    }}
                    placeholder="Write a message"
                    className="min-h-10 rounded-full border-0 bg-muted px-4 text-[15px] shadow-none focus-visible:ring-1"
                  />
                </div>
                <Button
                  size="icon"
                  onClick={() => void onSend()}
                  disabled={sending || (!text.trim() && !sharedPostId && !sharedStoryId)}
                  className="h-10 w-10 shrink-0 rounded-full"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.zip,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(event) => void onFile(event.target.files?.[0] || null)} />
              </div>
            </footer>
          </>
        )}
      </section>

      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onSelect={(gif) => void onGif(gif)} />

      {/* ---------------- New group dialog ---------------- */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0 sm:rounded-3xl">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle className="text-lg font-extrabold tracking-tight">New group chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-5">
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name (optional)"
              className="h-11 rounded-2xl border-0 bg-muted shadow-none"
            />
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="Search friends to add"
                className="h-11 rounded-2xl border-0 bg-muted pl-10 shadow-none"
              />
            </div>
            {selectedMembers.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((profile) => (
                  <button
                    key={profile.uid}
                    type="button"
                    onClick={() => setSelectedMembers((list) => list.filter((item) => item.uid !== profile.uid))}
                    className="flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-2.5 text-[13px] font-semibold transition-colors hover:bg-muted/70"
                  >
                    <UserAvatar user={profile} size="xs" />
                    <span className="max-w-[120px] truncate">{profile.displayName}</span>
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ) : null}
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-border">
              {groupResults.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Search for friends to add them to the group.</p>
              ) : (
                groupResults.map((profile) => {
                  const selected = selectedMembers.some((item) => item.uid === profile.uid);
                  return (
                    <button
                      key={profile.uid}
                      type="button"
                      onClick={() => setSelectedMembers((list) => selected ? list.filter((item) => item.uid !== profile.uid) : [...list, profile])}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-muted", selected && "bg-muted")}
                    >
                      <UserAvatar user={profile} size="sm" />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{profile.displayName}</strong>
                        <span className="block truncate text-xs text-muted-foreground">@{profile.username}</span>
                      </span>
                      <span className={cn(
                        "grid h-6 w-6 place-items-center rounded-full border text-[11px] font-bold transition-colors",
                        selected ? "border-primary bg-primary text-white" : "border-border text-transparent"
                      )}>
                        ✓
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            <Button onClick={() => void createGroup()} disabled={selectedMembers.length < 2} className="h-11 w-full rounded-full text-[15px] font-bold">
              Create group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Message group: stacked bubbles from one sender                       */
/* ------------------------------------------------------------------ */

function MessageGroup({
  group,
  mine,
  isGroupChat,
  showSeen,
  seen,
}: {
  group: { senderId: string; items: ChatMessage[] };
  mine: boolean;
  isGroupChat: boolean;
  showSeen: boolean;
  seen: boolean;
}) {
  const count = group.items.length;
  const first = group.items[0];
  const last = group.items[count - 1];
  const senderName = first?.sender?.displayName || "Someone";

  /** iMessage-style corner shaping: the edge facing the screen edge squares
      off where bubbles stack. */
  const bubbleRadius = (index: number) => {
    if (count === 1) return mine ? "rounded-br-md" : "rounded-bl-md";
    if (index === 0) return mine ? "rounded-br-md" : "rounded-bl-md";
    if (index === count - 1) return mine ? "rounded-tr-md" : "rounded-tl-md";
    return mine ? "rounded-r-md" : "rounded-l-md";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-3 flex gap-2.5 first:mt-0", mine ? "justify-end" : "justify-start")}>
      {!mine ? (
        <div className="w-7 shrink-0 self-end">
          <UserAvatar user={first?.sender} size="xs" className="h-7 w-7" />
        </div>
      ) : null}
      <div className={cn("flex min-w-0 max-w-[78%] flex-col sm:max-w-[70%]", mine ? "items-end" : "items-start")}>
        {!mine && isGroupChat ? (
          <p className="mb-1 ml-3 text-xs font-medium text-muted-foreground">{senderName}</p>
        ) : null}
        {group.items.map((message, index) => (
          <div
            key={message.id}
            className={cn(
              "max-w-full overflow-hidden rounded-3xl text-[15px] leading-6",
              index > 0 && "mt-1",
              bubbleRadius(index),
              mine ? "bg-primary text-white" : "bg-muted text-foreground"
            )}
          >
            {message.mediaUrl && (message.mediaType === "image" || message.mediaType === "gif") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrl(message.mediaUrl)} alt={message.fileName || "Shared image"} className="max-h-[420px] w-full object-cover" />
            ) : null}
            {message.mediaUrl && message.mediaType === "video" ? (
              <video src={assetUrl(message.mediaUrl)} controls playsInline className="max-h-[420px] w-full bg-black" />
            ) : null}
            {message.mediaUrl && message.mediaType === "file" ? (
              <a href={assetUrl(message.mediaUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:underline">
                <File className="h-6 w-6 shrink-0" />
                <span className="min-w-0">
                  <strong className="block truncate">{message.fileName || "File"}</strong>
                  <span className={cn("text-xs", mine ? "text-white/70" : "text-muted-foreground")}>{formatBytes(message.fileSize || 0)}</span>
                </span>
              </a>
            ) : null}
            {message.sharedPostId ? (
              <Link href={`/post?id=${encodeURIComponent(message.sharedPostId)}`} className="flex items-center gap-2 px-4 py-3 font-semibold hover:underline">
                <FileImage className="h-5 w-5 shrink-0" />View shared post
              </Link>
            ) : null}
            {message.sharedStoryId ? (
              <div className="flex items-center gap-2 px-4 py-3 font-semibold">
                <Film className="h-5 w-5 shrink-0" />Shared a story
              </div>
            ) : null}
            {message.text ? <p className="whitespace-pre-wrap break-words px-4 py-2">{message.text}</p> : null}
          </div>
        ))}
        <p className={cn("mt-1 text-[11px] text-muted-foreground", mine ? "mr-1" : "ml-1")}>
          {showSeen ? (seen ? "Seen" : formatClock(toMs(last?.createdAt))) : formatClock(toMs(last?.createdAt))}
        </p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                           */
/* ------------------------------------------------------------------ */

function MessagesSkeleton() {
  return (
    <div className="flex h-[70vh]">
      <div className="w-full border-r border-border p-4 sm:w-[340px]">
        <div className="skeleton h-8 w-36 rounded-lg" />
        <div className="skeleton mt-4 h-10 w-full rounded-full" />
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="mt-5 flex gap-3">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-1 sm:block" />
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div>
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="flex gap-3 px-4 py-3">
          <div className="skeleton h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2 py-1">
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-3 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "File";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
