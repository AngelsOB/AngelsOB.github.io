'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { srmToRgb } from '../beta-builder/utils/srmColorUtils';

type BrowseRecipe = {
  id: string;
  name: string;
  style: string;
  ownerName: string;
  shareSlug: string;
  stats: { og?: number; fg?: number; ibu?: number; srm?: number; abv?: number };
  tags: string[];
  hopNames: string[];
  publishedAt: string;
  forkCount: number;
};

type SortOption = 'newest' | 'popular';

const PAGE_SIZE = 24;

export default function BrowseRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<BrowseRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sort, setSort] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function fetchRecipes(afterDoc: QueryDocumentSnapshot<DocumentData> | null, sortBy: SortOption, append: boolean) {
    const loading = append ? setIsLoadingMore : setIsLoading;
    loading(true);
    setError(null);

    try {
      const orderField = sortBy === 'popular' ? 'forkCount' : 'publishedAt';
      const constraints: QueryConstraint[] = [orderBy(orderField, 'desc')];
      if (afterDoc) constraints.push(startAfter(afterDoc));
      constraints.push(limit(PAGE_SIZE + 1));

      const q = query(collection(db, 'publicRecipeIndex'), ...constraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs;

      const hasNext = docs.length > PAGE_SIZE;
      const resultDocs = hasNext ? docs.slice(0, PAGE_SIZE) : docs;

      const newRecipes: BrowseRecipe[] = resultDocs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          style: data.style || '',
          ownerName: data.ownerName || 'Anonymous Brewer',
          shareSlug: data.shareSlug || '',
          stats: data.stats || {},
          tags: data.tags || [],
          hopNames: data.hopNames || [],
          publishedAt: data.publishedAt || '',
          forkCount: data.forkCount || 0,
        };
      });

      setRecipes((prev) => (append ? [...prev, ...newRecipes] : newRecipes));
      setLastDoc(resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null);
      setHasMore(hasNext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes. Please try again.');
    } finally {
      loading(false);
    }
  }

  useEffect(() => {
    setLastDoc(null);
    fetchRecipes(null, sort, false);
  }, [sort]);

  const filteredRecipes = useMemo(() => {
    if (!searchQuery) return recipes;
    const q = searchQuery.toLowerCase();
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.style.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.hopNames.some((h) => h.toLowerCase().includes(q))
    );
  }, [recipes, searchQuery]);

  return (
    <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="brew-section-title text-3xl">Browse Recipes</h1>
        <p className="text-muted text-sm mt-1">
          Discover recipes shared by the community
        </p>
      </div>

      {/* Controls */}
      <div className="brew-section mb-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, style, brewer, hops, or tags..."
              className="brew-input w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="browse-sort" className="text-sm font-medium whitespace-nowrap">
              Sort by:
            </label>
            <select
              id="browse-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="brew-input"
            >
              <option value="newest">Newest</option>
              <option value="popular">Most Forked</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="brew-section py-8 text-center">
          <p className="text-[var(--brew-danger)] mb-4">{error}</p>
          <button
            onClick={() => fetchRecipes(null, sort, false)}
            className="brew-btn-primary"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !error && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[rgb(var(--brew-card))] animate-pulse">
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
      )}

      {/* Empty state */}
      {!isLoading && !error && recipes.length === 0 && (
        <div className="brew-section py-12 text-center">
          <svg
            className="mx-auto mb-4 opacity-30"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
          <p className="text-lg font-semibold" style={{ color: 'var(--fg-strong)' }}>
            No public recipes yet
          </p>
          <p className="text-muted text-sm mt-1">
            Be the first to share a recipe with the community!
          </p>
        </div>
      )}

      {/* No search results */}
      {!isLoading && !error && recipes.length > 0 && filteredRecipes.length === 0 && (
        <div className="brew-section py-10 text-center">
          <p className="mb-1 text-lg font-semibold" style={{ color: 'var(--fg-strong)' }}>
            No matches for &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-muted mb-5 text-sm">Try a different search term</p>
          <button onClick={() => setSearchQuery('')} className="brew-btn-ghost">
            Clear search
          </button>
        </div>
      )}

      {/* Recipe grid */}
      {!isLoading && !error && filteredRecipes.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <BrowseCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => router.push(`/r/${recipe.shareSlug}`)}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && !searchQuery && (
            <div className="mt-8 text-center">
              <button
                onClick={() => fetchRecipes(lastDoc, sort, true)}
                disabled={isLoadingMore}
                className="brew-btn-ghost px-8 py-3"
              >
                {isLoadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BrowseCard({
  recipe,
  onClick,
}: {
  recipe: BrowseRecipe;
  onClick: () => void;
}) {
  const srmColor = recipe.stats.srm != null ? srmToRgb(recipe.stats.srm) : 'rgb(220, 190, 140)';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group brew-recipe-card relative cursor-pointer overflow-visible z-10
        focus:ring-2 focus:ring-[var(--brew-accent-400)] focus:ring-offset-2 focus:outline-none"
      style={{ '--card-srm': srmColor } as React.CSSProperties}
    >
      <div className="rounded-xl bg-[rgb(var(--brew-card))]">
        {/* SRM Color Strip */}
        <div className="h-2 w-full rounded-t-xl" style={{ backgroundColor: srmColor }} />

        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border))] p-4">
          <h3
            className="min-w-0 truncate font-extrabold tracking-tight"
            style={{
              fontSize: `${Math.max(1, Math.min(1.5, 2.1 - recipe.name.length * 0.035))}rem`,
            }}
          >
            {recipe.name}
          </h3>
          {recipe.style && (
            <p className="text-muted truncate text-xs italic">{recipe.style}</p>
          )}
          <p className="text-muted text-xs mt-1">
            by {recipe.ownerName}
            {recipe.forkCount > 0 && (
              <span className="ml-2 opacity-60">
                {recipe.forkCount} {recipe.forkCount === 1 ? 'fork' : 'forks'}
              </span>
            )}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-0 px-4 py-3">
          <div className="pr-2">
            <div className="brew-gauge-label text-[10px]">ABV</div>
            <div
              className="font-handwritten-alt text-sm tabular-nums"
              style={{ color: 'var(--brew-accent-700)' }}
            >
              {recipe.stats.abv != null ? `${recipe.stats.abv.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
            <div className="brew-gauge-label text-[10px]">IBU</div>
            <div className="font-handwritten-alt text-sm tabular-nums">
              {recipe.stats.ibu != null ? recipe.stats.ibu : '—'}
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
            <div className="brew-gauge-label text-[10px]">SRM</div>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: srmColor }}
              />
              <span className="font-handwritten-alt text-sm tabular-nums">
                {recipe.stats.srm != null ? Math.round(recipe.stats.srm) : '—'}
              </span>
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
            <div className="brew-gauge-label text-[10px]">OG</div>
            <div className="font-handwritten-alt text-sm tabular-nums">
              {recipe.stats.og != null ? recipe.stats.og.toFixed(3) : '—'}
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] pl-2">
            <div className="brew-gauge-label text-[10px]">FG</div>
            <div className="font-handwritten-alt text-sm tabular-nums">
              {recipe.stats.fg != null ? recipe.stats.fg.toFixed(3) : '—'}
            </div>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="brew-tag">
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="brew-tag">+{recipe.tags.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="rounded-b-xl border-t border-[rgb(var(--brew-border))] bg-[rgb(var(--brew-card-inset))] p-3">
          <div className="text-muted text-xs">
            {recipe.publishedAt
              ? new Date(recipe.publishedAt).toLocaleDateString()
              : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
