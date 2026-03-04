export default function RecipeLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      {/* SRM bar */}
      <div className="h-2 rounded-full bg-[var(--brew-accent-200)] w-full" />

      {/* Title */}
      <div className="space-y-3">
        <div className="h-8 bg-[var(--brew-accent-200)] rounded w-2/3" />
        <div className="h-5 bg-[var(--brew-accent-100)] rounded w-1/3" />
        <div className="h-4 bg-[var(--brew-accent-100)] rounded w-1/4" />
      </div>

      {/* Stats */}
      <div className="brew-section">
        <div className="h-5 bg-[var(--brew-accent-200)] rounded w-32 mb-4" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="text-center space-y-2">
              <div className="h-3 bg-[var(--brew-accent-100)] rounded w-10 mx-auto" />
              <div className="h-7 bg-[var(--brew-accent-200)] rounded w-14 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Fermentables */}
      <div className="brew-section">
        <div className="h-5 bg-[var(--brew-accent-200)] rounded w-36 mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 bg-[var(--brew-accent-100)] rounded mb-2" />
        ))}
      </div>

      {/* Hops */}
      <div className="brew-section">
        <div className="h-5 bg-[var(--brew-accent-200)] rounded w-20 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 bg-[var(--brew-accent-100)] rounded mb-2" />
        ))}
      </div>
    </div>
  );
}
