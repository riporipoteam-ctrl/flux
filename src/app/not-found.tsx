import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flux-system-state">
      <Link href="/home" className="flux-system-brand">
        <span className="flux-brand-symbol" aria-hidden="true">
          f<span />
        </span>
        <strong>flux</strong>
      </Link>
      <div>
        <span className="flux-system-code">404 / A wrong turn</span>
        <h1>
          There’s more
          <br />
          to find on Flux.
        </h1>
        <p>
          This page isn’t here. The link may have changed, or the content may
          have been removed.
        </p>
        <nav>
          <Link href="/home" className="x-btn">
            <ArrowLeft size={16} />
            Back to your feed
          </Link>
          <Link href="/explore" className="x-btn x-btn-hollow">
            Explore Flux
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </div>
      <small>© {new Date().getFullYear()} Flux by Ripo Team</small>
    </main>
  );
}
