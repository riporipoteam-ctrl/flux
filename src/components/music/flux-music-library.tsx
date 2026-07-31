"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Headphones, Loader2, Music2, Pause, Play, Search, ShieldCheck, X } from "lucide-react";
import {
  STORY_MUSIC,
  STORY_MUSIC_GENRES,
  type StoryMusicGenre,
  type StoryMusicTrack,
} from "@/lib/story-music";
import { cn } from "@/lib/utils";

export function FluxMusicLibrary({
  selectedId,
  onSelect,
  allowNone = false,
  className,
  title = "Music library",
  description = "130 real CC0 and public-domain tracks. No generated tones.",
}: {
  selectedId?: string | null;
  onSelect?: (track: StoryMusicTrack | null) => void;
  allowNone?: boolean;
  className?: string;
  title?: string;
  description?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<"All" | StoryMusicGenre>("All");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return STORY_MUSIC.filter((track) => {
      const genreMatch = genre === "All" || track.genre === genre;
      const textMatch = !needle || [track.title, track.artist, track.genre, track.mood]
        .join(" ")
        .toLowerCase()
        .includes(needle);
      return genreMatch && textMatch;
    });
  }, [genre, query]);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setLoadingId(null);
  };

  const preview = async (track: StoryMusicTrack) => {
    if (playingId === track.id) {
      stop();
      return;
    }
    stop();
    const audio = new Audio(track.audioUrl);
    audio.preload = "metadata";
    audio.volume = 0.42;
    audioRef.current = audio;
    setLoadingId(track.id);
    audio.addEventListener("canplay", () => setLoadingId(null), { once: true });
    audio.addEventListener("ended", stop, { once: true });
    audio.addEventListener("error", stop, { once: true });
    try {
      await audio.play();
      setPlayingId(track.id);
    } catch {
      stop();
    }
  };

  return (
    <section className={cn("overflow-hidden rounded-[26px] border border-white/10 bg-[#0c0e13]", className)}>
      <header className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(124,92,255,.18),rgba(0,0,0,0)_58%)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
            <Headphones className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
              <span className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                130 tracks
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tracks, moods, or genres"
            className="h-11 w-full rounded-2xl border border-white/10 bg-black/30 pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/28 focus:border-violet-400"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/45 hover:bg-white/8" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STORY_MUSIC_GENRES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setGenre(item)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-[10px] font-black transition",
                genre === item ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/9 hover:text-white"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <div className="max-h-[520px] overflow-y-auto p-2 sm:p-3">
        {allowNone ? (
          <button
            type="button"
            onClick={() => { stop(); onSelect?.(null); }}
            className={cn(
              "mb-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition",
              !selectedId ? "border-violet-400/60 bg-violet-500/10" : "border-white/8 hover:bg-white/5"
            )}
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/7"><Music2 className="h-4 w-4 text-white/45" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-sm text-white">No music</strong><span className="text-[10px] text-white/35">Keep the original Story audio</span></span>
            {!selectedId ? <Check className="h-4 w-4 text-violet-300" /> : null}
          </button>
        ) : null}

        {filtered.length ? (
          <div className="space-y-1.5">
            {filtered.map((track) => {
              const selected = selectedId === track.id;
              const playing = playingId === track.id;
              const loading = loadingId === track.id;
              return (
                <article key={track.id} className={cn("group flex min-h-[68px] items-center gap-3 rounded-2xl border px-2.5 py-2 transition", selected ? "border-violet-400/60 bg-violet-500/10" : "border-transparent hover:border-white/8 hover:bg-white/[.035]")}>
                  <button type="button" onClick={() => void preview(track)} className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl transition", playing ? "bg-violet-500 text-white" : "bg-white/7 text-white hover:bg-white/12")} aria-label={playing ? `Pause ${track.title}` : `Preview ${track.title}`}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  </button>
                  <button type="button" onClick={() => onSelect?.(track)} className="min-w-0 flex-1 text-left">
                    <strong className="block truncate text-sm text-white">{track.title}</strong>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white/38">
                      <span>{track.genre}</span><span>•</span><span>{track.mood}</span><span>•</span><span className="inline-flex items-center gap-1 text-emerald-300/80"><ShieldCheck className="h-3 w-3" />CC0</span>
                    </span>
                  </button>
                  <a href={track.sourceUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/28 opacity-0 transition hover:bg-white/8 hover:text-white group-hover:opacity-100" aria-label={`Open source for ${track.title}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-violet-300" /> : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center px-6 text-center">
            <div><Music2 className="mx-auto h-8 w-8 text-white/20" /><h3 className="mt-3 font-black text-white">No matching tracks</h3><p className="mt-1 text-xs text-white/35">Try another search or genre.</p></div>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 px-4 py-3 text-[9px] text-white/30">
        <span>Streamed from FreePD’s preserved CC0 library</span>
        <span>No royalties · no attribution required</span>
      </footer>
    </section>
  );
}
