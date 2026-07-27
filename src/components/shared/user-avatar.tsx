"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageViewer } from "@/components/shared/image-viewer";
import { cn } from "@/lib/utils";
import type { UserDecorations, UserProfile } from "@/types";
import { frameClassForDecoration } from "@/lib/shop-catalog";

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
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
  animate?: boolean;
  clickable?: boolean;
  decorations?: UserDecorations | null;
}) {
  const [open, setOpen] = useState(false);
  const sizes = {
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
            <AvatarImage
              src={user.avatarUrl}
              alt={user.displayName || "User"}
            />
          ) : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </span>
      <ImageViewer
        open={open}
        src={user?.avatarUrl}
        alt={user?.displayName || "Avatar"}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
