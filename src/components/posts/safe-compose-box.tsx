"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  Film,
  ImageIcon,
  Loader2,
  ShieldCheck,
  Smile,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";
import { createPost } from "@/services/posts";
import { assertContentAllowed, evaluateContent } from "@/lib/automod";
import { MAX_IMAGES_PER_POST, MAX_POST_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDraft } from "@/hooks/use-draft";
import { GifPicker, type GifResult } from "@/components/posts/gif-picker";
import { HashtagSuggest } from "@/components/posts/hashtag-suggest";
import type { MediaItem } from "@/types";
import { ensureHashtagsFromText } from "@/services/hashtags";

const QUICK_EMOJIS = ["✨", "🔥", "💙", "😂", "🙌", "🚀", "👀", "🎯", "☕", "💯"];

export function SafeComposeBox({
  onSuccess,
  autofocus,
  parentId,
  quoteOfId,
  groupId,
  eventId,
  placeholder = "What's happening?",
}: {
  onSuccess?: () => void;
  autofocus?: boolean;
  parentId?: string;
  quoteOfId?: string;
  groupId?: string;
  eventId?: string;
  placeholder?: string;
}) {
  const { user, profile, refreshProfile } = useAuth();
  const useDrafts = !parentId && !quoteOfId && !groupId && !eventId;
  const { text, setText, clearDraft } = useDraft(useDrafts);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [gifMedia, setGifMedia] = useState<MediaItem[]>([]);
  const [showPoll, setShowPoll] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string[]>([]);

  useEffect(() => { previewRef.current = previews; }, [previews]);
  useEffect(() => () => previewRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const remaining = MAX_POST_LENGTH - text.length;
  const mediaCount = files.length + gifMedia.length;
  const moderation = evaluateContent(text, "post");
  const canPost = Boolean(user) && !posting && remaining >= 0 && (text.trim().length > 0 || mediaCount > 0) && moderation.allowed;

  const replaceFiles = (next: File[]) => {
    previewRef.current.forEach((url) => URL.revokeObjectURL(url));
    const urls = next.map((file) => URL.createObjectURL(file));
    previewRef.current = urls;
    setFiles(next);
    setPreviews(urls);
  };

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const room = Math.max(0, MAX_IMAGES_PER_POST - gifMedia.length);
    const accepted = Array.from(list)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, room);
    replaceFiles([...files, ...accepted].slice(0, room));
  };

  const onGif = (gif: GifResult) => {
    if (mediaCount >= MAX_IMAGES_PER_POST) {
      toast.error(`Maximum ${MAX_IMAGES_PER_POST} media items`);
      return;
    }
    setGifMedia((items) => [...items, { type: "gif", url: gif.url, width: gif.width, height: gif.height }]);
    setShowGif(false);
  };

  const reset = () => {
    setText("");
    clearDraft();
    replaceFiles([]);
    setGifMedia([]);
    setShowPoll(false);
    setShowEmoji(false);
    setShowGif(false);
    setPollOptions(["", ""]);
  };

  const submit = async () => {
    if (!user || !canPost) return;
    setPosting(true);
    try {
      assertContentAllowed(text, "post");
      for (const option of pollOptions) {
        if (option.trim()) assertContentAllowed(option, "post");
      }
      await createPost({
        authorId: user.uid,
        text,
        files,
        extraMedia: gifMedia,
        parentId: parentId ?? null,
        quoteOfId: quoteOfId ?? null,
        groupId: groupId ?? null,
        eventId: eventId ?? null,
        type: parentId ? "reply" : quoteOfId ? "quote" : "post",
        poll: showPoll ? { options: pollOptions.filter((option) => option.trim()) } : null,
      });
      await ensureHashtagsFromText(text).catch(() => undefined);
      try {
        const { bumpChallengeProgress } = await import("@/services/shop");
        if (parentId) await bumpChallengeProgress(user.uid, "reply");
        else {
          await bumpChallengeProgress(user.uid, "post");
          if (mediaCount) await bumpChallengeProgress(user.uid, "media");
        }
      } catch {
        // Challenges are optional and must never prevent a post.
      }
      reset();
      await refreshProfile();
      toast.success(parentId ? "Reply posted" : "Posted");
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Could not publish this post.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <UserAvatar user={profile} animate clickable={false} />
      <div className="min-w-0 flex-1">
        <div className="relative">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_POST_LENGTH + 40))}
            placeholder={placeholder}
            autoFocus={autofocus}
            className="min-h-[84px] resize-none border-0 bg-transparent px-0 py-1 text-[17px] leading-7 shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <HashtagSuggest
            text={text}
            onPick={(tag) => {
              const replaced = text.replace(/#([a-zA-Z0-9_]*)$/, `#${tag} `);
              setText(replaced === text ? `${text}#${tag} ` : replaced);
            }}
          />
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {useDrafts && text.trim() ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[9px] font-black text-muted-foreground"><Sparkles className="h-3 w-3" />Draft saved</span> : null}
          {moderation.severity === "warning" ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-black text-amber-700 dark:text-amber-300"><ShieldCheck className="h-3 w-3" />Review wording</span> : null}
          {!moderation.allowed ? <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[9px] font-black text-red-700 dark:text-red-300"><ShieldCheck className="h-3 w-3" />Blocked by AutoMod</span> : null}
        </div>

        {previews.length || gifMedia.length ? (
          <div className={cn("mb-3 grid gap-1.5 overflow-hidden rounded-2xl", mediaCount === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {previews.map((src, index) => <MediaPreview key={src} src={src} onRemove={() => replaceFiles(files.filter((_, itemIndex) => itemIndex !== index))} />)}
            {gifMedia.map((media, index) => <MediaPreview key={`${media.url}-${index}`} src={media.url} label="GIF" onRemove={() => setGifMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
          </div>
        ) : null}

        {showPoll ? <div className="mb-3 space-y-2 rounded-2xl border border-border bg-muted/30 p-3">{pollOptions.map((option, index) => <input key={index} value={option} onChange={(event) => setPollOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary" />)}{pollOptions.length < 4 ? <button type="button" onClick={() => setPollOptions((items) => [...items, ""])} className="text-xs font-black text-primary">Add option</button> : null}</div> : null}

        {showEmoji ? <div className="mb-3 flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-2">{QUICK_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setText((value) => value + emoji)} className="grid h-9 w-9 place-items-center rounded-xl text-lg hover:bg-muted active:scale-90">{emoji}</button>)}</div> : null}
        <GifPicker open={showGif} onClose={() => setShowGif(false)} onSelect={onGif} />

        <div className="flex items-center justify-between border-t border-border/70 pt-3">
          <div className="flex items-center gap-0.5">
            <input ref={fileRef} type="file" accept="image/*,video/*,.gif" multiple className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
            <ToolButton title="Photo or video" onClick={() => fileRef.current?.click()}><ImageIcon className="h-5 w-5" /></ToolButton>
            <ToolButton title="GIF" active={showGif} onClick={() => { setShowGif((value) => !value); setShowEmoji(false); }}><Film className="h-5 w-5" /></ToolButton>
            <ToolButton title="Poll" active={showPoll} onClick={() => setShowPoll((value) => !value)}><BarChart3 className="h-5 w-5" /></ToolButton>
            <ToolButton title="Emoji" active={showEmoji} onClick={() => { setShowEmoji((value) => !value); setShowGif(false); }}><Smile className="h-5 w-5" /></ToolButton>
          </div>
          <div className="flex items-center gap-3">
            {text.length ? <span className={cn("text-[10px] font-black", remaining < 0 ? "text-red-500" : remaining < 40 ? "text-amber-500" : "text-muted-foreground")}>{remaining}</span> : null}
            <Button onClick={() => void submit()} disabled={!canPost} className="h-10 min-w-[88px] rounded-full font-black">{posting ? <Loader2 className="h-4 w-4 animate-spin" /> : parentId ? "Reply" : "Post"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ src, label, onRemove }: { src: string; label?: string; onRemove: () => void }) {
  return <div className="relative min-h-36 overflow-hidden bg-muted"><img src={src} alt="" className="h-44 w-full object-cover sm:h-56" />{label ? <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{label}</span> : null}<button type="button" onClick={onRemove} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white" aria-label="Remove media"><X className="h-4 w-4" /></button></div>;
}

function ToolButton({ children, onClick, title, active }: { children: ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className={cn("grid h-9 w-9 place-items-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95", active && "bg-primary/12")}>{children}</button>;
}
