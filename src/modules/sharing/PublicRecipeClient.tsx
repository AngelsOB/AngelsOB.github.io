'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  getDoc,
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
    async function load() {
      try {
        // Step 1: Look up recipe ID via publicRecipeIndex (allow read: if true)
        const indexQuery = query(
          collection(db, 'publicRecipeIndex'),
          where('shareSlug', '==', slug),
          limit(1)
        );
        const indexSnap = await getDocs(indexQuery);

        if (indexSnap.empty) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const indexDoc = indexSnap.docs[0];
        const indexData = indexDoc.data();
        const recipeId = indexDoc.id;

        // Step 2: Fetch the full recipe by ID (allowed since isPublic == true)
        const recipeSnap = await getDoc(doc(db, 'recipes', recipeId));

        if (!recipeSnap.exists()) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        const recipeData = recipeSnap.data();
        if (recipeData.isPublic === false) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setRecipe({ id: recipeSnap.id, ...recipeData } as Recipe);
        setOwnerName(indexData.ownerName || 'Anonymous Brewer');
      } catch (err) {
        console.error('[PublicRecipeClient] Failed to load recipe:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    load();
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
