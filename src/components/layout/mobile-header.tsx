"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useAuth } from "@/contexts/auth-context";

export function MobileHeader({ title }: { title?: string }) {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();

  return (
    <>
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {title ? (
          <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        ) : (
          <Logo showWordmark={false} size={30} href="/home" />
        )}
        <div className="ml-auto">
          <UserAvatar user={profile} size="sm" />
        </div>
      </div>
      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
