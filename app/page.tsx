import HopSkipHomeContent from "@/modules/hopskip/components/HopSkipHomeContent";
import HopSkipCommunitySection, {
  type CommunityRecipeCard,
} from "@/modules/hopskip/components/HopSkipCommunitySection";
import HopSkipLearnSection from "@/modules/hopskip/components/HopSkipLearnSection";

export const revalidate = 3600;

async function getRecentCommunityRecipes(): Promise<CommunityRecipeCard[]> {
  try {
    const { adminDb } = await import("@/config/firebase-admin");
    const snapshot = await adminDb
      .collection("publicRecipeIndex")
      .orderBy("publishedAt", "desc")
      .limit(6)
      .get();
    return snapshot.docs.map((doc) => {
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
  } catch {
    return [];
  }
}

export default async function HopSkipHome() {
  const community = await getRecentCommunityRecipes();

  return (
    <>
      <HopSkipHomeContent />
      {community.length > 0 ? <HopSkipCommunitySection recipes={community} /> : null}
      <HopSkipLearnSection />
    </>
  );
}
