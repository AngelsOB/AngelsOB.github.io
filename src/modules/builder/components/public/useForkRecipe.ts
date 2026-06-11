'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';

import { uid } from '@/utils/uid';
import { db, auth } from '@/config/firebase';
import { useAuthStore, deriveUserState } from '@/modules/auth/authStore';
import { canCreateRecipe, RECIPE_LIMIT } from '@/modules/auth/tierAccess';
import { toast } from '@/stores/toastStore';
import type { Recipe } from '@/modules/recipe/models/Recipe';

interface UseForkRecipeOptions {
  recipeId: string;
  recipeName: string;
}

interface UseForkRecipeResult {
  fork: () => Promise<void>;
  isForking: boolean;
  isSignedIn: boolean;
  needsSignIn: () => Promise<void>;
}

export function useForkRecipe({ recipeId, recipeName }: UseForkRecipeOptions): UseForkRecipeResult {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);

  async function fork() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const { recipeCount, subscriptionStatus, subscriptionCurrentPeriodEnd } = useAuthStore.getState();
    const userState = deriveUserState(currentUser, subscriptionStatus, subscriptionCurrentPeriodEnd);
    if (!canCreateRecipe(userState, recipeCount)) {
      toast.error(
        `You've reached the ${RECIPE_LIMIT}-recipe limit. Upgrade to Premium for unlimited recipes.`,
        { duration: 6000 },
      );
      return;
    }

    setIsForking(true);
    try {
      const recipeSnap = await getDoc(doc(db, 'recipes', recipeId));
      if (!recipeSnap.exists()) throw new Error('Recipe not found');

      const recipeData = recipeSnap.data();
      if (!recipeData.isPublic) throw new Error('Recipe is not public');

      const originalRecipe = { id: recipeId, ...recipeData } as Recipe & { ownerId?: string };

      let parentOwnerName = 'Anonymous Brewer';
      let parentShareSlug: string | undefined;
      try {
        const indexSnap = await getDoc(doc(db, 'publicRecipeIndex', recipeId));
        if (indexSnap.exists()) {
          const indexData = indexSnap.data();
          parentOwnerName = indexData.ownerName || parentOwnerName;
          parentShareSlug = indexData.shareSlug;
        }
      } catch {
        /* fallback */
      }

      const now = new Date().toISOString();
      const newId = uid();

      const {
        id: _sourceId,
        isPublic: _isPublic,
        shareSlug: _shareSlug,
        publishedAt: _publishedAt,
        ownerId: _ownerId,
        ...recipeFields
      } = recipeData;

      const forkedData = JSON.parse(
        JSON.stringify({
          ...recipeFields,
          ownerId: currentUser.uid,
          name: `${originalRecipe.name} (Fork)`,
          isPublic: false,
          currentVersion: 1,
          parentRecipeId: recipeId,
          parentVersionNumber: originalRecipe.currentVersion || 1,
          parentRecipeName: originalRecipe.name,
          parentRecipeOwnerName: parentOwnerName,
          parentRecipeShareSlug: parentShareSlug,
          createdAt: now,
          updatedAt: now,
        }),
      );

      await runTransaction(db, async (transaction) => {
        const recipeRef = doc(db, 'recipes', newId);
        const userRef = doc(db, 'users', currentUser.uid);
        transaction.set(recipeRef, forkedData);
        transaction.update(userRef, { recipeCount: increment(1) });
      });
      useAuthStore.getState().adjustRecipeCount(1);

      try {
        await updateDoc(doc(db, 'publicRecipeIndex', recipeId), {
          forkCount: increment(1),
        });
      } catch {
        /* may fail if rules don't allow — that's ok */
      }

      toast.success(`Forked "${recipeName}" to your recipes`);
      router.push(`/recipes/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fork recipe');
    } finally {
      setIsForking(false);
    }
  }

  async function needsSignIn() {
    try {
      await signInWithGoogle();
    } catch {
      /* user cancelled */
    }
  }

  return {
    fork,
    isForking,
    isSignedIn: Boolean(user),
    needsSignIn,
  };
}
