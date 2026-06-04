import type { CommunityRecipeCard } from "../_home/lib/communityCard";
import HomeV4 from "./HomeV4";

// Ported from app/v3/page.tsx — identical server fetch. Production swap
// (Phase 9) points app/page.tsx at this same data + HomeV4.
export const revalidate = 3600;

async function getCommunityData(): Promise<{
  recipes: CommunityRecipeCard[];
  total: number;
}> {
  try {
    const { adminDb } = await import("@/config/firebase-admin");
    const collection = adminDb.collection("publicRecipeIndex");

    const [snapshot, countSnap] = await Promise.all([
      collection.orderBy("publishedAt", "desc").limit(6).get(),
      collection.count().get(),
    ]);

    const recipes: CommunityRecipeCard[] = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        name: d.name || "Untitled Recipe",
        style: d.style || "",
        ownerName: d.ownerName || "Anonymous Brewer",
        ownerId: d.ownerId || "",
        shareSlug: d.shareSlug as string,
        tags: d.tags || [],
        forkCount: d.forkCount ?? 0,
        publishedAt: d.publishedAt || "",
        stats: {
          abv: d.stats?.abv ?? 0,
          ibu: d.stats?.ibu ?? 0,
          srm: d.stats?.srm ?? 4,
          og: d.stats?.og ?? 0,
          fg: d.stats?.fg ?? 0,
        },
      };
    });

    const total =
      typeof countSnap.data === "function" ? countSnap.data().count ?? 0 : 0;

    return { recipes, total };
  } catch {
    return { recipes: [], total: 0 };
  }
}

export default async function HomeV4Page() {
  const { recipes, total } = await getCommunityData();
  const recipeCount = total > 0 ? total : 247;
  return <HomeV4 recipes={recipes} recipeCount={recipeCount} />;
}
