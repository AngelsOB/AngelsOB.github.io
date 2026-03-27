import type { Metadata } from "next";
import Link from "next/link";
import BrowseRecipesPage from "../../src/modules/sharing/BrowseRecipesPage";
import { SEED_RECIPES } from "@/data/seed-recipes";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

export const metadata: Metadata = {
  title: "Browse Recipes",
  description:
    "Discover homebrewing recipes shared by the community. Find inspiration for your next brew.",
};

async function getRecipeIndex() {
  try {
    const { adminDb } = await import("@/config/firebase-admin");
    const snapshot = await adminDb
      .collection("publicRecipeIndex")
      .orderBy("publishedAt", "desc")
      .limit(100)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        name: data.name || "Untitled Recipe",
        style: data.style || "",
        shareSlug: data.shareSlug as string,
        ownerName: data.ownerName || "Anonymous Brewer",
      };
    });
  } catch {
    return [];
  }
}

export default async function BrowsePage() {
  const recipes = await getRecipeIndex();

  return (
    <>
      <BrowseRecipesPage />
      {/* Server-rendered recipe links for search engine crawlability */}
      <nav aria-label="All community recipes" className="mx-auto max-w-6xl px-2 pb-8">
        <h2 className="brew-section-title mb-4 text-lg">All Recipes</h2>
        <ul className="columns-2 gap-x-6 sm:columns-3 text-sm">
          {SEED_RECIPES.map((r) => (
            <li key={r.id} className="mb-1">
              <Link href={`/r/seed/${r.id}`} className="text-[var(--brew-accent-700)] hover:underline" prefetch={false}>
                {r.name}
              </Link>
              {r.style && <span className="text-muted ml-1 text-xs">({r.style})</span>}
            </li>
          ))}
          {recipes.map((r) => (
            <li key={r.shareSlug} className="mb-1">
              <Link href={`/r/${r.shareSlug}`} className="text-[var(--brew-accent-700)] hover:underline" prefetch={false}>
                {r.name}
              </Link>
              {r.style && <span className="text-muted ml-1 text-xs">({r.style})</span>}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
