'use client';

import { useState } from 'react';
import { uid } from "@/utils/uid";
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import Button from '../../components/Button';
import { useAuthStore, deriveUserState } from '../auth/authStore';
import { canCreateRecipe, RECIPE_LIMIT } from '../auth/tierAccess';
import { toast } from '../../stores/toastStore';
import type { Recipe } from '../beta-builder/domain/models/Recipe';

interface ForkButtonProps {
  recipeId: string;
  recipeName: string;
}

export default function ForkButton({ recipeId, recipeName }: ForkButtonProps) {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);

  async function handleFork() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Check recipe limit before forking
    const { recipeCount, subscriptionStatus, subscriptionCurrentPeriodEnd } = useAuthStore.getState();
    const userState = deriveUserState(currentUser, subscriptionStatus, subscriptionCurrentPeriodEnd);
    if (!canCreateRecipe(userState, recipeCount)) {
      toast.error(`You've reached the ${RECIPE_LIMIT}-recipe limit. Upgrade to Premium for unlimited recipes.`, { duration: 6000 });
      return;
    }

    setIsForking(true);
    try {
      // Read the public recipe
      const recipeSnap = await getDoc(doc(db, 'recipes', recipeId));
      if (!recipeSnap.exists()) throw new Error('Recipe not found');

      const recipeData = recipeSnap.data();
      if (!recipeData.isPublic) throw new Error('Recipe is not public');

      const originalRecipe = { id: recipeId, ...recipeData } as Recipe & { ownerId?: string };

      // Get owner name and share slug from publicRecipeIndex
      let parentOwnerName = 'Anonymous Brewer';
      let parentShareSlug: string | undefined;
      try {
        const indexSnap = await getDoc(doc(db, 'publicRecipeIndex', recipeId));
        if (indexSnap.exists()) {
          const indexData = indexSnap.data();
          parentOwnerName = indexData.ownerName || parentOwnerName;
          parentShareSlug = indexData.shareSlug;
        }
      } catch { /* fallback */ }

      // Create forked recipe
      const now = new Date().toISOString();
      const newId = uid();

      // Strip sharing fields and rebuild
      const {
        isPublic: _isPublic,
        shareSlug: _shareSlug,
        publishedAt: _publishedAt,
        ownerId: _ownerId,
        ...recipeFields
      } = recipeData;

      const forkedData = JSON.parse(JSON.stringify({
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
      }));

      // Save the fork + increment recipeCount atomically
      await runTransaction(db, async (transaction) => {
        const recipeRef = doc(db, 'recipes', newId);
        const userRef = doc(db, 'users', currentUser.uid);
        transaction.set(recipeRef, forkedData);
        transaction.update(userRef, { recipeCount: increment(1) });
      });
      useAuthStore.getState().adjustRecipeCount(1);

      // Best-effort: increment fork count on public index
      try {
        await updateDoc(doc(db, 'publicRecipeIndex', recipeId), {
          forkCount: increment(1),
        });
      } catch { /* may fail if rules don't allow — that's ok */ }

      toast.success(`Forked "${recipeName}" to your recipes`);
      router.push(`/recipes/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fork recipe');
    } finally {
      setIsForking(false);
    }
  }

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={signInWithGoogle}>
        Sign in to save this recipe
      </Button>
    );
  }

  return (
    <Button variant="neon" size="sm" onClick={handleFork} loading={isForking}>
      Fork to My Recipes
    </Button>
  );
}
