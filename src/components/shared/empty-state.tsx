"use client";

import type { LucideIcon } from "lucide-react";
import { XEmpty } from "@/components/x/x-ui";

/**
 * Kept as a thin alias so the dozens of existing call sites pick up the X
 * empty-state treatment without a rename.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <XEmpty icon={icon} title={title} description={description} action={action} />;
}
