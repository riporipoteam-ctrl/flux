"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Sticker, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { listCustomStickers, type CustomSticker } from "@/services/custom-stickers";
import { Input } from "@/components/ui/input";

export function CustomStickerPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (sticker: CustomSticker) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<CustomSticker[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listCustomStickers({ surface: "posts", viewerId: user?.uid })
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, user?.uid]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => !needle || [item.name, ...item.tags].join(" ").toLowerCase().includes(needle));
  }, [items, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-black/45 p-0 sm:place-items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-[min(76dvh,680px)] w-full flex-col overflow-hidden rounded-t-[28px] border border-border bg-background shadow-2xl sm:max-w-2xl sm:rounded-[28px]">
        <header className="flex items-center gap-3 border-b border-border p-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-300"><Sticker className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><h2 className="font-black">Flux stickers</h2><p className="text-[10px] text-muted-foreground">Choose a public or owned sticker</p></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted" aria-label="Close sticker picker"><X className="h-5 w-5" /></button>
        </header>
        <div className="p-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stickers" className="h-11 rounded-full pl-10" /></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 pt-0">
          {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : filtered.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4"><button type="button" onClick={() => window.location.assign("/stickers")} className="grid aspect-square place-items-center rounded-2xl border border-dashed border-border bg-muted/30 p-3 text-center"><span><Sticker className="mx-auto h-6 w-6 text-primary" /><span className="mt-2 block text-[9px] font-black">Sticker Lab</span></span></button>{filtered.map((sticker) => <button key={sticker.id} type="button" onClick={() => onSelect(sticker)} className="group relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border bg-muted/25 p-3 transition hover:border-violet-500 hover:bg-violet-500/6"><img src={sticker.imageUrl} alt={sticker.name} className="max-h-full max-w-full object-contain transition group-hover:scale-105" /><span className="absolute inset-x-1 bottom-1 truncate rounded-lg bg-black/65 px-1.5 py-1 text-[8px] font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100">{sticker.name}</span></button>)}</div> : <div className="grid min-h-72 place-items-center text-center"><div><Sticker className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-3 font-black">No post stickers yet</h3><p className="mt-1 text-xs text-muted-foreground">Create one in Sticker Lab.</p></div></div>}
        </div>
      </section>
    </div>
  );
}
