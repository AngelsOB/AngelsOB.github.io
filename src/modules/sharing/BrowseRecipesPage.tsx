'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDocsFromCache,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BrowseCard, type BrowseRecipe } from './BrowseCard';
import Button from '@/components/Button';

type SortOption = 'newest' | 'popular' | 'top-rated';

const MAX_COMPARE = 8;

/** @deprecated Classic UI. Replaced by HSBrowsePage — see HOPSKIP_MIGRATION_PRD.md §1.1. */
export default function BrowseRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<BrowseRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedIds.size < 2) return;
    router.push(`/browse/compare?ids=${Array.from(selectedIds).join(',')}`);
  }, [selectedIds, router]);

  const fetchRecipes = useCallback(async () => {
    setError(null);

    const mapDocs = (docs: QueryDocumentSnapshot<DocumentData>[]) =>
      docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || '',
          style: data.style || '',
          ownerName: data.ownerName || 'Anonymous Brewer',
          ownerId: data.ownerId || '',
          shareSlug: data.shareSlug || '',
          stats: data.stats || {},
          tags: data.tags || [],
          hopNames: data.hopNames || [],
          publishedAt: data.publishedAt || '',
          forkCount: data.forkCount || 0,
          ratingSum: data.ratingSum || 0,
          ratingCount: data.ratingCount || 0,
          ratingAvg: data.ratingCount > 0 ? (data.ratingSum || 0) / data.ratingCount : 0,
          labelUrl: data.labelUrl || undefined,
        } as BrowseRecipe;
      });

    // Try IndexedDB cache first for instant display
    const q = query(collection(db, 'publicRecipeIndex'), orderBy('publishedAt', 'desc'));
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      if (!cachedSnapshot.empty) {
        setRecipes(mapDocs(cachedSnapshot.docs));
        setIsLoading(false);
      }
    } catch { /* Cache miss — continue to network */ }

    // Always fetch fresh from network
    try {
      setIsLoading(true);
      const snapshot = await getDocs(q);
      setRecipes(mapDocs(snapshot.docs));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const allRecipes = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => {
      if (sort === 'top-rated') {
        const diff = (b.ratingAvg || 0) - (a.ratingAvg || 0);
        if (diff !== 0) return diff;
        return (b.ratingCount || 0) - (a.ratingCount || 0);
      }
      if (sort === 'popular') return (b.forkCount || 0) - (a.forkCount || 0);
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return sorted;
  }, [recipes, sort]);

  const availableStyles = useMemo(() => {
    const styles = new Set<string>();
    for (const r of allRecipes) {
      if (r.style) styles.add(r.style);
    }
    return Array.from(styles).sort();
  }, [allRecipes]);

  const filteredRecipes = useMemo(() => {
    let result = allRecipes;
    if (styleFilter) {
      result = result.filter((r) => r.style === styleFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.style.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.hopNames.some((h) => h.toLowerCase().includes(q))
      );
    }
    return result;
  }, [allRecipes, searchQuery, styleFilter]);

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
            <label htmlFor="browse-style" className="text-sm font-medium whitespace-nowrap">
              Style:
            </label>
            <select
              id="browse-style"
              value={styleFilter}
              onChange={(e) => setStyleFilter(e.target.value)}
              className="brew-input"
            >
              <option value="">All Styles</option>
              {availableStyles.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
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
              <option value="top-rated">Top Rated</option>
              <option value="popular">Most Forked</option>
            </select>
          </div>
          <Button
            variant={compareMode ? 'neon' : 'outline'}
            size="sm"
            onClick={() => {
              setCompareMode((prev) => !prev);
              if (compareMode) setSelectedIds(new Set());
            }}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            }
          >
            Compare
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="brew-section py-8 text-center">
          <p className="text-[var(--brew-danger)] mb-4">{error}</p>
          <button
            onClick={() => fetchRecipes()}
            className="brew-btn-primary"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton — only when we have nothing to show yet */}
      {isLoading && !error && recipes.length === 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-[var(--brew-card)] animate-pulse">
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
      {!isLoading && !error && allRecipes.length === 0 && (
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
      {!isLoading && !error && allRecipes.length > 0 && filteredRecipes.length === 0 && (
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
      {!error && filteredRecipes.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => (
              <BrowseCard
                key={recipe.id}
                recipe={recipe}
                isNavigating={navigatingId === recipe.id}
                onNavigate={() => setNavigatingId(recipe.id)}
                compareMode={compareMode}
                isSelected={selectedIds.has(recipe.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

        </>
      )}

      {/* Floating compare action bar */}
      {compareMode && selectedIds.size >= 1 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="card-glass flex items-center gap-4 rounded-2xl px-6 py-3 shadow-lg backdrop-blur-md">
            <span className="text-sm font-semibold whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {selectedIds.size} recipe{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="neon"
              size="sm"
              onClick={handleCompare}
              loading={false}
              leftIcon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" />
                </svg>
              }
            >
              Compare{selectedIds.size < 2 ? ` (${2 - selectedIds.size} more)` : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

