import Link from "next/link";
import { ArrowRight, Cloud, Gamepad2, Radio, ShieldCheck } from "lucide-react";

export function RecRoomFeatureBanner() {
  return (
    <section className="px-3 pt-4 sm:px-5">
      <div className="relative overflow-hidden rounded-[28px] border border-border bg-[#07111f] text-white shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 15% 15%, rgba(34,197,94,.28), transparent 30%), radial-gradient(circle at 88% 20%, rgba(59,130,246,.28), transparent 35%), linear-gradient(135deg,#07111f,#101827 55%,#08131d)",
          }}
        />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80">
                <Radio className="h-3.5 w-3.5 text-emerald-300" /> Flux streamed game
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80">
                <Cloud className="h-3.5 w-3.5" /> No browser install
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white/80">
                <ShieldCheck className="h-3.5 w-3.5" /> Flux account
              </span>
            </div>
            <h2 className="mt-5 text-[clamp(2.2rem,6vw,4.6rem)] font-black leading-[.9] tracking-[-.065em]">
              Rec Room · May 2022
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/62 sm:text-base">
              Flux compatibility project for the May 19, 2022 PC client. The native game runs on a Windows game host and is streamed into Flux, while Flux identity and save data are handled by the shared backend.
            </p>
            <p className="mt-3 text-xs font-semibold text-white/42">
              Build 8751857 · browser player uses a remote host session when one is available.
            </p>
          </div>
          <Link
            href="/games/recroom"
            className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-black text-black transition hover:scale-[1.02]"
          >
            <Gamepad2 className="h-4.5 w-4.5" /> Open Rec Room <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
