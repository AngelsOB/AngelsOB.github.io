export default function RecipesLoading() {
  return (
    <div className="brew-theme mx-auto max-w-6xl px-2 py-6 animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-48 rounded bg-[var(--brew-accent-200)]" />
        <div className="h-5 w-20 mt-2 rounded bg-[var(--brew-accent-100)]" />
      </div>
      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-[rgb(var(--brew-card))]">
            <div className="h-2 w-full rounded-t-xl bg-[var(--brew-accent-200)]" />
            <div className="border-b border-[rgb(var(--brew-border))] p-4 space-y-2">
              <div className="h-6 bg-[var(--brew-accent-100)] rounded w-3/4" />
              <div className="h-3 bg-[var(--brew-accent-100)] rounded w-1/2" />
            </div>
            <div className="grid grid-cols-5 gap-0 px-4 py-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="space-y-1 px-1">
                  <div className="h-2 bg-[var(--brew-accent-100)] rounded w-8" />
                  <div className="h-4 bg-[var(--brew-accent-100)] rounded w-10" />
                </div>
              ))}
            </div>
            <div className="rounded-b-xl border-t border-[rgb(var(--brew-border))] bg-[rgb(var(--brew-card-inset))] p-3">
              <div className="h-3 bg-[var(--brew-accent-100)] rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
