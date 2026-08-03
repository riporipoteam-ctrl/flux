import type { BrowserGame } from "@/data/browser-games";
import type { FluxArcadeGame } from "@/data/flux-arcade-games";

const STORAGE_KEY = "flux-arcade-progress-v2";
const MAX_RECENT = 12;

export type ArcadeAchievementId =
  | "first-round"
  | "target-cleared"
  | "five-genres"
  | "ten-rounds"
  | "score-1000"
  | "three-day-streak";

export interface ArcadeAchievement {
  id: ArcadeAchievementId;
  title: string;
  description: string;
  symbol: string;
}

export const ARCADE_ACHIEVEMENTS: ArcadeAchievement[] = [
  { id: "first-round", title: "First round", description: "Finish any Flux Arcade game.", symbol: "🎮" },
  { id: "target-cleared", title: "Target cleared", description: "Beat a game's target score.", symbol: "🏆" },
  { id: "five-genres", title: "Genre explorer", description: "Play five different game genres.", symbol: "🧭" },
  { id: "ten-rounds", title: "Arcade regular", description: "Finish ten Arcade rounds.", symbol: "🕹️" },
  { id: "score-1000", title: "Four digits", description: "Score at least 1,000 points in one round.", symbol: "💯" },
  { id: "three-day-streak", title: "On a roll", description: "Play Flux Arcade three days in a row.", symbol: "🔥" },
];

export interface RecentGameRecord {
  slug: string;
  title: string;
  genre: string;
  playedAt: number;
  best: number;
  rounds: number;
  wins: number;
}

export interface ArcadeProgress {
  recent: RecentGameRecord[];
  totalRounds: number;
  totalWins: number;
  genres: string[];
  achievements: ArcadeAchievementId[];
  streak: number;
  lastPlayedDay: string;
}

const EMPTY_PROGRESS: ArcadeProgress = {
  recent: [],
  totalRounds: 0,
  totalWins: 0,
  genres: [],
  achievements: [],
  streak: 0,
  lastPlayedDay: "",
};

function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function yesterdayKey(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

export function readArcadeProgress(): ArcadeProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<ArcadeProgress> | null;
    if (!parsed) return { ...EMPTY_PROGRESS };
    return {
      recent: Array.isArray(parsed.recent) ? parsed.recent.slice(0, MAX_RECENT) : [],
      totalRounds: Math.max(0, Number(parsed.totalRounds || 0)),
      totalWins: Math.max(0, Number(parsed.totalWins || 0)),
      genres: Array.isArray(parsed.genres) ? parsed.genres.map(String).slice(0, 30) : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements as ArcadeAchievementId[] : [],
      streak: Math.max(0, Number(parsed.streak || 0)),
      lastPlayedDay: String(parsed.lastPlayedDay || ""),
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

function writeArcadeProgress(progress: ArcadeProgress): ArcadeProgress {
  if (typeof window !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* private mode */ }
    window.dispatchEvent(new CustomEvent("flux:arcade-progress", { detail: progress }));
  }
  return progress;
}

function unlock(progress: ArcadeProgress, id: ArcadeAchievementId, condition: boolean): void {
  if (condition && !progress.achievements.includes(id)) progress.achievements.push(id);
}

function updateStreak(progress: ArcadeProgress): void {
  const today = dayKey();
  if (progress.lastPlayedDay === today) return;
  progress.streak = progress.lastPlayedDay === yesterdayKey() ? progress.streak + 1 : 1;
  progress.lastPlayedDay = today;
}

export function recordGameOpened(game: Pick<FluxArcadeGame, "slug" | "title" | "genre">): ArcadeProgress {
  const progress = readArcadeProgress();
  updateStreak(progress);
  const previous = progress.recent.find((entry) => entry.slug === game.slug);
  const next: RecentGameRecord = {
    slug: game.slug,
    title: game.title,
    genre: game.genre,
    playedAt: Date.now(),
    best: previous?.best || 0,
    rounds: previous?.rounds || 0,
    wins: previous?.wins || 0,
  };
  progress.recent = [next, ...progress.recent.filter((entry) => entry.slug !== game.slug)].slice(0, MAX_RECENT);
  if (!progress.genres.includes(game.genre)) progress.genres.push(game.genre);
  unlock(progress, "five-genres", progress.genres.length >= 5);
  unlock(progress, "three-day-streak", progress.streak >= 3);
  return writeArcadeProgress(progress);
}

export function recordGameFinished(
  game: Pick<FluxArcadeGame, "slug" | "title" | "genre" | "targetScore">,
  score: number
): { progress: ArcadeProgress; unlocked: ArcadeAchievement[] } {
  const before = readArcadeProgress();
  const beforeIds = new Set(before.achievements);
  const clean = Math.max(0, Math.floor(Number(score) || 0));
  updateStreak(before);
  before.totalRounds += 1;
  const won = clean >= game.targetScore;
  if (won) before.totalWins += 1;
  if (!before.genres.includes(game.genre)) before.genres.push(game.genre);
  const previous = before.recent.find((entry) => entry.slug === game.slug);
  const next: RecentGameRecord = {
    slug: game.slug,
    title: game.title,
    genre: game.genre,
    playedAt: Date.now(),
    best: Math.max(previous?.best || 0, clean),
    rounds: (previous?.rounds || 0) + 1,
    wins: (previous?.wins || 0) + (won ? 1 : 0),
  };
  before.recent = [next, ...before.recent.filter((entry) => entry.slug !== game.slug)].slice(0, MAX_RECENT);

  unlock(before, "first-round", before.totalRounds >= 1);
  unlock(before, "target-cleared", won);
  unlock(before, "five-genres", before.genres.length >= 5);
  unlock(before, "ten-rounds", before.totalRounds >= 10);
  unlock(before, "score-1000", clean >= 1000);
  unlock(before, "three-day-streak", before.streak >= 3);

  const progress = writeArcadeProgress(before);
  const unlocked = ARCADE_ACHIEVEMENTS.filter((achievement) => progress.achievements.includes(achievement.id) && !beforeIds.has(achievement.id));
  return { progress, unlocked };
}

export function dailyChallengeGame(games: BrowserGame[], date = new Date()): BrowserGame | undefined {
  const arcade = games.filter((game) => game.arcade);
  if (!arcade.length) return undefined;
  const key = Number(dayKey(date).replaceAll("-", ""));
  const index = Math.abs(Math.imul(key, 2654435761)) % arcade.length;
  return arcade[index];
}

export function recentBrowserGames(games: BrowserGame[], take = 6): BrowserGame[] {
  const bySlug = new Map(games.map((game) => [game.slug, game]));
  return readArcadeProgress().recent
    .map((entry) => bySlug.get(entry.slug))
    .filter((game): game is BrowserGame => Boolean(game))
    .slice(0, Math.max(1, take));
}

export function resultShareText(game: Pick<FluxArcadeGame, "title" | "targetScore">, score: number): string {
  const won = score >= game.targetScore;
  return `${won ? "🏆" : "🎮"} I scored ${Math.floor(score).toLocaleString()} in ${game.title} on Flux Arcade${won ? " and cleared the target!" : "!"}`;
}
