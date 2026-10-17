"use client";

export function LoadingScreen({ label = "Loading Flux" }: { label?: string }) {
  return (
    <div
      className="flux-loading-screen"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <header>
        <span className="flux-brand-symbol" aria-hidden="true">
          f<span />
        </span>
        <strong>flux</strong>
        <span className="flux-loading-search" />
      </header>
      <div className="flux-loading-layout">
        <aside>
          <span className="flux-loading-line" />
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="flux-loading-nav" />
          ))}
        </aside>
        <main>
          <div className="flux-loading-heading">
            <span />
            <small />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="flux-loading-post" key={i}>
              <span className="flux-loading-avatar" />
              <div>
                <span className="flux-loading-line" />
                <span className="flux-loading-copy" />
                <span className="flux-loading-copy short" />
                {i === 1 ? <span className="flux-loading-media" /> : null}
              </div>
            </div>
          ))}
        </main>
        <aside>
          <span className="flux-loading-line" />
          <span className="flux-loading-copy" />
          <span className="flux-loading-copy short" />
        </aside>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
