"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Loader2,
  Medal,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import type { FluxArcadeGame } from "@/data/flux-arcade-games";
import { getGameLeaderboard, submitGameScore, type GameLeaderboardEntry } from "@/services/game-leaderboards";
import {
  recordGameFinished,
  recordGameOpened,
  resultShareText,
  type ArcadeAchievement,
} from "@/lib/game-progress";
import { cn } from "@/lib/utils";

const LANES = [0, 1, 2] as const;
const PUZZLE_SYMBOLS = ["◆", "●", "▲", "■"];

type Phase = "ready" | "playing" | "ended";

function seeded(seed: number, step: number): number {
  const value = Math.sin(seed * 91.17 + step * 47.31) * 10000;
  return value - Math.floor(value);
}

function localBestKey(slug: string): string {
  return `flux-arcade-best-v1-${slug}`;
}

export function FluxArcadePlayer({ game }: { game: FluxArcadeGame }) {
  const { user, profile } = useAuth();
  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(game.roundSeconds);
  const [best, setBest] = useState(0);
  const [sound, setSound] = useState(true);
  const [leaderboard, setLeaderboard] = useState<GameLeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newAchievements, setNewAchievements] = useState<ArcadeAchievement[]>([]);

  const [jumping, setJumping] = useState(false);
  const [obstacle, setObstacle] = useState(100);
  const [lane, setLane] = useState(1);
  const [hazardLane, setHazardLane] = useState(0);
  const [income, setIncome] = useState(1);
  const [upgradeCost, setUpgradeCost] = useState(20);
  const [questStep, setQuestStep] = useState(0);
  const [puzzleStep, setPuzzleStep] = useState(0);
  const [puzzleTarget, setPuzzleTarget] = useState(0);
  const finishedRef = useRef(false);

  const difficultyLabel = ["", "Easy", "Normal", "Skilled", "Hard", "Extreme"][game.difficulty];

  const replaceScore = useCallback((value: number) => {
    const clean = Math.max(0, Math.floor(value));
    scoreRef.current = clean;
    setScore(clean);
    return clean;
  }, []);

  const addScore = useCallback((amount: number) => replaceScore(scoreRef.current + amount), [replaceScore]);

  const loadLeaderboard = useCallback(() => {
    setLeaderboardLoading(true);
    getGameLeaderboard(game.slug, 12)
      .then(setLeaderboard)
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));
  }, [game.slug]);

  useEffect(() => {
    recordGameOpened(game);
    try { setBest(Number(localStorage.getItem(localBestKey(game.slug)) || 0)); } catch { setBest(0); }
    loadLeaderboard();
  }, [game, loadLeaderboard]);

  const beep = useCallback((frequency = 520, duration = 0.055) => {
    if (!sound) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      oscillator.type = "sine";
      gain.gain.setValueAtTime(0.06, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
      oscillator.addEventListener("ended", () => void context.close(), { once: true });
    } catch {
      // Sound never blocks gameplay.
    }
  }, [sound]);

  const finish = useCallback(async (finalScore = scoreRef.current) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const clean = replaceScore(finalScore);
    setPhase("ended");
    setBest((current) => {
      const next = Math.max(current, clean);
      try { localStorage.setItem(localBestKey(game.slug), String(next)); } catch { /* private mode */ }
      return next;
    });

    const progressResult = recordGameFinished(game, clean);
    setNewAchievements(progressResult.unlocked);
    progressResult.unlocked.forEach((achievement) => toast.success(`${achievement.symbol} Achievement unlocked: ${achievement.title}`));
    beep(clean >= game.targetScore ? 880 : 180, 0.14);

    if (!user) return;
    setSubmitting(true);
    try {
      const result = await submitGameScore({
        gameId: game.slug,
        uid: user.uid,
        displayName: profile?.displayName,
        username: profile?.username,
        avatarUrl: profile?.avatarUrl,
        score: clean,
      });
      if (result.improved) toast.success("New global leaderboard best!");
      loadLeaderboard();
    } catch (error) {
      console.error(error);
      toast.error("Your score is saved on this device, but the global leaderboard could not update.");
    } finally {
      setSubmitting(false);
    }
  }, [beep, game, loadLeaderboard, profile, replaceScore, user]);

  const shareResult = useCallback(async () => {
    const text = resultShareText(game, scoreRef.current);
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: game.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}${url ? ` ${url}` : ""}`);
      toast.success("Result copied to clipboard");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this result");
    }
  }, [game]);

  const resetRound = useCallback(() => {
    finishedRef.current = false;
    replaceScore(0);
    setTimeLeft(game.roundSeconds);
    setJumping(false);
    setObstacle(100);
    setLane(1);
    setHazardLane(Math.floor(seeded(game.seed, 1) * 3));
    setIncome(1);
    setUpgradeCost(20);
    setQuestStep(0);
    setPuzzleStep(0);
    setPuzzleTarget(Math.floor(seeded(game.seed, 2) * PUZZLE_SYMBOLS.length));
    setNewAchievements([]);
    setPhase("playing");
    beep(440, 0.08);
  }, [beep, game.roundSeconds, game.seed, replaceScore]);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          queueMicrotask(() => void finish(scoreRef.current));
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finish, phase]);

  useEffect(() => {
    if (phase !== "playing" || game.mode !== "runner") return;
    const tick = window.setInterval(() => {
      setObstacle((current) => {
        const next = current - game.speed * 3.2;
        if (next <= 8) {
          if (!jumping) queueMicrotask(() => void finish(scoreRef.current));
          else {
            addScore(12 + game.difficulty * 2);
            beep(650);
          }
          return 100;
        }
        return next;
      });
      addScore(1);
    }, 90);
    return () => window.clearInterval(tick);
  }, [addScore, beep, finish, game.difficulty, game.mode, game.speed, jumping, phase]);

  useEffect(() => {
    if (phase !== "playing" || game.mode !== "survival") return;
    let wave = 0;
    const tick = window.setInterval(() => {
      wave += 1;
      const nextLane = Math.floor(seeded(game.seed, wave + scoreRef.current) * 3);
      setHazardLane(nextLane);
      if (nextLane === lane) queueMicrotask(() => void finish(scoreRef.current));
      else {
        addScore(8 + game.difficulty * 3);
        beep(360 + nextLane * 90);
      }
    }, Math.max(430, 1080 - game.difficulty * 90));
    return () => window.clearInterval(tick);
  }, [addScore, beep, finish, game.difficulty, game.mode, game.seed, lane, phase]);

  const jump = useCallback(() => {
    if (phase !== "playing" || game.mode !== "runner" || jumping) return;
    setJumping(true);
    beep(720);
    window.setTimeout(() => setJumping(false), 560);
  }, [beep, game.mode, jumping, phase]);

  const moveLane = useCallback((direction: -1 | 1) => {
    if (phase !== "playing" || game.mode !== "survival") return;
    setLane((current) => Math.max(0, Math.min(2, current + direction)));
    beep(420, 0.035);
  }, [beep, game.mode, phase]);

  const collect = useCallback(() => {
    if (phase !== "playing" || game.mode !== "tycoon") return;
    addScore(income);
    beep(560 + Math.min(300, income * 8), 0.035);
  }, [addScore, beep, game.mode, income, phase]);

  const upgrade = useCallback(() => {
    if (phase !== "playing" || game.mode !== "tycoon" || scoreRef.current < upgradeCost) return;
    replaceScore(scoreRef.current - upgradeCost);
    setIncome((current) => current + 1 + Math.floor(game.difficulty / 2));
    setUpgradeCost((current) => Math.ceil(current * 1.7));
    beep(920, 0.1);
  }, [beep, game.difficulty, game.mode, phase, replaceScore, upgradeCost]);

  const answerQuest = useCallback((choice: number) => {
    if (phase !== "playing" || game.mode !== "quest") return;
    const correct = Math.floor(seeded(game.seed, questStep + 20) * 3);
    const nextScore = addScore(choice === correct ? 120 : 35);
    beep(choice === correct ? 820 : 230, 0.09);
    if (questStep >= 9) void finish(nextScore);
    else setQuestStep((current) => current + 1);
  }, [addScore, beep, finish, game.mode, game.seed, phase, questStep]);

  const answerPuzzle = useCallback((choice: number) => {
    if (phase !== "playing" || game.mode !== "puzzle") return;
    if (choice !== puzzleTarget) {
      void finish(scoreRef.current);
      return;
    }
    const nextStep = puzzleStep + 1;
    const nextScore = addScore(100 + nextStep * 15);
    setPuzzleStep(nextStep);
    setPuzzleTarget(Math.floor(seeded(game.seed, nextStep + 3) * PUZZLE_SYMBOLS.length));
    beep(760 + nextStep * 12);
    if (nextStep >= 11) void finish(nextScore);
  }, [addScore, beep, finish, game.mode, game.seed, phase, puzzleStep, puzzleTarget]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        if (game.mode === "runner") jump();
        if (game.mode === "tycoon") collect();
      }
      if (event.code === "ArrowLeft") moveLane(-1);
      if (event.code === "ArrowRight") moveLane(1);
      if (/^Digit[1-4]$/.test(event.code)) {
        const choice = Number(event.code.slice(-1)) - 1;
        if (game.mode === "quest") answerQuest(Math.min(2, choice));
        if (game.mode === "puzzle") answerPuzzle(choice);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answerPuzzle, answerQuest, collect, game.mode, jump, moveLane]);

  const progress = Math.min(100, (score / Math.max(1, game.targetScore)) * 100);

  return (
    <main className="flux-arcade-page min-h-[100dvh] bg-[#05070b] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070b]/88 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-3 px-3 sm:px-5">
          <Link href="/games" className="grid h-11 w-11 place-items-center rounded-full bg-white/8 transition hover:bg-white/14 active:scale-90" aria-label="Back to Games"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="min-w-0 flex-1"><h1 className="truncate text-base font-black">{game.title}</h1><p className="truncate text-[11px] text-white/42">{game.genre} · {difficultyLabel} · Flux Arcade</p></div>
          <button type="button" onClick={() => setSound((current) => !current)} className="grid h-11 w-11 place-items-center rounded-full bg-white/8" aria-label={sound ? "Mute game" : "Unmute game"}>{sound ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-5 p-3 pb-[calc(96px+env(safe-area-inset-bottom))] sm:p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0b0f16] shadow-2xl">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3 text-xs font-bold text-white/55">
              <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-amber-300" />{score.toLocaleString()}</span>
              <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-sky-300" />{timeLeft}s</span>
              <span className="ml-auto">Best {best.toLocaleString()}</span>
            </div>
            <div className="h-1 bg-white/6"><div className="h-full bg-gradient-to-r from-sky-400 to-violet-400 transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>

            <div className="relative min-h-[430px] overflow-hidden sm:min-h-[560px]" style={{ background: `radial-gradient(circle at 70% 10%, ${game.palette[2]}40, transparent 35%), linear-gradient(145deg, ${game.palette[0]}, ${game.palette[1]} 68%, ${game.palette[2]})` }}>
              <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
              <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] backdrop-blur">{game.symbol} {game.genre}</div>
              {phase === "ready" ? <ReadyOverlay game={game} onStart={resetRound} /> : null}
              {phase === "ended" ? <EndOverlay game={game} score={score} best={best} submitting={submitting} achievements={newAchievements} onRestart={resetRound} onShare={() => void shareResult()} /> : null}
              {phase === "playing" ? (
                <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-8">
                  {game.mode === "runner" ? <RunnerStage jumping={jumping} obstacle={obstacle} symbol={game.symbol} onJump={jump} /> : null}
                  {game.mode === "survival" ? <SurvivalStage lane={lane} hazardLane={hazardLane} symbol={game.symbol} onMove={moveLane} /> : null}
                  {game.mode === "tycoon" ? <TycoonStage score={score} income={income} upgradeCost={upgradeCost} symbol={game.symbol} onCollect={collect} onUpgrade={upgrade} /> : null}
                  {game.mode === "quest" ? <QuestStage game={game} step={questStep} onAnswer={answerQuest} /> : null}
                  {game.mode === "puzzle" ? <PuzzleStage game={game} step={puzzleStep} target={puzzleTarget} onAnswer={answerPuzzle} /> : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 rounded-[24px] border border-white/8 bg-white/[.035] p-4">
            <h2 className="font-black">How to play</h2>
            <p className="mt-2 text-sm leading-6 text-white/50">{game.description}</p>
            <p className="mt-3 text-xs font-bold text-white/35">Touch, mouse and keyboard are supported. Reach {game.targetScore.toLocaleString()} points to beat the target.</p>
          </div>
        </section>

        <aside className="h-fit overflow-hidden rounded-[26px] border border-white/10 bg-[#0b0f16] lg:sticky lg:top-20">
          <div className="flex items-center gap-3 border-b border-white/8 p-4"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-400/12 text-amber-300"><Crown className="h-5 w-5" /></span><div><h2 className="font-black">Global leaderboard</h2><p className="text-[11px] text-white/38">Best score per Flux account</p></div><button onClick={loadLeaderboard} className="ml-auto grid h-9 w-9 place-items-center rounded-full hover:bg-white/8" aria-label="Refresh leaderboard"><RefreshCw className="h-4 w-4" /></button></div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {leaderboardLoading ? <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-white/35" /></div> : leaderboard.length ? leaderboard.map((entry, index) => <LeaderboardRow key={entry.uid} entry={entry} rank={index + 1} current={entry.uid === user?.uid} />) : <div className="grid min-h-44 place-items-center px-6 text-center"><div><Medal className="mx-auto h-7 w-7 text-white/20" /><p className="mt-3 text-sm font-black text-white/55">No scores yet</p><p className="mt-1 text-xs leading-5 text-white/30">Finish a round to claim first place.</p></div></div>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function ReadyOverlay({ game, onStart }: { game: FluxArcadeGame; onStart: () => void }) {
  return <div className="absolute inset-0 z-10 grid place-items-center bg-black/26 p-6 text-center backdrop-blur-[2px]"><div className="max-w-lg"><span className="mx-auto grid h-24 w-24 place-items-center rounded-[32px] border border-white/15 bg-white/10 text-5xl shadow-2xl backdrop-blur-xl">{game.symbol}</span><p className="mt-6 text-[11px] font-black uppercase tracking-[.2em] text-white/50">Flux Arcade original</p><h2 className="mt-2 text-4xl font-black tracking-[-.055em] sm:text-6xl">{game.title}</h2><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-white/58">{game.shortDescription}</p><button onClick={onStart} className="mx-auto mt-7 flex h-14 items-center gap-2 rounded-full bg-white px-8 text-sm font-black text-black shadow-xl transition hover:scale-[1.02] active:scale-95"><Play className="h-5 w-5 fill-current" />Start round</button></div></div>;
}

function EndOverlay({ game, score, best, submitting, achievements, onRestart, onShare }: { game: FluxArcadeGame; score: number; best: number; submitting: boolean; achievements: ArcadeAchievement[]; onRestart: () => void; onShare: () => void }) {
  const won = score >= game.targetScore;
  return <div className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-black/64 p-6 text-center backdrop-blur-md"><div className="max-w-lg py-6"><span className={cn("mx-auto grid h-20 w-20 place-items-center rounded-[28px] text-4xl", won ? "bg-emerald-400/18" : "bg-white/10")}>{won ? "🏆" : game.symbol}</span><p className="mt-5 text-[11px] font-black uppercase tracking-[.2em] text-white/45">{won ? "Target cleared" : "Round complete"}</p><h2 className="mt-2 text-5xl font-black tracking-[-.06em]">{score.toLocaleString()}</h2><p className="mt-2 text-sm text-white/48">Personal best {best.toLocaleString()}{submitting ? " · syncing leaderboard…" : ""}</p>{achievements.length ? <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-left"><p className="flex items-center gap-2 text-xs font-black text-amber-200"><Award className="h-4 w-4" />New achievement{achievements.length > 1 ? "s" : ""}</p>{achievements.map((achievement) => <p key={achievement.id} className="mt-2 text-xs text-white/70">{achievement.symbol} <strong>{achievement.title}</strong> — {achievement.description}</p>)}</div> : null}<div className="mt-7 flex flex-wrap justify-center gap-3"><button onClick={onRestart} className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition active:scale-95"><RefreshCw className="h-4 w-4" />Play again</button><button onClick={onShare} className="flex h-12 items-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 text-sm font-black text-white transition hover:bg-white/16 active:scale-95"><Share2 className="h-4 w-4" />Share result</button></div></div></div>;
}

function RunnerStage({ jumping, obstacle, symbol, onJump }: { jumping: boolean; obstacle: number; symbol: string; onJump: () => void }) {
  return <button type="button" onClick={onJump} className="relative h-[310px] w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/12 bg-black/22 text-left backdrop-blur-sm" aria-label="Jump"><div className="absolute inset-x-0 bottom-16 h-1 bg-white/30" /><span className="absolute bottom-[68px] left-[12%] text-5xl transition-transform duration-200" style={{ transform: jumping ? "translateY(-115px) rotate(-12deg)" : "translateY(0)" }}>{symbol}</span><span className="absolute bottom-[68px] text-5xl" style={{ left: `${obstacle}%`, transform: "translateX(-50%)" }}>🚧</span><span className="absolute inset-x-0 bottom-4 text-center text-xs font-black uppercase tracking-[.18em] text-white/45">Tap anywhere or press Space to jump</span></button>;
}

function SurvivalStage({ lane, hazardLane, symbol, onMove }: { lane: number; hazardLane: number; symbol: string; onMove: (direction: -1 | 1) => void }) {
  return <div className="w-full max-w-xl"><div className="grid h-[330px] grid-cols-3 overflow-hidden rounded-[28px] border border-white/12 bg-black/22 backdrop-blur-sm">{LANES.map((item) => <div key={item} className="relative border-r border-white/8 last:border-r-0"><span className={cn("absolute left-1/2 top-12 -translate-x-1/2 text-5xl transition", hazardLane === item ? "translate-y-40 opacity-100" : "opacity-15")}>☄️</span>{lane === item ? <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-5xl">{symbol}</span> : null}</div>)}</div><div className="mt-4 grid grid-cols-2 gap-3"><button onClick={() => onMove(-1)} className="flex h-14 items-center justify-center rounded-2xl bg-white/12 text-white active:scale-95"><ChevronLeft className="h-7 w-7" /></button><button onClick={() => onMove(1)} className="flex h-14 items-center justify-center rounded-2xl bg-white/12 text-white active:scale-95"><ChevronRight className="h-7 w-7" /></button></div></div>;
}

function TycoonStage({ score, income, upgradeCost, symbol, onCollect, onUpgrade }: { score: number; income: number; upgradeCost: number; symbol: string; onCollect: () => void; onUpgrade: () => void }) {
  return <div className="w-full max-w-xl text-center"><button onClick={onCollect} className="mx-auto grid h-48 w-48 place-items-center rounded-[54px] border border-white/15 bg-white/12 text-7xl shadow-2xl transition hover:scale-[1.03] active:scale-90">{symbol}</button><p className="mt-5 text-sm font-black">Tap to earn +{income}</p><button onClick={onUpgrade} disabled={score < upgradeCost} className="mt-5 h-12 rounded-full bg-white px-6 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-35"><Sparkles className="mr-2 inline h-4 w-4" />Upgrade income · {upgradeCost}</button></div>;
}

function QuestStage({ game, step, onAnswer }: { game: FluxArcadeGame; step: number; onAnswer: (choice: number) => void }) {
  const prompts = ["A locked gate blocks the route.", "A stranger offers a shortcut.", "The signal disappears.", "You find an abandoned supply crate.", "A storm reaches the valley.", "The map splits into three paths.", "A rival asks for help.", "The final beacon is unstable.", "The exit begins to close.", "One last decision remains."];
  const choices = [["Study it", "Force it", "Go around"], ["Trust them", "Ask questions", "Decline"], ["Climb higher", "Wait", "Follow tracks"]];
  return <div className="w-full max-w-2xl rounded-[28px] border border-white/12 bg-black/28 p-6 text-center backdrop-blur-md"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Chapter {step + 1} of 10</p><div className="mt-5 text-6xl">{game.symbol}</div><h3 className="mt-5 text-2xl font-black tracking-tight">{prompts[step] || prompts[0]}</h3><div className="mt-6 grid gap-3 sm:grid-cols-3">{choices[step % choices.length].map((choice, index) => <button key={choice} onClick={() => onAnswer(index)} className="min-h-14 rounded-2xl border border-white/12 bg-white/9 px-4 text-sm font-black transition hover:bg-white/16 active:scale-95">{index + 1}. {choice}</button>)}</div></div>;
}

function PuzzleStage({ game, step, target, onAnswer }: { game: FluxArcadeGame; step: number; target: number; onAnswer: (choice: number) => void }) {
  const hint = useMemo(() => PUZZLE_SYMBOLS[target], [target]);
  return <div className="w-full max-w-xl text-center"><p className="text-[10px] font-black uppercase tracking-[.18em] text-white/45">Pattern {step + 1}</p><div className="mx-auto mt-5 grid h-32 w-32 place-items-center rounded-[38px] border border-white/15 bg-black/25 text-7xl shadow-2xl">{hint}</div><p className="mt-5 text-sm font-bold text-white/55">Tap the matching symbol before the timer ends.</p><div className="mt-6 grid grid-cols-4 gap-3">{PUZZLE_SYMBOLS.map((symbol, index) => <button key={symbol} onClick={() => onAnswer(index)} className="grid aspect-square place-items-center rounded-2xl bg-white/12 text-3xl transition hover:bg-white/20 active:scale-90">{symbol}</button>)}</div><p className="mt-5 text-xs text-white/30">{game.title} gets faster as your score grows.</p></div>;
}

function LeaderboardRow({ entry, rank, current }: { entry: GameLeaderboardEntry; rank: number; current: boolean }) {
  return <div className={cn("flex items-center gap-3 rounded-2xl px-3 py-3", current ? "bg-sky-400/12" : "hover:bg-white/[.045]")}><span className={cn("grid h-8 w-8 place-items-center rounded-full text-xs font-black", rank === 1 ? "bg-amber-300 text-black" : rank === 2 ? "bg-slate-300 text-black" : rank === 3 ? "bg-orange-400 text-black" : "bg-white/7 text-white/45")}>{rank}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{entry.displayName}</p><p className="truncate text-[10px] text-white/35">@{entry.username} · {entry.plays} plays</p></div><strong className="text-sm tabular-nums">{entry.score.toLocaleString()}</strong></div>;
}
