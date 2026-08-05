import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText, Gamepad2 } from "lucide-react";
import { BROWSER_GAMES } from "@/data/browser-games";

export default function GameLicensesPage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 max-w-3xl items-center gap-3 px-4">
          <Link href="/games" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Back to games"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0 flex-1"><h1 className="font-black">Game credits and licenses</h1><p className="text-[11px] text-muted-foreground">Source and legal information for Flux Open Games</p></div>
          <Gamepad2 className="h-5 w-5 text-muted-foreground" />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-5">
        <section className="border-y border-border bg-card p-5 sm:rounded-[20px] sm:border">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted"><FileText className="h-5 w-5" /></span><div><h2 className="font-black">How Flux presents open-source games</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Games are hosted inside the Flux deployment so they do not depend on another website’s iframe policy. Flux does not claim authorship of third-party projects. Their original authors and licenses remain listed here and inside the bundled source where required.</p></div></div>
        </section>

        <div className="mt-5 space-y-3">
          {BROWSER_GAMES.map((game) => (
            <article key={game.slug} className="border-y border-border bg-card p-4 sm:rounded-[18px] sm:border">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-xl">{game.symbol}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-black">{game.title}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{game.author}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.09em] text-muted-foreground"><span className="rounded-full bg-muted px-2.5 py-1">{game.license}</span><span className="rounded-full bg-muted px-2.5 py-1">{game.technology}</span></div>
                  <a href={game.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-primary hover:underline">View original source <ExternalLink className="h-3.5 w-3.5" /></a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
