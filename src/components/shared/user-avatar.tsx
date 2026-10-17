"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageViewer } from "@/components/shared/image-viewer";
import { cn } from "@/lib/utils";
import type { UserDecorations, UserProfile } from "@/types";
import { frameClassForDecoration } from "@/lib/shop-catalog";
import { assetUrl } from "@/lib/asset-url";

const avatarPalettes = [
  { sky: "#cceeff", accent: "#38bdf8", skin: "#d99571", hair: "#18384d", shirt: "#117b9d" },
  { sky: "#ffe5d6", accent: "#ff9b70", skin: "#f0bf9d", hair: "#573b34", shirt: "#b94d5c" },
  { sky: "#d9f5e5", accent: "#50c79b", skin: "#8e5d49", hair: "#222c31", shirt: "#347764" },
  { sky: "#fff0bd", accent: "#f3c94d", skin: "#edc49a", hair: "#403b35", shirt: "#9c6f2b" },
  { sky: "#e4e7ff", accent: "#8a93e8", skin: "#b7785d", hair: "#27273d", shirt: "#555db2" },
  { sky: "#f8ddea", accent: "#ed83ad", skin: "#f1c5aa", hair: "#663d4b", shirt: "#ae4c7b" },
  { sky: "#d9f1eb", accent: "#36ad9d", skin: "#c58968", hair: "#282d2b", shirt: "#36746d" },
  { sky: "#e8e1d5", accent: "#bc9a71", skin: "#a96e52", hair: "#342c29", shirt: "#765b42" },
] as const;

function avatarVariant(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash) % avatarPalettes.length;
}

function FluxPortrait({ seed }: { seed: string }) {
  const variant = avatarVariant(seed);
  const palette = avatarPalettes[variant];
  const hairCaps = [
    "M21 38c-2-17 6-25 19-25 14 0 22 10 20 25l-6-9-1-6c-7 7-17 9-27 6z",
    "M20 38c-2-17 7-26 20-26 14 0 23 11 21 27l-7-8-4-9c-5 6-14 9-24 8z",
    "M21 39c-3-17 6-25 19-25 14 0 23 10 20 26l-6-10-3-7-11 7-13-2z",
    "M21 37c0-16 8-23 20-23 12 0 20 9 19 24l-6-9-4-8-12 7-11-1z",
  ];
  const longHair = variant % 3 === 0;

  return (
    <svg className="flux-avatar-portrait" viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" fill={palette.sky} />
      <circle cx={variant % 2 ? 67 : 14} cy="14" r="22" fill={palette.accent} opacity=".2" />
      <path d="M10 82c2-18 13-27 30-27s28 9 30 27z" fill={palette.shirt} />
      <path d="M33 51h14v13H33z" fill={palette.skin} />
      {longHair ? <path d="M19 38c0-17 8-25 21-25s22 9 22 26v22H18z" fill={palette.hair} /> : null}
      <ellipse cx="40" cy="37" rx="16" ry="19" fill={palette.skin} />
      <path d={hairCaps[variant % hairCaps.length]} fill={palette.hair} />
      <path d="M33 38h.2M47 38h.2" stroke="#372a28" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M36 47c2 2 6 2 8 0" fill="none" stroke="#9b5f52" strokeWidth="1.7" strokeLinecap="round" />
      {variant % 4 === 1 ? (
        <g fill="none" stroke={palette.hair} strokeWidth="1.8">
          <rect x="26" y="34" width="12" height="8" rx="3" />
          <rect x="42" y="34" width="12" height="8" rx="3" />
          <path d="M38 37h4" />
        </g>
      ) : null}
      {variant % 4 === 3 ? <path d="M24 28c8-8 24-8 32 0" fill="none" stroke={palette.accent} strokeWidth="4" strokeLinecap="round" /> : null}
    </svg>
  );
}

export function UserAvatar({
  user,
  className,
  size = "md",
  ring = false,
  animate = false,
  clickable = true,
  decorations,
}: {
  user?: Pick<UserProfile, "displayName" | "avatarUrl" | "username"> | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  animate?: boolean;
  clickable?: boolean;
  decorations?: UserDecorations | null;
}) {
  const [open, setOpen] = useState(false);
  const sizes = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-8 w-8 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-24 w-24 text-2xl",
  };

  const initials =
    user?.displayName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    user?.username?.slice(0, 2).toUpperCase() ||
    "FX";
  const portraitSeed = user?.username || user?.displayName || "flux";

  const frameClass = frameClassForDecoration(decorations?.frameId);

  return (
    <>
      <span
        role={clickable && user?.avatarUrl ? "button" : undefined}
        className={cn(
          "relative inline-flex rounded-full outline-none",
          clickable && user?.avatarUrl && "cursor-zoom-in",
          animate && "transition hover:scale-105",
          frameClass
        )}
        onClick={(e) => {
          if (!clickable || !user?.avatarUrl) return;
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Avatar
          className={cn(
            sizes[size],
            ring && "avatar-ring",
            "shadow-sm",
            className
          )}
        >
          {user?.avatarUrl ? (
            <AvatarImage src={assetUrl(user.avatarUrl)} alt={user.displayName || "User"} />
          ) : null}
          <AvatarFallback className="flux-avatar-fallback">
            <FluxPortrait seed={portraitSeed} />
            <span className="sr-only">{initials}</span>
          </AvatarFallback>
        </Avatar>
      </span>
      <ImageViewer
        open={open}
        src={user?.avatarUrl ? assetUrl(user.avatarUrl) : user?.avatarUrl}
        alt={user?.displayName || "Avatar"}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
