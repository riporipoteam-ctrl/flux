"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GifResult {
  id: string;
  url: string;
  preview: string;
  width?: number;
  height?: number;
}

async function searchGifs(q: string): Promise<GifResult[]> {
  const key =
    process.env.NEXT_PUBLIC_GIPHY_API_KEY || "hpvZycW22qCjn5cRM1xtWB8NKq4dQ2My";
  const endpoint = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q.trim())}&limit=30&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=30&rating=pg-13`;

  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("GIF search failed");
  const data = await res.json();
  return (data.data || []).map(
    (g: {
      id: string;
      images: {
        fixed_width?: { url: string; width: string; height: string };
        downsized_medium?: { url: string };
        original?: { url: string };
      };
    }) => ({
      id: g.id,
      url: g.images.downsized_medium?.url || g.images.original?.url || "",
      preview: g.images.fixed_width?.url || g.images.downsized_medium?.url || "",
      width: Number(g.images.fixed_width?.width || 0) || undefined,
      height: Number(g.images.fixed_width?.height || 0) || undefined,
    })
  );
}

const QUICK = ["funny", "love", "yes", "no", "wow", "lol", "cry", "clap", "fire", "dance"];

export function GifPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifResult) => void;
}) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      searchGifs(q)
        .then((list) => {
          if (!cancelled) setGifs(list.filter((g) => g.url && g.preview));
        })
        .catch(() => {
          if (!cancelled) setGifs([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, q ? 280 : 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[min(80vh,560px)] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:rounded-3xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="text-base">Choose a GIF</DialogTitle>
        </DialogHeader>

        <div className="shrink-0 space-y-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search GIFs…"
              className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
              autoFocus
            />
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
            {QUICK.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setQ(tag)}
                className={cn(
                  "shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold capitalize",
                  q === tag ? "bg-foreground text-background" : "hover:bg-muted"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : gifs.length === 0 ? (
            <p className="py-14 text-center text-sm text-muted-foreground">
              No GIFs found
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onSelect(g);
                    onClose();
                  }}
                  className="overflow-hidden rounded-xl bg-muted transition hover:opacity-90 active:scale-[0.98]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.preview}
                    alt=""
                    className="aspect-square h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="shrink-0 border-t border-border py-2 text-center text-[10px] text-muted-foreground">
          GIFs via GIPHY
        </p>
      </DialogContent>
    </Dialog>
  );
}
