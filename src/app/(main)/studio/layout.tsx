import type { ReactNode } from "react";
import Link from "next/link";
import { Boxes, Gamepad2, Headphones, LayoutGrid } from "lucide-react";
import "./studio.css";

const links = [
  { href: "/studio", label: "Editor", icon: Boxes },
  { href: "/studio/music", label: "Audio", icon: Headphones },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/create", label: "Create", icon: LayoutGrid },
];

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <nav className="fixed bottom-[max(14px,env(safe-area-inset-bottom))] left-1/2 z-[80] flex -translate-x-1/2 items-center gap-1 rounded-[20px] border border-white/12 bg-black/78 p-1.5 text-white shadow-[0_18px_55px_rgba(0,0,0,.45)] backdrop-blur-2xl">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex h-10 items-center gap-2 rounded-[14px] px-3 text-[10px] font-black text-white/52 transition hover:bg-white hover:text-black sm:px-4">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
