import { Suspense } from "react";
import { BrowserGameLauncher } from "@/components/game/browser-game-launcher";

export default function BrowserGamePage() {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-[#06080d] text-sm font-black text-white/50">Preparing game…</div>}>
      <BrowserGameLauncher />
    </Suspense>
  );
}
