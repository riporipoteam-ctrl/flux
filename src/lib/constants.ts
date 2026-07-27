export const APP_NAME = "Flux";
export const APP_TEAM = "Ripo Team";
export const APP_TAGLINE = "Built by Ripo Team";
export const ASKAI_NAME = "AskAI";
export const ASKAI_BYLINE = "AskAI by Ripo Team";
export const MAX_POST_LENGTH = 500;
export const MAX_BIO_LENGTH = 160;
export const MAX_IMAGES_PER_POST = 4;

export const INTERESTS = [
  "Technology",
  "Gaming",
  "Music",
  "Sports",
  "Art & Design",
  "Science",
  "Business",
  "Fashion",
  "Movies & TV",
  "Food",
  "Travel",
  "Fitness",
  "Politics",
  "Crypto",
  "Photography",
  "Memes",
] as const;

export const COIN_REWARDS = {
  post: 5,
  likeReceived: 1,
  repostReceived: 2,
  dailyChallenge: 25,
  welcomeBonus: 50,
} as const;

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "Home" },
  { href: "/explore", label: "Explore", icon: "Search" },
  { href: "/notifications", label: "Notifications", icon: "Bell" },
  { href: "/messages", label: "Messages", icon: "Mail" },
  { href: "/groups", label: "Groups", icon: "Users" },
  { href: "/events", label: "Events", icon: "Calendar" },
  { href: "/game", label: "Game", icon: "Gamepad2" },
  { href: "/shop", label: "Shop", icon: "ShoppingBag" },
  { href: "/ask-ai", label: "AskAI", icon: "Sparkles" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
