import { doc, getDoc } from "firebase/firestore";

import { db } from "@/config/firebase";
import { findSeedRecipe, SEED_SLUG_MAP } from "@/data/seed-recipes";
import type { Recipe } from "@/modules/recipe/models/Recipe";

import type { BrowseRecipe } from "./HSBrowseCard";

export async function loadFullPublicRecipe(
  recipe: BrowseRecipe,
): Promise<Recipe | null> {
  if (recipe.source === "official") {
    return findSeedRecipe(recipe.id) ?? null;
  }
  const snap = await getDoc(doc(db, "recipes", recipe.id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Recipe;
}

export function cardPathFor(recipe: BrowseRecipe): string {
  return recipe.source === "official"
    ? `/r/${SEED_SLUG_MAP[recipe.id] || recipe.id}`
    : `/r/${recipe.shareSlug}`;
}
