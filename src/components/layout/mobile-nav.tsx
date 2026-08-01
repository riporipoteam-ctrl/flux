"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Mail, PenSquare, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavPathActive } from "@/lib/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import { useState } from "react";

const tabs = [
  { href: "/home", icon: Home, label: "Home" },
  { href: "/explore", icon: Search, label: "Explore" },
  { href: "/ask-ai", icon: Sparkles, label: "AskAI" },
  { href: "/notifications", icon: Bell, label: "Notifications" },
  { href: "/messages", icon: Mail, label: "Messages" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="flux8-mobile-nav lg:hidden" aria-label="Primary navigation">
        <div className="flux8-mobile-nav-grid">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = isNavPathActive(pathname, tab.href);
            return (
              <Link key={tab.href} href={tab.href} aria-label={tab.label} aria-current={active ? "page" : undefined} className={cn("flux8-mobile-tab", active && "is-active")}>
                <Icon className="h-[24px] w-[24px]" strokeWidth={active ? 2.55 : 2} />
              </Link>
            );
          })}
        </div>
      </nav>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button type="button" className="flux8-mobile-create lg:hidden" aria-label="Create post">
            <PenSquare className="h-6 w-6" />
          </button>
        </DialogTrigger>
        <DialogContent className="flux8-dialog max-w-lg overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-4 py-3"><DialogTitle>New post</DialogTitle></DialogHeader>
          <div className="p-3"><ComposeBox onSuccess={() => setOpen(false)} autofocus /></div>
        </DialogContent>
      </Dialog>
    </>
  );
}
