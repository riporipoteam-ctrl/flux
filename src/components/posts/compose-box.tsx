"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Film,
  ImageIcon,
  Loader2,
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
import { MAX_IMAGES_PER_POST, MAX_POST_LENGTH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useDraft } from "@/hooks/use-draft";
import { GifPicker, type GifResult } from "@/components/posts/gif-picker";
import { HashtagSuggest } from "@/components/posts/hashtag-suggest";
import type { MediaItem } from "@/types";
import { ensureHashtagsFromText } from "@/services/hashtags";

const QUICK_EMOJIS = ["✨", "🔥", "💙", "😂", "🙌", "🚀", "👀", "🎯", "☕", "💯"];

export function ComposeBox({
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

  useEffect(() => {
    previewRef.current = previews;
  }, [previews]);

  useEffect(() => () => {
    previewRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const remaining = MAX_POST_LENGTH - text.length;
  const progress = Math.min(1, text.length / MAX_POST_LENGTH);
  const mediaCount = files.length + gifMedia.length;
  const canPost = (text.trim().length > 0 || mediaCount > 0) && remaining >= 0 && !posting && Boolean(user);

  const replacePreviews = (nextFiles: File[]) => {
    previewRef.current.forEach((url) => URL.revokeObjectURL(url));
    const nextUrls = nextFiles.map((file) => URL.createObjectURL(file));
    previewRef.current = nextUrls;
    setPreviews(nextUrls);
  };

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const room = Math.max(0, MAX_IMAGES_PER_POST - gifMedia.length);
    const accepted = Array.from(list).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")).slice(0, room);
    const next = [...files, ...accepted].slice(0, room);
    setFiles(next);
    replacePreviews(next);
  };

  const removeFile = (index: number) => {
    const next = files.filter((_, itemIndex) => itemIndex !== index);
    setFiles(next);
    replacePreviews(next);
  };

  const onGif = (gif: GifResult) => {
    if (files.length + gifMedia.length >= MAX_IMAGES_PER_POST) {
      toast.error(`Max ${MAX_IMAGES_PER_POST} media items`);
      return;
    }
    setGifMedia((items) => [...items, { type: "gif", url: gif.url, width: gif.width, height: gif.height }]);
    setShowGif(false);
  };

  const resetComposer = () => {
    setText("");
    clearDraft();
    setFiles([]);
    replacePreviews([]);
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
          if (files.length || gifMedia.length) await bumpChallengeProgress(user.uid, "media");
        }
      } catch {}
      resetComposer();
      await refreshProfile();
      toast.success(parentId ? "Reply posted" : "Posted");
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Could not post. Check your connection and permissions.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <UserAvatar user={profile} animate clickable={false} />
      <div className="relative min-w-0 flex-1">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_POST_LENGTH + 40))}
          placeholder={placeholder}
          autoFocus={autofocus}
          className="min-h-[62px] resize-none border-0 bg-transparent px-0 py-1 text-[17px] leading-6 shadow-none placeholder:text-muted-foreground focus-visible:ring-0 sm:min-h-[84px] sm:text-[18px]"
        />
        <HashtagSuggest text={text} onPick={(tag) => {
          const replaced = text.replace(/#([a-zA-Z0-9_]*)$/, `#${tag} `);
          setText(replaced === text ? `${text}#${tag} ` : replaced);
        }} />

        {useDrafts && text.trim() ? <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Sparkles className="h-3 w-3" />Draft saved on this device</p> : null}

        {previews.length || gifMedia.length ? (
          <div className={cn("mb-3 grid gap-1.5 overflow-hidden rounded-2xl", previews.length + gifMedia.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {previews.map((src, index) => <MediaPreview key={src} src={src} onRemove={() => removeFile(index)} />)}
            {gifMedia.map((media, index) => <MediaPreview key={`${media.url}-${index}`} src={media.url} label="GIF" onRemove={() => setGifMedia((items) => items.filter((_, itemIndex) => itemIndex !== index))} />)}
          </div>
        ) : null}

        {showPoll ? (
          <div className="mb-3 space-y-2 border-y border-border py-3">
            {pollOptions.map((option, index) => <input key={index} value={option} onChange={(event) => setPollOptions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary" />)}
            {pollOptions.length < 4 ? <button type="button" onClick={() => setPollOptions((items) => [...items, ""])} className="text-xs font-bold text-primary">Add option</button> : null}
          </div>
        ) : null}

        {showEmoji ? <div className="mb-3 flex flex-wrap gap-1 border-y border-border py-2">{QUICK_EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => setText((value) => value + emoji)} className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-muted active:scale-90">{emoji}</button>)}</div> : null}

        <GifPicker open={showGif} onClose={() => setShowGif(false)} onSelect={onGif} />

        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <div className="flex items-center gap-0.5">
            <input ref={fileRef} type="file" accept="image/*,video/*,.gif" multiple className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
            <ToolButton title="Photo or video" onClick={() => fileRef.current?.click()}><ImageIcon className="h-[19px] w-[19px]" /></ToolButton>
            <ToolButton title="GIF" active={showGif} onClick={() => { setShowGif((value) => !value); setShowEmoji(false); }}><Film className="h-[19px] w-[19px]" /></ToolButton>
            <ToolButton title="Poll" active={showPoll} onClick={() => setShowPoll((value) => !value)}><BarChart3 className="h-[19px] w-[19px]" /></ToolButton>
            <ToolButton title="Emoji" active={showEmoji} onClick={() => { setShowEmoji((value) => !value); setShowGif(false); }}><Smile className="h-[19px] w-[19px]" /></ToolButton>
          </div>

          <div className="flex items-center gap-2.5">
            {text.length > 0 ? <CharacterMeter progress={progress} remaining={remaining} /> : null}
            <Button onClick={() => void submit()} disabled={!canPost} className="h-9 min-w-[76px] rounded-full px-4 text-sm font-extrabold sm:h-10 sm:min-w-[88px]">{posting ? <Loader2 className="h-4 w-4 animate-spin" /> : parentId ? "Reply" : "Post"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ src, label, onRemove }: { src: string; label?: string; onRemove: () => void }) {
  return <div className="relative min-h-36 overflow-hidden bg-muted sm:min-h-44"><img src={src} alt="" className="h-44 w-full object-cover sm:h-56" />{label ? <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{label}</span> : null}<button type="button" onClick={onRemove} className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white" aria-label="Remove media"><X className="h-4 w-4" /></button></div>;
}

function CharacterMeter({ progress, remaining }: { progress: number; remaining: number }) {
  return <div className="relative h-7 w-7"><svg className="h-7 w-7 -rotate-90" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${progress * 97} 97`} strokeLinecap="round" className={remaining < 0 ? "text-destructive" : remaining < 40 ? "text-amber-500" : "text-primary"} /></svg>{remaining < 40 ? <span className={cn("absolute inset-0 grid place-items-center text-[8px] font-bold", remaining < 0 ? "text-destructive" : "text-muted-foreground")}>{remaining}</span> : null}</div>;
}

function ToolButton({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return <button type="button" title={title} aria-label={title} onClick={onClick} className={cn("grid h-9 w-9 place-items-center rounded-full text-primary transition hover:bg-primary/10 active:scale-95", active && "bg-primary/12")}>{children}</button>;
}
