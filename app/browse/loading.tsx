export default function BrowseLoading() {
  return (
    <div className="brew-theme mx-auto max-w-6xl px-2 py-6 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-56 rounded bg-[var(--brew-accent-200)]" />
        <div className="h-4 w-72 mt-2 rounded bg-[var(--brew-accent-100)]" />
      </div>
      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-[rgb(var(--brew-card))]">
            <div className="h-2 w-full rounded-t-xl bg-[var(--brew-accent-200)]" />
            <div className="p-4 space-y-3">
              <div className="h-5 bg-[var(--brew-accent-100)] rounded w-3/4" />
              <div className="h-3 bg-[var(--brew-accent-100)] rounded w-1/2" />
              <div className="grid grid-cols-5 gap-2 pt-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-8 bg-[var(--brew-accent-100)] rounded" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
