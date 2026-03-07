'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDocsFromCache,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { BrowseCard, type BrowseRecipe } from './BrowseCard';

export default function UserProfileClient({ userId }: { userId: string }) {
  const [recipes, setRecipes] = useState<BrowseRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserRecipes() {
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
          } as BrowseRecipe;
        });

      const q = query(
        collection(db, 'publicRecipeIndex'),
        where('ownerId', '==', userId),
        orderBy('publishedAt', 'desc'),
      );

      // Try cache first
      let hasCachedData = false;
      try {
        const cached = await getDocsFromCache(q);
        if (!cached.empty) {
          setRecipes(mapDocs(cached.docs));
          setIsLoading(false);
          hasCachedData = true;
        }
      } catch { /* cache miss */ }

      // Fetch from network
      try {
        setIsLoading(true);
        const snapshot = await getDocs(q);
        setRecipes(mapDocs(snapshot.docs));
      } catch (err) {
        if (!hasCachedData) {
          setError(err instanceof Error ? err.message : 'Failed to load profile.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserRecipes();
  }, [userId]);

  const ownerName = recipes[0]?.ownerName || 'Brewer';

  const topStyles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      if (r.style) counts.set(r.style, (counts.get(r.style) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);
  }, [recipes]);

  return (
    <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
      {/* Profile header */}
      <div className="mb-8">
        <Link href="/browse" className="text-muted text-xs hover:underline mb-3 inline-block">
          &larr; Back to Browse
        </Link>
        <h1 className="brew-section-title text-3xl">{ownerName}</h1>
        {!isLoading && !error && (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-muted text-sm">
              {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
            </span>
            {topStyles.length > 0 && (
              <>
                <span className="text-muted text-sm opacity-40">|</span>
                <span className="text-muted text-sm">
                  {topStyles.join(', ')}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="brew-section py-8 text-center">
          <p className="text-[var(--brew-danger)] mb-4">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && recipes.length === 0 && !error && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
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
          <p className="text-lg font-semibold" style={{ color: 'var(--fg-strong)' }}>
            No public recipes
          </p>
          <p className="text-muted text-sm mt-1">
            This brewer hasn&apos;t shared any recipes yet.
          </p>
        </div>
      )}

      {/* Recipe grid */}
      {recipes.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/r/${recipe.shareSlug}`}
              onClick={() => setNavigatingId(recipe.id)}
              className="contents"
            >
              <BrowseCard recipe={recipe} isNavigating={navigatingId === recipe.id} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
