import Link from "next/link";
import type { Metadata } from "next";
import Home from "@/views/Home";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

export const revalidate = 3600; // refresh recent recipes hourly

export const metadata: Metadata = {
  title: "Brewing.It - Homebrewing Recipe Builder & Calculator",
  description:
    "Gravity calculators, brew-day math, and a recipe builder that understands your system. Built for brewers who care about the details.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Brewing.It",
  url: "https://brewing.it.com",
  description:
    "Homebrewing recipe builder and calculator. Design recipes with real-time calculations for ABV, IBU, SRM, water chemistry, and mash pH.",
  publisher: {
    "@type": "Organization",
    name: "Brewing.It",
    url: "https://brewing.it.com",
  },
};

interface RecentRecipe {
  name: string;
  style: string;
  ownerName: string;
  ownerId: string;
  shareSlug: string;
  tags: string[];
  forkCount: number;
  publishedAt: string;
  stats: { abv: number; ibu: number; srm: number; og: number; fg: number };
}

async function getRecentRecipes(): Promise<RecentRecipe[]> {
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

export default async function HomePage() {
  const recentRecipes = await getRecentRecipes();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Home />

      {/* ── Recent Recipes ── */}
      {recentRecipes.length > 0 && (
        <div className="px-4 pb-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="brew-section !mb-0" data-accent="grain">
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p
                    className="mb-1 text-[10px] font-bold tracking-[0.18em] uppercase"
                    style={{ color: "var(--fg-muted)" }}
                  >
                    Community
                  </p>
                  <h2
                    className="inline-block pb-1 text-2xl font-extrabold tracking-tight"
                    style={{
                      color: "var(--fg-strong)",
                      borderBottom: "3px solid var(--brew-accent-500)",
                    }}
                  >
                    Fresh from the community.
                  </h2>
                </div>
                <Link
                  href="/browse"
                  className="shrink-0 pb-0.5 text-xs font-semibold tracking-widest uppercase transition-colors"
                  style={{ color: "var(--coral-500)" }}
                >
                  Browse all →
                </Link>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {recentRecipes.map((recipe) => {
                  const srmColor = srmToRgb(recipe.stats.srm);
                  return (
                    <div
                      key={recipe.shareSlug}
                      className="brew-recipe-card brew-recipe-card--ghost group"
                      style={{ "--card-srm": srmColor } as React.CSSProperties}
                    >
                      {/* Hidden crawlable link */}
                      <Link
                        href={`/r/${recipe.shareSlug}`}
                        className="absolute inset-0 z-0"
                        tabIndex={-1}
                        aria-hidden
                        prefetch={false}
                      >
                        <span className="sr-only">{recipe.name}</span>
                      </Link>

                      <div className="overflow-hidden rounded-xl">
                        {/* SRM color strip */}
                        <div
                          className="h-2 w-full rounded-t-xl"
                          style={{ backgroundColor: srmColor }}
                        />

                        {/* Header */}
                        <div className="border-b border-[rgb(var(--brew-border))] p-4">
                          <p
                            className="leading-snug font-extrabold tracking-tight"
                            style={{ fontSize: "clamp(1rem, 4cqw, 1.25rem)" }}
                          >
                            {recipe.name}
                          </p>
                          {recipe.style && (
                            <p className="text-muted mt-0.5 truncate text-xs italic">
                              {recipe.style}
                            </p>
                          )}
                          <p className="text-muted mt-1 text-xs">
                            by {recipe.ownerName}
                            {recipe.forkCount > 0 && (
                              <span className="ml-2 opacity-60">
                                {recipe.forkCount} {recipe.forkCount === 1 ? "fork" : "forks"}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-0 px-4 py-3">
                          {[
                            { label: "ABV", value: `${recipe.stats.abv.toFixed(1)}%` },
                            { label: "IBU", value: String(Math.round(recipe.stats.ibu)) },
                            { label: "OG", value: recipe.stats.og.toFixed(3) },
                            { label: "FG", value: recipe.stats.fg.toFixed(3) },
                          ].map((stat, si) => (
                            <div
                              key={stat.label}
                              className={
                                si > 0
                                  ? "border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2"
                                  : "pr-2"
                              }
                            >
                              <div className="brew-gauge-label text-[10px]">{stat.label}</div>
                              <div className="font-handwritten-alt text-sm tabular-nums">
                                {stat.value}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Tags */}
                        {recipe.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 px-4 pb-3">
                            {recipe.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="brew-tag">
                                {tag}
                              </span>
                            ))}
                            {recipe.tags.length > 3 && (
                              <span className="brew-tag">+{recipe.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
