"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  ExternalLink,
  RefreshCw,
  Radio,
  Volume2,
  Loader2,
  Cast,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Fullscreen in-Flux remote game / watch shell. */
export function StreamPlayer({
  url,
  title = "Flux Watch",
  onClose,
  toolbarActions,
}: {
  url: string;
  title?: string;
  onClose?: () => void;
  toolbarActions?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState(url);
  const [loading, setLoading] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSrc(url);
    setLoading(true);
  }, [url]);

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const req =
      el.requestFullscreen ||
      // @ts-expect-error webkit
      el.webkitRequestFullscreen;
    try {
      req?.call(el);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const bumpChrome = () => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 3200);
  };

  useEffect(() => {
    bumpChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const reload = () => {
    setLoading(true);
    setSrc(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
  };

  const toggleFs = () => {
    const el = wrapRef.current;
    try {
      if (!document.fullscreenElement) void el?.requestFullscreen();
      else void document.exitFullscreen();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={wrapRef}
      className="fixed inset-0 z-[300] flex flex-col bg-[#050508]"
      onMouseMove={bumpChrome}
      onTouchStart={bumpChrome}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(29,155,240,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(255,107,53,0.2), transparent 50%)",
        }}
      />

      <div
        className={cn(
          "relative z-10 flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 transition-all duration-300 sm:px-4",
          chromeVisible
            ? "translate-y-0 bg-black/70 opacity-100 backdrop-blur-xl"
            : "-translate-y-full opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#1d9bf0] shadow-lg shadow-[#1d9bf0]/20">
            <Cast className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
              <p className="truncate text-sm font-bold text-white">{title}</p>
            </div>
            <p className="truncate text-[11px] text-white/45">Flux Watch · remote game stream</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {toolbarActions}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={reload}
            title="Reload stream"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            <span className="ml-1 hidden sm:inline">Reload</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => window.open(url, "_blank", "noopener")}
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Tab</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={toggleFs}
            title="Toggle fullscreen"
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">{isFs ? "Exit FS" : "Fullscreen"}</span>
          </Button>
          <Button
            size="sm"
            className="h-8 bg-white/10 text-white hover:bg-red-500/90"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="ml-1">Exit</span>
          </Button>
        </div>
      </div>

      <div className="relative z-0 min-h-0 flex-1">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#050508]/85">
            <div className="relative">
              <div className="h-14 w-14 animate-pulse rounded-2xl bg-gradient-to-br from-[#ff6b35]/40 to-[#1d9bf0]/40" />
              <Loader2 className="absolute inset-0 m-auto h-7 w-7 animate-spin text-white" />
            </div>
            <p className="text-sm font-medium text-white/70">Connecting stream…</p>
            <p className="max-w-xs text-center text-[11px] text-white/40">
              The assigned game host must stay online while your session is running.
            </p>
          </div>
        )}
        <iframe
          title={title}
          src={src}
          className="h-full w-full border-0 bg-black"
          allow="gamepad; fullscreen; autoplay; clipboard-read; clipboard-write; keyboard-map *"
          allowFullScreen
          onLoad={() => setLoading(false)}
        />
      </div>

      <div
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 border-t border-white/10 px-3 py-2 transition-all duration-300",
          chromeVisible
            ? "translate-y-0 bg-black/70 opacity-100 backdrop-blur-xl"
            : "translate-y-full opacity-0",
        )}
      >
        <Volume2 className="h-3.5 w-3.5 text-white/40" />
        <p className="text-center text-[11px] text-white/50">
          Flux remote game stream · audio, keyboard and gamepad depend on the assigned host streamer. Move the pointer to show controls.
        </p>
      </div>
    </div>
  );
}
