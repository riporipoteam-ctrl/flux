import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`.replace(/\.0K/, "K");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(/\.0M/, "M");
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w]+/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function extractMentions(text: string): string[] {
  const matches = text.match(/@[\w]+/g) || [];
  return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

export function formatUsername(username: string): string {
  return username.replace(/^@/, "").toLowerCase().trim();
}
