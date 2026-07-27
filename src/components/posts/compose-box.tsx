"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon,
  BarChart3,
  X,
  Smile,
  Loader2,
  Sparkles,
  Film,
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
  

  const remaining = MAX_POST_LENGTH - text.length;
  const progress = Math.min(1, text.length / MAX_POST_LENGTH);
  const mediaCount = files.length + gifMedia.length;
  const canPost =
    (text.trim().length > 0 || mediaCount > 0) &&
    remaining >= 0 &&
    !posting &&
    !!user;

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    const room = Math.max(0, MAX_IMAGES_PER_POST - gifMedia.length);
    const next = [...files, ...Array.from(list)].slice(0, room);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const removeFile = (i: number) => {
    setFiles((f) => f.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  };

  const onGif = (gif: GifResult) => {
    if (files.length + gifMedia.length >= MAX_IMAGES_PER_POST) {
      toast.error(`Max ${MAX_IMAGES_PER_POST} media items`);
      return;
    }
    setGifMedia((g) => [
      ...g,
      {
        type: "gif",
        url: gif.url,
        width: gif.width,
        height: gif.height,
      },
    ]);
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
        poll: showPoll
          ? { options: pollOptions.filter((o) => o.trim()) }
          : null,
      });
      try {
        await ensureHashtagsFromText(text);
      } catch {
        /* hashtags optional */
      }
      try {
        const { bumpChallengeProgress } = await import("@/services/shop");
        if (parentId) await bumpChallengeProgress(user.uid, "reply");
        else {
          await bumpChallengeProgress(user.uid, "post");
          if (files.length || gifMedia.length)
            await bumpChallengeProgress(user.uid, "media");
        }
      } catch {
        /* optional */
      }
      setText("");
      clearDraft();
      setFiles([]);
      setPreviews([]);
      setGifMedia([]);
      setShowPoll(false);
      setShowEmoji(false);
      setShowGif(false);
      setPollOptions(["", ""]);
      await refreshProfile();
      toast.success(parentId ? "Reply posted" : "Posted");
      onSuccess?.();
    } catch (e) {
      console.error(e);
      toast.error("Failed to post. Check connection & permissions.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex gap-3">
      <UserAvatar user={profile} animate />
      <div className="relative min-w-0 flex-1">
        <div className="relative">
          <Textarea
            value={text}
            onChange={(e) =>
              setText(e.target.value.slice(0, MAX_POST_LENGTH + 40))
            }
            placeholder={placeholder}
            autoFocus={autofocus}
            className="min-h-[100px] border-0 bg-transparent px-0 text-[17px] leading-relaxed shadow-none focus-visible:ring-0"
          />
          <HashtagSuggest
            text={text}
            onPick={(tag) => {
              // replace trailing #fragment with full tag
              const replaced = text.replace(
                /#([a-zA-Z0-9_]*)$/,
                `#${tag} `
              );
              setText(
                replaced === text ? `${text}#${tag} ` : replaced
              );
            }}
          />
        </div>

        {useDrafts && text.trim() ? (
          <p className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Draft saved on this device
          </p>
        ) : null}

        <AnimatePresence>
          {previews.length > 0 || gifMedia.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "mb-3 grid gap-2",
                previews.length + gifMedia.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-2"
              )}
            >
              {previews.map((src, i) => (
                <div
                  key={src}
                  className="relative overflow-hidden rounded-2xl border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-44 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {gifMedia.map((g, i) => (
                <div
                  key={g.url + i}
                  className="relative overflow-hidden rounded-2xl border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.url} alt="" className="h-44 w-full object-cover" />
                  <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    GIF
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setGifMedia((all) => all.filter((_, idx) => idx !== i))
                    }
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {showPoll ? (
          <div className="mb-3 space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
            {pollOptions.map((opt, i) => (
              <input
                key={i}
                value={opt}
                onChange={(e) => {
                  const next = [...pollOptions];
                  next[i] = e.target.value;
                  setPollOptions(next);
                }}
                placeholder={`Option ${i + 1}`}
                className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
              />
            ))}
            {pollOptions.length < 4 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPollOptions((o) => [...o, ""])}
              >
                Add option
              </Button>
            ) : null}
          </div>
        ) : null}

        {showEmoji ? (
          <div className="mb-3 flex flex-wrap gap-1.5 rounded-2xl border border-border bg-card p-2">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setText((t) => t + e)}
                className="rounded-xl px-2 py-1 text-lg hover:bg-muted active:scale-90"
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}

        <GifPicker
          open={showGif}
          onClose={() => setShowGif(false)}
          onSelect={onGif}
        />

        <div className="flex items-center justify-between border-t border-border/70 pt-3">
          <div className="flex items-center gap-0.5">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*,.gif"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <ToolBtn onClick={() => fileRef.current?.click()} title="Media">
              <ImageIcon className="h-5 w-5" />
            </ToolBtn>
            <ToolBtn
              onClick={() => {
                setShowGif((v) => !v);
                setShowEmoji(false);
              }}
              title="GIF"
              active={showGif}
            >
              <Film className="h-5 w-5" />
            </ToolBtn>
            <ToolBtn
              onClick={() => setShowPoll((v) => !v)}
              title="Poll"
              active={showPoll}
            >
              <BarChart3 className="h-5 w-5" />
            </ToolBtn>
            <ToolBtn
              onClick={() => {
                setShowEmoji((v) => !v);
                setShowGif(false);
              }}
              title="Emoji"
              active={showEmoji}
            >
              <Smile className="h-5 w-5" />
            </ToolBtn>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative h-7 w-7">
              <svg className="h-7 w-7 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-muted"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${progress * 97} 97`}
                  strokeLinecap="round"
                  className={cn(
                    remaining < 0
                      ? "text-destructive"
                      : remaining < 40
                        ? "text-amber-500"
                        : "text-[#1d9bf0]"
                  )}
                />
              </svg>
              {remaining < 40 ? (
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center text-[9px] font-bold",
                    remaining < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {remaining}
                </span>
              ) : null}
            </div>
            <Button
              onClick={submit}
              disabled={!canPost}
              variant="sky"
              className="min-w-[92px]"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : parentId ? (
                "Reply"
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-full p-2 text-[#1d9bf0] transition-colors hover:bg-[#1d9bf0]/10 active:scale-95",
        active && "bg-[#1d9bf0]/15"
      )}
    >
      {children}
    </button>
  );
}
