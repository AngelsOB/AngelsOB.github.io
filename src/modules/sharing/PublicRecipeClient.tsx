'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDocsFromCache,
  doc,
  getDoc,
  getDocFromCache,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Recipe } from '@/modules/beta-builder/domain/models/Recipe';
import BetaBuilderPage from '@/modules/beta-builder/presentation/components/BetaBuilderPage';

export default function PublicRecipeClient({ slug }: { slug: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ownerName, setOwnerName] = useState('Anonymous Brewer');
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFromSource(useCache: boolean) {
      const getDocsFn = useCache ? getDocsFromCache : getDocs;
      const getDocFn = useCache ? getDocFromCache : getDoc;

      const indexQuery = query(
        collection(db, 'publicRecipeIndex'),
        where('shareSlug', '==', slug),
        limit(1)
      );
      const indexSnap = await getDocsFn(indexQuery);
      if (indexSnap.empty) return null;

      const indexDoc = indexSnap.docs[0];
      const indexData = indexDoc.data();
      const recipeSnap = await getDocFn(doc(db, 'recipes', indexDoc.id));
      if (!recipeSnap.exists()) return null;

      const recipeData = recipeSnap.data();
      if (recipeData.isPublic === false) return null;

      return {
        recipe: { id: recipeSnap.id, ...recipeData } as Recipe,
        ownerName: indexData.ownerName || 'Anonymous Brewer',
      };
    }

    async function load() {
      // Try IndexedDB cache first for instant display
      try {
        const cached = await loadFromSource(true);
        if (cached) {
          setRecipe(cached.recipe);
          setOwnerName(cached.ownerName);
          setIsLoading(false);
        }
      } catch { /* cache miss */ }

      // Always fetch fresh from network
      try {
        const fresh = await loadFromSource(false);
        if (fresh) {
          setRecipe(fresh.recipe);
          setOwnerName(fresh.ownerName);
        } else if (!recipe) {
          setNotFound(true);
        }
      } catch (err) {
        console.error('[PublicRecipeClient] Failed to load recipe:', err);
        if (!recipe) setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--brew-accent-100)] rounded w-2/3" />
          <div className="h-4 bg-[var(--brew-accent-100)] rounded w-1/3" />
          <div className="grid grid-cols-5 gap-4 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-[var(--brew-accent-100)] rounded" />
            ))}
          </div>
          <div className="h-40 bg-[var(--brew-accent-100)] rounded" />
        </div>
      </div>
    );
  }

  if (notFound || !recipe) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg-strong)' }}>
          Recipe Not Found
        </h1>
        <p className="text-[var(--fg-muted)]">
          This recipe may have been unpublished or the link is incorrect.
        </p>
      </div>
    );
  }

  return <BetaBuilderPage sharedRecipe={recipe} sharedOwnerName={ownerName} />;
}
