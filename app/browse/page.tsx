import type { Metadata } from "next";
import Link from "next/link";

import HSBrowsePage from "@/modules/builder/components/public/HSBrowsePage";
import type { BrowseRecipe } from "@/modules/builder/components/public/HSBrowseCard";
import { hsTokens } from "@/modules/builder/tokens";
import { SEED_RECIPES, SEED_SLUG_MAP } from "@/data/seed-recipes";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Browse Recipes",
  alternates: { canonical: "/browse" },
  description:
    "Discover homebrewing recipes shared by the community. Find inspiration for your next brew.",
  openGraph: {
    title: "Browse Recipes | Brewing.It",
    description:
      "Discover homebrewing recipes shared by the community. Find inspiration for your next brew.",
  },
  twitter: {
    card: "summary",
    title: "Browse Recipes | Brewing.It",
    description:
      "Discover homebrewing recipes shared by the community. Find inspiration for your next brew.",
  },
};

interface SeoRecipeEntry {
  name: string;
  style: string;
  shareSlug: string;
}

async function loadPublicRecipes(): Promise<{
  cards: BrowseRecipe[];
  seoEntries: SeoRecipeEntry[];
}> {
  try {
    const { adminDb } = await import("@/config/firebase-admin");
    const snapshot = await adminDb
      .collection("publicRecipeIndex")
      .orderBy("publishedAt", "desc")
      .get();

    const cards: BrowseRecipe[] = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const ratingSum = Number(data.ratingSum ?? 0);
      const ratingCount = Number(data.ratingCount ?? 0);
      const stats = (data.stats as BrowseRecipe["stats"]) ?? {};
      return {
        id: doc.id,
        name: (data.name as string) || "",
        subtitle: (data.subtitle as string | undefined) ?? undefined,
        style: (data.style as string) || "",
        ownerName: (data.ownerName as string) || "Anonymous Brewer",
        ownerId: (data.ownerId as string) || "",
        shareSlug: (data.shareSlug as string) || "",
        stats,
        tags: (data.tags as string[]) ?? [],
        hopNames: (data.hopNames as string[]) ?? [],
        publishedAt: (data.publishedAt as string) || "",
        forkCount: Number(data.forkCount ?? 0),
        ratingSum,
        ratingCount,
        ratingAvg: ratingCount > 0 ? ratingSum / ratingCount : 0,
        labelUrl: (data.labelUrl as string | undefined) ?? undefined,
        source: (data.source as BrowseRecipe["source"]) ?? undefined,
      };
    });

    const seoEntries: SeoRecipeEntry[] = cards.slice(0, 100).map((c) => ({
      name: c.name || "Untitled Recipe",
      style: c.style,
      shareSlug: c.shareSlug,
    }));

    return { cards, seoEntries };
  } catch {
    return { cards: [], seoEntries: [] };
  }
}

export default async function BrowsePage() {
  const { cards, seoEntries } = await loadPublicRecipes();

  return (
    <>
      <HSBrowsePage initialRecipes={cards} />
      {/* Server-rendered recipe links — visually hidden, crawlable by search engines */}
      <nav aria-label="All community recipes" className="sr-only">
        <h2>All Recipes</h2>
        <ul>
          {SEED_RECIPES.map((r) => (
            <li key={r.id}>
              <Link
                href={`/r/${SEED_SLUG_MAP[r.id] || r.id}`}
                prefetch={false}
                style={{ color: hsTokens.ink, textDecoration: "underline" }}
              >
                {r.name}
              </Link>
              {r.style ? <span> ({r.style})</span> : null}
            </li>
          ))}
          {seoEntries.map((r) => (
            <li key={r.shareSlug}>
              <Link
                href={`/r/${r.shareSlug}`}
                prefetch={false}
                style={{ color: hsTokens.ink, textDecoration: "underline" }}
              >
                {r.name}
              </Link>
              {r.style ? <span> ({r.style})</span> : null}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
