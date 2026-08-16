import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { RecRoomCloudPlayer } from "@/components/game/recroom-cloud-player";

export const metadata: Metadata = {
  title: "Rec Room · Flux Games",
  description: "Launch the May 19, 2022 Rec Room client in a private RipoTeamServer game runtime and stream it into Flux.",
};

export default function RecRoomPage() {
  return (
    <>
      <RecRoomCloudPlayer />
      <Link
        href="/games/recroom/recovery"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[260] inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-black/80 px-4 text-xs font-black text-white shadow-2xl backdrop-blur-xl sm:bottom-5 sm:right-5"
        title="RipoTeam owner: recover the May 2022 server client from Steam"
      >
        <Wrench className="h-3.5 w-3.5" />
        Server recovery
      </Link>
    </>
  );
}
