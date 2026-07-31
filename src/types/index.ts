import type { Timestamp } from "firebase/firestore";

export type ThemeMode = "light" | "dark" | "system";
export type VerifiedType = "flux" | "business" | "government" | null;
export type AccountType = "personal" | "business";
export type PostType = "post" | "reply" | "quote" | "repost";
export type MediaType = "image" | "video" | "gif";
export type Visibility = "public" | "followers" | "group";
export type ModerationStatus = "active" | "warned" | "timeout" | "banned";
export type FluxPlanTier = "free" | "basic" | "premium";

export interface AskAIUsage {
  used: number;
  limit: number;
  resetAt: Timestamp | Date | null;
}

export interface FluxAgent {
  id: string;
  name: string;
  instructions: string;
  status: "idle" | "working" | "paused";
  currentTask?: string | null;
  createdAt: number;
}

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  x?: string;
  website?: string;
}

export interface UserDecorations {
  badgeId?: string;
  themeId?: string;
  frameId?: string;
  bannerDecorationId?: string;
}

export interface UserSettings {
  theme: ThemeMode;
  language: string;
  notifications: {
    likes: boolean;
    replies: boolean;
    follows: boolean;
    mentions: boolean;
    messages: boolean;
  };
  privacy: {
    dmFrom: "everyone" | "following" | "none";
    showActivity: boolean;
  };
}

export interface OwnedShopItem {
  itemId: string;
  acquiredAt?: unknown;
  source?: "purchase" | "gift" | "admin";
}

export interface CustomBadge {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  website: string | null;
  socialLinks: SocialLinks;
  location: string | null;
  birthDate: string | null;
  interests: string[];
  isVerified: boolean;
  verifiedType: VerifiedType;
  isAdmin: boolean;
  isOwner?: boolean;
  isPrivate: boolean;
  onboardingComplete: boolean;
  accountType: AccountType;
  businessName?: string | null;
  coins: number;
  planTier: FluxPlanTier;
  planExpiresAt: Timestamp | Date | null;
  askAIUsage: AskAIUsage;
  aiAgents: FluxAgent[];
  lastRewardClaimKey: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  likesCount: number;
  pinnedPostId: string | null;
  decorations: UserDecorations;
  ownedItemIds: string[];
  customBadgeIds: string[];
  mutedUserIds: string[];
  /** e.g. fire, chill — emoji status */
  mood: string | null;
  /** hex accent color for profile */
  profileAccent: string | null;
  moderationStatus: ModerationStatus;
  timeoutUntil: Timestamp | null;
  warnCount: number;
  /** Owner link group for multi-account switcher */
  accountLinkId: string | null;
  linkedUids: string[];
  settings: UserSettings;
  /** Live game presence (Rec Room / Flux Game hub) */
  gameActivity?: {
    gameId: string;
    gameName: string;
    status: "playing" | "lobby" | "ended";
    roomCode?: string | null;
    since?: Timestamp | null;
  } | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  lastActiveAt: Timestamp | null;
}

export interface MediaItem {
  type: MediaType;
  url: string;
  width?: number;
  height?: number;
  thumbUrl?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  options: PollOption[];
  endsAt: Timestamp | null;
}

export interface Post {
  id: string;
  authorId: string;
  text: string;
  media: MediaItem[];
  poll: Poll | null;
  type: PostType;
  parentId: string | null;
  rootId: string | null;
  quoteOfId: string | null;
  repostOfId: string | null;
  threadId: string | null;
  threadOrder: number | null;
  hashtags: string[];
  mentions: string[];
  groupId: string | null;
  eventId: string | null;
  visibility: Visibility;
  likesCount: number;
  repliesCount: number;
  repostsCount: number;
  quotesCount: number;
  bookmarksCount: number;
  viewsCount: number;
  isPinnedToProfile: boolean;
  scheduledFor: Timestamp | null;
  isDraft: boolean;
  isDeleted: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PostWithAuthor extends Post {
  author?: UserProfile | null;
  likedByMe?: boolean;
  bookmarkedByMe?: boolean;
  repostedByMe?: boolean;
  quotedPost?: PostWithAuthor | null;
}

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  type:
    | "like"
    | "reply"
    | "repost"
    | "quote"
    | "follow"
    | "mention"
    | "gift"
    | "group_invite"
    | "event"
    | "system"
    | "challenge";
  postId?: string;
  groupId?: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | null;
}

export interface Hashtag {
  tag: string;
  postsCount: number;
  lastUsedAt: Timestamp | null;
  trendingScore: number;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: "post" | "user" | "group" | "message";
  targetId: string;
  reason: string;
  details: string;
  status: "open" | "reviewed" | "actioned" | "dismissed";
  createdAt: Timestamp | null;
  reviewedBy?: string;
  reviewedAt?: Timestamp | null;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  rules?: string;
  isPrivate: boolean;
  ownerId: string;
  memberCount: number;
  decorationIds: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface GroupRank {
  id: string;
  name: string;
  color: string;
  order: number;
  permissions: {
    post: boolean;
    moderate: boolean;
    invite: boolean;
    editGroup: boolean;
    manageRanks: boolean;
  };
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: "badge" | "banner" | "theme" | "frame" | "group_deco" | "effect" | "gift" | "sticker";
  price: number;
  previewUrl: string;
  imageUrl?: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  active: boolean;
  weekKey?: string;
  createdByAdmin?: boolean;
}

export const defaultUserSettings = (): UserSettings => ({
  theme: "dark",
  language: "en",
  notifications: {
    likes: true,
    replies: true,
    follows: true,
    mentions: true,
    messages: true,
  },
  privacy: {
    dmFrom: "everyone",
    showActivity: true,
  },
});