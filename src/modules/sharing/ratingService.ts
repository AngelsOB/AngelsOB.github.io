/**
 * Client-side rating service.
 * Manages 1-5 star ratings using compound doc IDs: {recipeId}__{userId}
 * Updates aggregate counters on publicRecipeIndex using Firestore increment().
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Rating {
  recipeId: string;
  userId: string;
  value: number; // 1-5
  createdAt: string;
}

function ratingDocId(recipeId: string, userId: string) {
  return `${recipeId}__${userId}`;
}

/** Get the current user's rating for a recipe, or null. */
export async function getUserRating(
  recipeId: string,
  userId: string,
): Promise<number | null> {
  const snap = await getDoc(doc(db, 'ratings', ratingDocId(recipeId, userId)));
  if (!snap.exists()) return null;
  return snap.data().value as number;
}

/** Submit or update a rating. Updates aggregate counters on publicRecipeIndex. */
export async function submitRating(
  recipeId: string,
  userId: string,
  value: number,
): Promise<void> {
  if (value < 1 || value > 5 || !Number.isInteger(value)) {
    throw new Error('Rating must be an integer between 1 and 5');
  }

  const ratingRef = doc(db, 'ratings', ratingDocId(recipeId, userId));
  const indexRef = doc(db, 'publicRecipeIndex', recipeId);
  const existing = await getDoc(ratingRef);

  if (existing.exists()) {
    const oldValue = existing.data().value as number;
    if (oldValue === value) return; // no change

    // Update existing rating
    await setDoc(ratingRef, {
      recipeId,
      userId,
      value,
      createdAt: existing.data().createdAt,
      updatedAt: new Date().toISOString(),
    });

    // Adjust aggregate: add diff
    await updateDoc(indexRef, {
      ratingSum: increment(value - oldValue),
    }).catch(() => {});
  } else {
    // New rating
    await setDoc(ratingRef, {
      recipeId,
      userId,
      value,
      createdAt: new Date().toISOString(),
    });

    // Increment aggregate
    await updateDoc(indexRef, {
      ratingSum: increment(value),
      ratingCount: increment(1),
    }).catch(() => {});
  }
}

/** Remove a rating. Decrements aggregate counters. */
export async function removeRating(
  recipeId: string,
  userId: string,
): Promise<void> {
  const ratingRef = doc(db, 'ratings', ratingDocId(recipeId, userId));
  const existing = await getDoc(ratingRef);
  if (!existing.exists()) return;

  const oldValue = existing.data().value as number;
  await deleteDoc(ratingRef);

  // Decrement aggregate
  const indexRef = doc(db, 'publicRecipeIndex', recipeId);
  await updateDoc(indexRef, {
    ratingSum: increment(-oldValue),
    ratingCount: increment(-1),
  }).catch(() => {});
}
