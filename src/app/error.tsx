"use client";

import { FluxMark } from "@/components/shared/logo";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flux-system-state">
      <Link href="/home" className="flux-system-brand">
        <FluxMark size={36} />
        <strong>flux</strong>
      </Link>
      <div>
        <span className="flux-system-code">Connection interrupted</span>
        <h1>
          Let’s try
          <br />
          that again.
        </h1>
        <p>
          This screen couldn’t load. Try again to pick up where you left off.
        </p>
        <nav>
          <button className="x-btn" type="button" onClick={reset}>
            <RefreshCw size={16} />
            Try again
          </button>
          <Link href="/home" className="x-btn x-btn-hollow">
            Go to your feed
          </Link>
        </nav>
      </div>
    </main>
  );
}
