import type { Metadata } from "next";
import Link from "next/link";

import HSUserProfile from "@/modules/hopskip/components/public/HSUserProfile";
import type { BrowseRecipe } from "@/modules/hopskip/components/public/HSBrowseCard";
import { hsTokens } from "@/modules/hopskip/tokens";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userId: string }>;
}

interface ProfileData {
  ownerName: string;
  recipeCount: number;
  topStyles: string[];
  recipes: BrowseRecipe[];
}

async function loadProfile(userId: string): Promise<ProfileData> {
  try {
    const { adminDb } = await import("@/config/firebase-admin");
    const snapshot = await adminDb
      .collection("publicRecipeIndex")
      .where("ownerId", "==", userId)
      .orderBy("publishedAt", "desc")
      .get();

    const recipes: BrowseRecipe[] = snapshot.docs.map((doc) => {
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

    const ownerName =
      recipes.find((r) => r.ownerName && r.ownerName !== "Anonymous Brewer")
        ?.ownerName ||
      recipes[0]?.ownerName ||
      "Brewer";

    const counts = new Map<string, number>();
    for (const r of recipes) {
      if (r.style) counts.set(r.style, (counts.get(r.style) || 0) + 1);
    }
    const topStyles = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([style]) => style);

    return {
      ownerName,
      recipeCount: recipes.length,
      topStyles,
      recipes,
    };
  } catch {
    return { ownerName: "Brewer", recipeCount: 0, topStyles: [], recipes: [] };
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params;
  const { ownerName, recipeCount } = await loadProfile(userId);

  const hasRecipes = recipeCount > 0;
  const title = hasRecipes ? ownerName : "Brewer Profile";
  const description = hasRecipes
    ? `${recipeCount} public brewing ${recipeCount === 1 ? "recipe" : "recipes"} by ${ownerName} on Brewing.It`
    : "View public recipes by this brewer on Brewing.It";

  return {
    title,
    description,
    alternates: { canonical: `/u/${userId}` },
    openGraph: {
      title: `${title} | Brewing.It`,
      description,
      url: `/u/${userId}`,
      type: "profile",
      siteName: "Brewing.It",
    },
    twitter: {
      card: "summary",
      title: `${title} | Brewing.It`,
      description,
    },
  };
}

export default async function UserProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const { ownerName, recipeCount, topStyles, recipes } = await loadProfile(userId);

  return (
    <>
      <HSUserProfile
        ownerName={ownerName}
        recipeCount={recipeCount}
        topStyles={topStyles}
        initialRecipes={recipes}
      />
      {/* Server-rendered recipe links — visually hidden, crawlable by search engines */}
      {recipes.length > 0 ? (
        <nav aria-label={`Recipes by ${ownerName}`} className="sr-only">
          <h2>Recipes by {ownerName}</h2>
          <ul>
            {recipes.map((r) => (
              <li key={r.shareSlug || r.id}>
                <Link
                  href={`/r/${r.shareSlug}`}
                  prefetch={false}
                  style={{ color: hsTokens.ink, textDecoration: "underline" }}
                >
                  {r.name || "Untitled Recipe"}
                </Link>
                {r.style ? <span> ({r.style})</span> : null}
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </>
  );
}
