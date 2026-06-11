/**
 * Client-side publish/unpublish service.
 * Writes directly to Firestore using the client SDK, avoiding the Admin SDK.
 */

import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { RecipeCalculationService } from '@/modules/recipe/services/RecipeCalculationService';
import { generateShareSlug } from './slugUtils';
import type { Recipe } from '@/modules/recipe/models/Recipe';

const calcService = new RecipeCalculationService();

/**
 * Ask the server to flush ISR caches (/, /browse, /r/[slug], ...) so a
 * publish/unpublish shows up immediately instead of after the hourly
 * revalidate. Fire-and-forget: a failure just means the regular ISR window
 * applies.
 */
function requestRevalidation(slug?: string): void {
  const user = auth.currentUser;
  if (!user) return;
  user
    .getIdToken()
    .then((token) =>
      fetch('/api/revalidate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slug: slug ?? null }),
      }),
    )
    .catch(() => { /* fire-and-forget */ });
}

/**
 * Publish a recipe: update the recipe doc and upsert publicRecipeIndex.
 * Returns the shareSlug.
 */
export async function publishRecipe(recipe: Recipe): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Must be signed in');

  const slug = recipe.shareSlug || generateShareSlug(recipe.name);
  const now = new Date().toISOString();
  const calc = calcService.calculate(recipe);

  const hopNames = Array.isArray(recipe.hops)
    ? [...new Set(recipe.hops.map((h) => h.name))]
    : [];

  // Preserve existing forkCount and rating aggregates
  const indexRef = doc(db, 'publicRecipeIndex', recipe.id);
  const indexSnap = await getDoc(indexRef);
  const existingData = indexSnap.exists() ? indexSnap.data() : null;
  const forkCount = existingData?.forkCount ?? 0;
  const ratingSum = existingData?.ratingSum ?? 0;
  const ratingCount = existingData?.ratingCount ?? 0;

  // Write publicRecipeIndex entry
  await setDoc(indexRef, {
    name: recipe.name,
    subtitle: recipe.subtitle || null,
    style: recipe.style || '',
    ownerName: user.displayName || 'Anonymous Brewer',
    ownerId: user.uid,
    shareSlug: slug,
    stats: {
      og: Math.round(calc.og * 1000) / 1000,
      fg: Math.round(calc.fg * 1000) / 1000,
      ibu: Math.round(calc.ibu),
      srm: Math.round(calc.srm * 10) / 10,
      abv: Math.round(calc.abv * 10) / 10,
    },
    tags: recipe.tags || [],
    labelUrl: recipe.labelUrl || null,
    hopNames,
    createdAt: recipe.createdAt,
    publishedAt: recipe.publishedAt || now,
    forkCount,
    ratingSum,
    ratingCount,
  });

  requestRevalidation(slug);

  return slug;
}

/**
 * Unpublish a recipe: delete from publicRecipeIndex.
 * The recipe doc's isPublic flag is managed by the caller.
 */
export async function unpublishRecipe(recipeId: string): Promise<void> {
  // Grab the slug before deleting so the cached /r/[slug] page can be
  // flushed too — otherwise it would keep serving for up to an hour.
  const indexRef = doc(db, 'publicRecipeIndex', recipeId);
  const indexSnap = await getDoc(indexRef);
  const slug = indexSnap.exists() ? (indexSnap.data().shareSlug as string | undefined) : undefined;

  await deleteDoc(indexRef);

  requestRevalidation(slug);
}

/**
 * Sync publicRecipeIndex in the background (fire-and-forget).
 * Silently fails if anything goes wrong.
 */
export function syncPublicIndex(recipe: Recipe): void {
  publishRecipe(recipe).catch(() => { /* fire-and-forget */ });
}
