"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Home, Mail, PenSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavPathActive } from "@/lib/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { useState } from "react";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tabs = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/explore", icon: Search, label: "Explore" },
    { href: "__compose", icon: PenSquare, label: "Create", compose: true },
    { href: "/games", icon: Gamepad2, label: "Games" },
    { href: "/messages", icon: Mail, label: "Messages" },
  ];

  return (
    <nav className="flux8-mobile-nav lg:hidden" aria-label="Primary navigation">
      <div className="flux8-mobile-nav-grid">
        {tabs.map((tab) => {
          if (tab.compose) {
            return (
              <Dialog key="compose" open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button type="button" className="flux8-mobile-tab flux8-mobile-create" aria-label="Create post">
                    <span><PenSquare className="h-[19px] w-[19px]" strokeWidth={2.3} /></span>
                    {tab.label}
                  </button>
                </DialogTrigger>
                <DialogContent className="flux8-dialog max-w-lg overflow-hidden p-0">
                  <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>New post</DialogTitle></DialogHeader>
                  <div className="p-3"><ComposeBox onSuccess={() => setOpen(false)} autofocus /></div>
                </DialogContent>
              </Dialog>
            );
          }

          const Icon = tab.icon;
          const active = isNavPathActive(pathname, tab.href);
          return (
            <Link key={tab.href} href={tab.href} aria-current={active ? "page" : undefined} className={cn("flux8-mobile-tab", active && "is-active")}>
              <span><Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.5 : 2} /></span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
