import type { Metadata } from "next";

import { hsTokens } from "@/modules/builder/tokens";

import RecipesHubClient from "./RecipesHubClient";

// Deliberately not indexed: this is an app hub (your recipes + recents), not a
// content page. The crawlable community surface is /browse and the /r/ pages;
// robots.txt also disallows /recipes/.
export const metadata: Metadata = {
  title: "Recipes",
  robots: { index: false, follow: false },
  description:
    "Your own brews and the community's. Pick up where you left off, or steal an idea.",
};

// Cache the community fetch for an hour — same cadence as the homepage's
// community block. Both surfaces consume publicRecipeIndex; the route is
// also revalidated on publish/unpublish elsewhere.
export const revalidate = 3600;

interface CommunityPreview {
  id: string;
  name: string;
  subtitle?: string;
  style: string;
  ownerName: string;
  shareSlug: string;
  tags: string[];
  stats: { abv?: number; ibu?: number; og?: number; fg?: number; srm?: number };
}

async function loadCommunityPreview(): Promise<CommunityPreview[]> {
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
        id: doc.id,
        name: (d.name as string) || "Untitled Recipe",
        subtitle: (d.subtitle as string | undefined) ?? undefined,
        style: (d.style as string) || "",
        ownerName: (d.ownerName as string) || "Anonymous Brewer",
        shareSlug: (d.shareSlug as string) || doc.id,
        tags: (d.tags as string[]) || [],
        stats: {
          abv: d.stats?.abv,
          ibu: d.stats?.ibu,
          og: d.stats?.og,
          fg: d.stats?.fg,
          srm: d.stats?.srm,
        },
      };
    });
  } catch {
    return [];
  }
}

export default async function RecipesHubPage() {
  const community = await loadCommunityPreview();

  return (
    <main>
      {/* Title bar */}
      <section
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) 20px",
        }}
      >
        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 6vw, 88px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.9,
            margin: "10px 0 0",
            color: hsTokens.ink,
          }}
        >
          <span
            style={{
              background: hsTokens.malt,
              padding: "0 0.18em",
              display: "inline-block",
              transform: "rotate(-1.5deg)",
              border: `2px solid ${hsTokens.ink}`,
              boxShadow: hsTokens.sh1,
            }}
          >
            Recipes
          </span>
        </h1>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 15,
            lineHeight: 1.55,
            color: hsTokens.muted,
            maxWidth: 540,
            marginTop: 18,
          }}
        >
          Your shelf and the community&apos;s pour, side by side. Pick up a
          draft, or steal an idea.
        </p>
      </section>

      <section
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 56px) clamp(40px, 6vw, 96px)",
        }}
      >
        <RecipesHubClient community={community} />
      </section>
    </main>
  );
}
