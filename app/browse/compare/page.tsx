import type { Metadata } from "next";

import HSCompareRecipesPage from "@/modules/builder/components/public/HSCompareRecipesPage";
import type { Recipe } from "@/modules/recipe/models/Recipe";
import { findSeedRecipe } from "@/data/seed-recipes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare Recipes",
  alternates: { canonical: "/browse/compare" },
  description:
    "Compare multiple homebrew recipes side-by-side. Vitals, grains, hops, mash schedules, and water chemistry — all in one view.",
  openGraph: {
    title: "Compare Recipes | Brewing.It",
    description:
      "Compare multiple homebrew recipes side-by-side. Vitals, grains, hops, mash schedules, and water chemistry — all in one view.",
  },
  twitter: {
    card: "summary",
    title: "Compare Recipes | Brewing.It",
    description:
      "Compare multiple homebrew recipes side-by-side. Vitals, grains, hops, mash schedules, and water chemistry — all in one view.",
  },
};

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

async function loadCompareRecipes(idsParam: string): Promise<Recipe[]> {
  const ids = idsParam.split(",").filter(Boolean);
  if (ids.length < 2 || ids.length > 8) return [];

  const recipes: Recipe[] = [];
  const seedIds = ids.filter((id) => id.startsWith("seed-"));
  const firestoreIds = ids.filter((id) => !id.startsWith("seed-"));

  for (const id of seedIds) {
    const recipe = findSeedRecipe(id);
    if (recipe) recipes.push(recipe);
  }

  if (firestoreIds.length > 0) {
    try {
      const { adminDb } = await import("@/config/firebase-admin");
      const refs = firestoreIds.map((id) => adminDb.collection("recipes").doc(id));
      const snapshots = await adminDb.getAll(...refs);

      for (const snap of snapshots) {
        if (!snap.exists) continue;
        const data = snap.data() as Record<string, unknown>;
        if (!data.isPublic) continue;
        const { ownerId: _ownerId, id: _storedId, ...safeData } = data;
        recipes.push({ ...safeData, id: snap.id } as unknown as Recipe);
      }
    } catch {
      // Admin SDK unavailable — fall back to whatever seed recipes resolved.
    }
  }

  return recipes;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { ids } = await searchParams;
  const recipes = ids ? await loadCompareRecipes(ids) : [];

  return <HSCompareRecipesPage initialRecipes={recipes} />;
}
