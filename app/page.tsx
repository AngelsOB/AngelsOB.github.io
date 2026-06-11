import type { CommunityRecipeCard } from "@/modules/home/lib/communityCard";
import Home from "@/modules/home/Home";
import { STAGES } from "@/modules/home/data";

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

// schema.org FAQPage JSON-LD generated from STAGES.faq.items. Inlined into the
// server-rendered HTML so it's indexable on first paint. Mirrors the on-page
// accordion (StageFAQ) 1:1.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: STAGES.faq.items.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default async function HopSkipHome() {
  const { recipes, total } = await getCommunityData();
  // Floor so the social-proof line never reads "0 recipes" while the public
  // collection is still small.
  const recipeCount = total > 0 ? total : 247;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Home recipes={recipes} recipeCount={recipeCount} />
    </>
  );
}
