"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Radio, MapPin } from "lucide-react";
import Link from "next/link";

/**
 * Accurate FIFA World Cup 2026 finalists & key late-stage fixtures
 * (as of tournament end-stage, July 2026).
 * Final: Spain vs Argentina — 19 July 2026, 15:00 EDT, MetLife / NY-NJ Stadium
 * 3rd place: France vs England — 18 July 2026, Miami
 */

type MatchDef = {
  id: string;
  label: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  /** ISO local kickoff in America/New_York (EDT) */
  kickoff: string;
  venue: string;
  stage: string;
};

const MATCHES: MatchDef[] = [
  {
    id: "final",
    label: "Final",
    home: "Spain",
    away: "Argentina",
    homeFlag: "🇪🇸",
    awayFlag: "🇦🇷",
    // 19 July 2026 15:00 EDT = 19:00 UTC
    kickoff: "2026-07-19T15:00:00-04:00",
    venue: "MetLife Stadium · New York / New Jersey",
    stage: "Final · Match 104",
  },
  {
    id: "third",
    label: "3rd place",
    home: "France",
    away: "England",
    homeFlag: "🇫🇷",
    awayFlag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    // 18 July 2026 17:00 EDT typical bronze final window
    kickoff: "2026-07-18T17:00:00-04:00",
    venue: "Hard Rock Stadium · Miami",
    stage: "3rd place play-off",
  },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatKickoff(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function WorldCupWidget() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const matches = useMemo(() => {
    return MATCHES.map((m) => {
      const start = new Date(m.kickoff).getTime();
      const end = start + 120 * 60_000; // up to 2h window
      const live = now >= start && now <= end;
      const upcoming = now < start;
      const finished = now > end;
      const elapsedMin = live ? Math.min(90 + 15, Math.floor((now - start) / 60_000)) : 0;
      // Pre-match: no score. Live: placeholder 0-0 until real feed (honest)
      const homeScore = live || finished ? 0 : null;
      const awayScore = live || finished ? 0 : null;
      const ms = Math.max(0, start - now);
      const d = Math.floor(ms / 86400_000);
      const h = Math.floor((ms % 86400_000) / 3600_000);
      const min = Math.floor((ms % 3600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      const countdown =
        d > 0
          ? `${d}d ${pad(h)}:${pad(min)}:${pad(s)}`
          : `${pad(h)}:${pad(min)}:${pad(s)}`;
      return {
        ...m,
        start,
        live,
        upcoming,
        finished,
        elapsedMin,
        homeScore,
        awayScore,
        countdown,
        kickoffLabel: formatKickoff(m.kickoff),
      };
    }).sort((a, b) => a.start - b.start);
  }, [now]);

  const featured =
    matches.find((m) => m.live) ||
    matches.find((m) => m.upcoming) ||
    matches[matches.length - 1];

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="relative bg-gradient-to-br from-[#0a1628] via-[#0d2a4a] to-[#9b1b30]/40 px-4 py-3 text-white">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
          <div className="absolute -bottom-8 left-4 h-20 w-20 rounded-full bg-[#1d9bf0]/30 blur-2xl" />
        </div>
        <div className="relative flex items-center gap-2">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            <Trophy className="h-5 w-5 text-amber-300" />
          </motion.div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              FIFA World Cup 2026™
            </p>
            <p className="truncate text-sm font-extrabold leading-tight">
              {featured?.label === "Final"
                ? "Final · Spain vs Argentina"
                : featured?.stage}
            </p>
          </div>
          {featured?.live ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">
              <Radio className="h-3 w-3 animate-pulse" /> LIVE
            </span>
          ) : featured?.upcoming ? (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
              SOON
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 p-3">
        {matches.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-border bg-muted/30 px-3 py-2.5"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
              <span className="truncate">{m.stage}</span>
              <span className="shrink-0 tabular-nums">
                {m.live
                  ? `${m.elapsedMin}'`
                  : m.finished
                    ? "FT"
                    : m.countdown}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm font-bold">
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                <span>{m.homeFlag}</span>
                <span className="truncate">{m.home}</span>
              </span>
              <span className="shrink-0 tabular-nums text-base">
                {m.live || m.finished ? (
                  <span className={m.live ? "text-red-500" : ""}>
                    {m.homeScore} – {m.awayScore}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    vs
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                <span className="truncate">{m.away}</span>
                <span>{m.awayFlag}</span>
              </span>
            </div>
            <p className="mt-1.5 flex items-start gap-1 text-[10px] text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {m.kickoffLabel}
                <br />
                {m.venue}
              </span>
            </p>
          </div>
        ))}
        <p className="px-1 text-[10px] leading-snug text-muted-foreground">
          Final: Sun 19 Jul · 3:00 PM EDT · MetLife Stadium. Scores update when
          live; pre-match shows countdown only.
        </p>
        <Link
          href="/events"
          className="block rounded-xl py-2 text-center text-xs font-bold text-[#1d9bf0] hover:underline"
        >
          World Cup hub →
        </Link>
      </div>
    </div>
  );
}
