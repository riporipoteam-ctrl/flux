export interface DefaultAvatar {
  id: string;
  name: string;
  src: string;
  accent: string;
}

/** Local Imagine-generated Duolingo-style presets only (no external URLs) */
export const DEFAULT_AVATARS: DefaultAvatar[] = [
  { id: "fox", name: "Violet Fox", src: "/avatars/fox.png", accent: "#8b5cf6" },
  { id: "owl", name: "Mint Owl", src: "/avatars/owl.png", accent: "#34d399" },
  { id: "cat", name: "Peach Cat", src: "/avatars/cat.png", accent: "#fb923c" },
  { id: "bunny", name: "Sky Bunny", src: "/avatars/bunny.png", accent: "#60a5fa" },
  { id: "chick", name: "Sunny Chick", src: "/avatars/chick.png", accent: "#fbbf24" },
  { id: "panda", name: "Pink Panda", src: "/avatars/panda.png", accent: "#f472b6" },
  { id: "dolphin", name: "Aqua Dolphin", src: "/avatars/dolphin.png", accent: "#2dd4bf" },
  { id: "bear", name: "Lavender Bear", src: "/avatars/bear.png", accent: "#a78bfa" },
  { id: "frog", name: "Lime Frog", src: "/avatars/frog.png", accent: "#84cc16" },
  { id: "lion", name: "Golden Lion", src: "/avatars/lion.png", accent: "#f59e0b" },
  { id: "penguin", name: "Cool Penguin", src: "/avatars/penguin.png", accent: "#38bdf8" },
  { id: "robot", name: "Friendly Bot", src: "/avatars/robot.png", accent: "#94a3b8" },
  { id: "dragon", name: "Tiny Dragon", src: "/avatars/dragon.png", accent: "#f43f5e" },
];

export const PROFILE_ACCENTS = [
  { id: "black", label: "Black", color: "#0f1419" },
  { id: "sky", label: "Sky", color: "#1d9bf0" },
  { id: "rose", label: "Rose", color: "#f43f5e" },
  { id: "orange", label: "Orange", color: "#f97316" },
  { id: "amber", label: "Amber", color: "#f59e0b" },
  { id: "emerald", label: "Emerald", color: "#10b981" },
  { id: "indigo", label: "Indigo", color: "#6366f1" },
  { id: "slate", label: "Slate", color: "#64748b" },
] as const;

export const MOOD_OPTIONS = [
  { id: "none", emoji: "", label: "None" },
  { id: "fire", emoji: "🔥", label: "On fire" },
  { id: "focus", emoji: "🎯", label: "Focused" },
  { id: "chill", emoji: "😌", label: "Chill" },
  { id: "create", emoji: "✨", label: "Creating" },
  { id: "learn", emoji: "📚", label: "Learning" },
  { id: "travel", emoji: "✈️", label: "Traveling" },
  { id: "music", emoji: "🎵", label: "Vibing" },
  { id: "coffee", emoji: "☕", label: "Caffeinated" },
  { id: "game", emoji: "🎮", label: "Gaming" },
] as const;
