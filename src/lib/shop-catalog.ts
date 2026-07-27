/** Shared shop catalog metadata — images live in /public/shop */

export type ShopItemType =
  | "badge"
  | "frame"
  | "banner"
  | "theme"
  | "group_deco"
  | "effect";

export type ShopRarity = "common" | "rare" | "epic" | "legendary";

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  type: ShopItemType;
  price: number;
  previewUrl: string;
  imageUrl: string;
  rarity: ShopRarity;
  active: boolean;
  /** Optional CSS ring / glow for frames */
  frameStyle?: string;
  /** Optional badge emoji for name flair */
  badgeEmoji?: string;
}

export const SHOP_CATALOG: CatalogItem[] = [
  {
    id: "gold-flux-badge",
    name: "Gold Flux Badge",
    description: "Premium gold check for your name.",
    type: "badge",
    price: 200,
    previewUrl: "🏆",
    imageUrl: "/shop/badge-gold.png",
    rarity: "legendary",
    active: true,
    badgeEmoji: "🏆",
  },
  {
    id: "sky-verified-style",
    name: "Sky Verified Style",
    description: "Soft sky-blue flair badge.",
    type: "badge",
    price: 120,
    previewUrl: "✔️",
    imageUrl: "/shop/badge-sky.png",
    rarity: "rare",
    active: true,
    badgeEmoji: "💙",
  },
  {
    id: "neon-avatar-frame",
    name: "Neon Avatar Frame",
    description: "Electric cyan frame around your photo.",
    type: "frame",
    price: 150,
    previewUrl: "💠",
    imageUrl: "/shop/frame-neon.png",
    rarity: "epic",
    active: true,
    frameStyle: "ring-2 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.65)]",
  },
  {
    id: "world-cup-2026-frame",
    name: "World Cup 2026 Frame",
    description: "Celebrate the tournament around your avatar.",
    type: "frame",
    price: 260,
    previewUrl: "⚽",
    imageUrl: "/shop/frame-worldcup.png",
    rarity: "legendary",
    active: false,
    frameStyle:
      "ring-2 ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.55)]",
  },
  {
    id: "rose-gold-frame",
    name: "Rose Gold Frame",
    description: "Warm metallic rim for your avatar.",
    type: "frame",
    price: 175,
    previewUrl: "🌹",
    imageUrl: "/shop/frame-rosegold.png",
    rarity: "epic",
    active: true,
    frameStyle:
      "ring-2 ring-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.5)]",
  },
  {
    id: "pixel-frame",
    name: "Pixel Frame",
    description: "8-bit border for retro vibes.",
    type: "frame",
    price: 95,
    previewUrl: "👾",
    imageUrl: "/shop/frame-pixel.png",
    rarity: "rare",
    active: true,
    frameStyle: "ring-2 ring-lime-400 ring-offset-2 ring-offset-background",
  },
  {
    id: "sunset-glow-banner",
    name: "Sunset Glow Banner",
    description: "Warm gradient overlay for your header.",
    type: "banner",
    price: 90,
    previewUrl: "🌅",
    imageUrl: "/shop/banner-sunset.png",
    rarity: "common",
    active: true,
  },
  {
    id: "stadium-lights-banner",
    name: "Stadium Lights Banner",
    description: "Night match atmosphere for your profile header.",
    type: "banner",
    price: 140,
    previewUrl: "🏟️",
    imageUrl: "/shop/banner-stadium.png",
    rarity: "rare",
    active: true,
  },
  {
    id: "aurora-banner",
    name: "Aurora Night Banner",
    description: "Northern lights wash for your profile header.",
    type: "banner",
    price: 160,
    previewUrl: "🌌",
    imageUrl: "/shop/banner-aurora.png",
    rarity: "epic",
    active: true,
  },
  {
    id: "midnight-card-theme",
    name: "Midnight Card Theme",
    description: "Sleek dark profile card accents.",
    type: "theme",
    price: 180,
    previewUrl: "🌑",
    imageUrl: "/shop/theme-midnight.png",
    rarity: "epic",
    active: true,
  },
  {
    id: "ocean-theme",
    name: "Ocean Depth Theme",
    description: "Deep blue accents for posts and profile.",
    type: "theme",
    price: 150,
    previewUrl: "🌊",
    imageUrl: "/shop/theme-ocean.png",
    rarity: "rare",
    active: true,
  },
  {
    id: "group-star-deco",
    name: "Group Star Deco",
    description: "Sparkle decoration for groups.",
    type: "group_deco",
    price: 110,
    previewUrl: "⭐",
    imageUrl: "/shop/group-star.png",
    rarity: "rare",
    active: true,
  },
  {
    id: "sparkle-effect",
    name: "Name Sparkles",
    description: "Subtle sparkle effect next to your display name.",
    type: "effect",
    price: 80,
    previewUrl: "✨",
    imageUrl: "/shop/effect-sparkle.png",
    rarity: "common",
    active: true,
    badgeEmoji: "✨",
  },
  {
    id: "fire-effect",
    name: "On Fire Trail",
    description: "Hot streak flair for active posters.",
    type: "effect",
    price: 130,
    previewUrl: "🔥",
    imageUrl: "/shop/effect-fire.png",
    rarity: "rare",
    active: true,
    badgeEmoji: "🔥",
  },
];

export function getCatalogItem(id: string | undefined | null) {
  if (!id) return undefined;
  return SHOP_CATALOG.find((i) => i.id === id);
}

export function frameClassForDecoration(frameId?: string | null) {
  return getCatalogItem(frameId)?.frameStyle || "";
}

export function flairForDecoration(badgeId?: string | null) {
  const item = getCatalogItem(badgeId);
  if (!item) return null;
  return { emoji: item.badgeEmoji || item.previewUrl, label: item.name };
}
