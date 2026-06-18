"use client";

import { useState } from "react";
import Link from "next/link";

import { hsTokens } from "../../tokens";
import HSCard from "../HSCard";
import HSBrowseCard, { type BrowseRecipe } from "./HSBrowseCard";

const TILT_CYCLE = [-0.6, 0.5, -0.4, 0.7, -0.3, 0.6];

interface Props {
  ownerName: string;
  recipeCount: number;
  topStyles: string[];
  initialRecipes: BrowseRecipe[];
}

export default function HSUserProfile({
  ownerName,
  recipeCount,
  topStyles,
  initialRecipes,
}: Props) {
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const hasRecipes = initialRecipes.length > 0;

  return (
    <section
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/browse"
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 14,
          }}
        >
          ← Back to browse
        </Link>
        <h1
          style={{
            margin: "6px 0 0",
            fontFamily: hsTokens.display,
            fontSize: "clamp(44px, 6vw, 80px)",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            wordBreak: "break-word",
          }}
        >
          {ownerName}
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: hsTokens.body,
            fontSize: 14,
            color: hsTokens.muted,
            maxWidth: 640,
          }}
        >
          {recipeCount} {recipeCount === 1 ? "public recipe" : "public recipes"}
          {topStyles.length > 0 ? ` · ${topStyles.join(", ")}` : ""}
        </p>
      </div>

      {hasRecipes ? (
        <div
          className="hs-browse-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          {initialRecipes.map((recipe, idx) => (
            <HSBrowseCard
              key={recipe.id}
              recipe={recipe}
              isNavigating={navigatingId === recipe.id}
              onNavigate={() => setNavigatingId(recipe.id)}
              tilt={TILT_CYCLE[idx % TILT_CYCLE.length]}
            />
          ))}
        </div>
      ) : (
        <HSCard shadow={2} padding={32} style={{ textAlign: "center" }}>
          <div
            style={{
              marginTop: 8,
              fontFamily: hsTokens.display,
              fontSize: 28,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Nothing shared.
          </div>
          <p
            style={{
              marginTop: 8,
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.muted,
            }}
          >
            When {ownerName} publishes a recipe it shows up here.
          </p>
        </HSCard>
      )}

      <style>{`
        .hs-browse-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        @media (max-width: 1024px) {
          .hs-browse-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .hs-browse-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
