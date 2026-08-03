"use client";

export function LoadingScreen({ label = "Loading Flux" }: { label?: string }) {
  return (
    <main className="min-h-[100dvh] bg-background" role="status" aria-live="polite" aria-label={label}>
      <div className="mx-auto min-h-[100dvh] w-full max-w-[620px] border-x border-border bg-card">
        <header className="sticky top-0 z-10 flex h-[54px] items-center justify-center border-b border-border bg-card/90 backdrop-blur-xl">
          <div className="skeleton h-5 w-20 rounded-full" />
        </header>
        <div className="grid h-[53px] grid-cols-2 border-b border-border">
          <div className="grid place-items-center"><div className="skeleton h-4 w-16 rounded" /></div>
          <div className="grid place-items-center"><div className="skeleton h-4 w-20 rounded" /></div>
        </div>
        <div className="flex gap-3 border-b border-border p-4">
          <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1"><div className="skeleton h-6 w-48 rounded" /><div className="mt-6 flex justify-between"><div className="skeleton h-8 w-40 rounded-full" /><div className="skeleton h-9 w-20 rounded-full" /></div></div>
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex gap-3 border-b border-border p-4">
            <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-4 w-40 rounded" /><div className="skeleton h-4 w-full rounded" /><div className="skeleton h-4 w-4/5 rounded" />{index % 2 === 0 ? <div className="skeleton mt-3 aspect-[16/9] w-full rounded-2xl" /> : null}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
