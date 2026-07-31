"use client";

export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="min-h-[44vh] w-full bg-background" role="status" aria-live="polite" aria-label={label}>
      <div className="social-page-header">
        <div className="skeleton h-5 w-32 rounded-md" />
      </div>
      <div className="border-b border-border p-4">
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="mt-3 flex items-end gap-3">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pb-1">
            <div className="skeleton h-5 w-40 rounded-md" />
            <div className="skeleton h-4 w-28 rounded-md" />
          </div>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="skeleton h-4 w-full rounded-md" />
        <div className="skeleton h-4 w-5/6 rounded-md" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
