"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { searchHashtags, type HashtagInfo } from "@/services/hashtags";
import { cn } from "@/lib/utils";

/** Popup when user types #tag in compose */
export function HashtagSuggest({
  text,
  caretHint,
  onPick,
}: {
  text: string;
  caretHint?: number;
  onPick: (tag: string) => void;
}) {
  const [items, setItems] = useState<HashtagInfo[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    // Find #fragment at end of text (or before caret)
    const slice = text.slice(0, caretHint ?? text.length);
    const m = slice.match(/#([a-zA-Z0-9_]*)$/);
    if (!m) {
      setActive(null);
      setItems([]);
      return;
    }
    const frag = m[1];
    setActive(frag);
    let cancelled = false;
    searchHashtags(frag, 6).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [text, caretHint]);

  if (!active && active !== "") return null;
  if (items.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-border bg-background shadow-soft">
      <p className="border-b border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
        Hashtags
      </p>
      {items.map((h) => (
        <button
          key={h.tag}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(h.tag);
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted"
          )}
        >
          <Hash className="h-4 w-4 text-[#1d9bf0]" />
          <span className="font-semibold">#{h.tag}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {h.postsCount > 0 ? `${h.postsCount} posts` : "New"}
          </span>
        </button>
      ))}
    </div>
  );
}
