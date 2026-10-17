"use client";
import Link from "next/link";
import type { MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import { assetUrl } from "@/lib/asset-url";
export function FluxMark({
  size = 34,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("flux-brand-mark", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <img
        src={assetUrl("/brand/flux-symbol.png")}
        width={size}
        height={size}
        alt=""
        draggable={false}
      />
    </span>
  );
}
export function Logo({
  className,
  showWordmark = true,
  href = "/home",
  size = 36,
  onClick,
}: {
  className?: string;
  showWordmark?: boolean;
  href?: string;
  size?: number;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      href={href}
      className={cn("flux-logo", className)}
      aria-label="Flux home"
      onClick={onClick}
    >
      <FluxMark size={size} />
      {showWordmark ? <span className="flux-brand-word">flux</span> : null}
    </Link>
  );
}
