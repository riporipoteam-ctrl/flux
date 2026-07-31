"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  File,
  FileImage,
  Film,
  ImagePlus,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Search,
  Send,
  Smile,
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

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesSkeleton />}>
      <MessagesInner />
    </Suspense>
  );
}

function MessagesInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLink = searchParams.get("c");
  const sharedPostId = searchParams.get("post");
  const sharedStoryId = searchParams.get("story");
  const [conversations, setConversations] = useState<(Conversation & { otherUser?: UserProfile | null })[]>([]);
  const [activeId, setActiveId] = useState<string | null>(deepLink);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  return (
    <main className="flex h-[calc(100dvh_-_53px_-_58px_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] min-h-0 bg-background lg:h-[100dvh]">
      <section className={cn("w-full shrink-0 border-r border-border bg-background sm:w-[350px]", activeId && "hidden sm:flex sm:flex-col")}>
        <header className="flex h-[53px] items-center gap-2 border-b border-border px-4">
          <h1 className="flex-1 text-xl font-bold">Messages</h1>
          <button type="button" onClick={() => setGroupOpen(true)} className="social-action" aria-label="Create group chat"><Users className="h-5 w-5" /></button>
        </header>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className="h-11 rounded-full border-0 bg-muted pl-10 shadow-none" />
          </div>
          {results.length ? (
            <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {results.map((profile) => (
                <li key={profile.uid}>
                  <button type="button" onClick={() => void startDm(profile)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted">
                    <UserAvatar user={profile} size="sm" />
                    <span className="min-w-0"><strong className="block truncate text-sm">{profile.displayName}</strong><span className="block truncate text-xs text-muted-foreground">@{profile.username}{profile.accountType === "business" ? " · Business" : ""}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? <ConversationSkeleton /> : conversations.length === 0 ? (
            <EmptyState icon={Mail} title="No conversations yet" description="Message a mutual friend, or contact a business account." />
          ) : (
            conversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setActiveId(conversation.id)} className={cn("flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/45", activeId === conversation.id && "bg-muted/70")}>
                {conversation.type === "group" ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted"><Users className="h-5 w-5" /></span> : <UserAvatar user={conversation.otherUser} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="truncate font-bold">{conversation.type === "group" ? conversation.name || "Group chat" : conversation.otherUser?.displayName || "Chat"}</p></div>
                  <p className="truncate text-sm text-muted-foreground">{conversation.lastMessage || "Say hello"}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className={cn("flex min-w-0 flex-1 flex-col", !activeId && "hidden sm:flex")}>
        {!activeId ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div><Mail className="mx-auto h-10 w-10 text-muted-foreground" /><h2 className="mt-4 text-xl font-bold">Select a conversation</h2><p className="mt-2 text-sm text-muted-foreground">Private messages, GIFs, files, photos and video.</p></div>
          </div>
        ) : (
          <>
            <header className="flex h-[53px] items-center gap-3 border-b border-border px-3">
              <button type="button" className="social-action sm:hidden" onClick={() => setActiveId(null)} aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              {active?.type === "group" ? <span className="grid h-9 w-9 place-items-center rounded-full bg-muted"><Users className="h-4 w-4" /></span> : <UserAvatar user={active?.otherUser} size="sm" />}
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{activeName}</p><p className="truncate text-xs text-muted-foreground">{active?.type === "group" ? `${active.participantIds.length} people` : `@${active?.otherUser?.username || "user"}`}</p></div>
              {active?.type === "dm" ? (
                <>
                  <button type="button" onClick={() => void startCall("voice")} className="social-action" aria-label="Voice call"><Phone className="h-5 w-5" /></button>
                  <button type="button" onClick={() => void startCall("video")} className="social-action" aria-label="Video call"><Video className="h-5 w-5" /></button>
                </>
              ) : null}
            </header>

            {(sharedPostId || sharedStoryId) ? (
              <div className="flex items-center gap-3 border-b border-border bg-muted/45 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">Ready to share {sharedPostId ? "a post" : "a story"} in this chat</span>
                <button type="button" onClick={() => router.replace(`/messages?c=${activeId}`)} className="social-action"><X className="h-4 w-4" /></button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
              <div className="mx-auto max-w-3xl space-y-2">
                {messages.map((message) => <MessageBubble key={message.id} message={message} mine={message.senderId === user?.uid} />)}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="border-t border-border bg-background p-2.5 story-safe-bottom">
              <div className="mx-auto flex max-w-3xl items-end gap-1.5">
                <button type="button" onClick={() => fileRef.current?.click()} className="social-action shrink-0" aria-label="Attach file" disabled={uploading}>
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
                </button>
                <button type="button" onClick={() => setGifOpen(true)} className="social-action shrink-0 text-xs font-black" aria-label="Choose GIF">GIF</button>
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
                  className="min-h-11 flex-1 rounded-2xl border-0 bg-muted px-4 shadow-none"
                />
                <Button size="icon" onClick={() => void onSend()} disabled={sending || (!text.trim() && !sharedPostId && !sharedStoryId)} className="h-11 w-11 shrink-0 rounded-full">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.zip,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={(event) => void onFile(event.target.files?.[0] || null)} />
              </div>
            </footer>
          </>
        )}
      </section>

      <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} onSelect={(gif) => void onGif(gif)} />

      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>New group chat</DialogTitle></DialogHeader>
          <div className="space-y-3 p-4">
            <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" />
            <Input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} placeholder="Search friends" />
            {selectedMembers.length ? (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((profile) => <button key={profile.uid} type="button" onClick={() => setSelectedMembers((list) => list.filter((item) => item.uid !== profile.uid))} className="flex items-center gap-2 rounded-full bg-muted px-2 py-1 text-xs font-semibold"><UserAvatar user={profile} size="xs" />{profile.displayName}<X className="h-3 w-3" /></button>)}
              </div>
            ) : null}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
              {groupResults.map((profile) => {
                const selected = selectedMembers.some((item) => item.uid === profile.uid);
                return <button key={profile.uid} type="button" onClick={() => setSelectedMembers((list) => selected ? list.filter((item) => item.uid !== profile.uid) : [...list, profile])} className={cn("flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-0 hover:bg-muted", selected && "bg-accent")}><UserAvatar user={profile} size="sm" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{profile.displayName}</strong><span className="text-xs text-muted-foreground">@{profile.username}</span></span>{selected ? <span className="text-xs font-bold text-primary">Added</span> : null}</button>;
              })}
            </div>
            <Button onClick={() => void createGroup()} disabled={selectedMembers.length < 2} className="w-full rounded-full">Create group</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[82%] overflow-hidden rounded-[20px] text-sm", mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-muted text-foreground")}>
        {message.mediaUrl && (message.mediaType === "image" || message.mediaType === "gif") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={assetUrl(message.mediaUrl)} alt={message.fileName || "Shared image"} className="max-h-[420px] w-full object-cover" />
        ) : null}
        {message.mediaUrl && message.mediaType === "video" ? <video src={assetUrl(message.mediaUrl)} controls playsInline className="max-h-[420px] w-full bg-black" /> : null}
        {message.mediaUrl && message.mediaType === "file" ? (
          <a href={assetUrl(message.mediaUrl)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 hover:underline"><File className="h-6 w-6" /><span className="min-w-0"><strong className="block truncate">{message.fileName || "File"}</strong><span className={cn("text-xs", mine ? "text-white/70" : "text-muted-foreground")}>{formatBytes(message.fileSize || 0)}</span></span></a>
        ) : null}
        {message.sharedPostId ? <Link href={`/post?id=${encodeURIComponent(message.sharedPostId)}`} className="flex items-center gap-2 border-b border-white/10 p-3 font-semibold hover:underline"><FileImage className="h-5 w-5" />View shared post</Link> : null}
        {message.sharedStoryId ? <div className="flex items-center gap-2 border-b border-white/10 p-3 font-semibold"><Film className="h-5 w-5" />Shared a story</div> : null}
        {message.text ? <p className="whitespace-pre-wrap break-words px-3.5 py-2.5">{message.text}</p> : null}
      </div>
    </motion.div>
  );
}

function MessagesSkeleton() {
  return <div className="flex h-[70vh]"><div className="w-full border-r border-border p-4 sm:w-[350px]"><div className="skeleton h-7 w-32" />{Array.from({ length: 6 }).map((_, index) => <div key={index} className="mt-5 flex gap-3"><div className="skeleton h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-full" /></div></div>)}</div><div className="hidden flex-1 sm:block" /></div>;
}

function ConversationSkeleton() {
  return <div>{Array.from({ length: 7 }).map((_, index) => <div key={index} className="flex gap-3 border-b border-border p-3"><div className="skeleton h-11 w-11 rounded-full" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-1/2" /><div className="skeleton h-3 w-4/5" /></div></div>)}</div>;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "File";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
