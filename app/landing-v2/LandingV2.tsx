"use client";

import type { CommunityRecipeCard } from "@/modules/hopskip/components/HopSkipCommunitySection";
import SectionHero from "./components/SectionHero";
import SectionCommunity from "./components/SectionCommunity";
import SectionBrewDay from "./components/SectionBrewDay";
import SectionMath from "./components/SectionMath";
import SectionLearn from "./components/SectionLearn";

interface Props {
  recipes: CommunityRecipeCard[];
  recipeCount: number;
}

/**
 * The homepage candidate (now the default `/`). Renders the six narrative
 * sections in order. Chrome (HSHeader + HSFooter + hs-theme wrapper) is
 * provided by the global HSThemeWrapper via ClientShell, so this component
 * just renders its own content.
 */
export default function LandingV2({ recipes, recipeCount }: Props) {
  return (
    <div style={{ overflowX: "hidden" }}>
      <SectionHero recipeCount={recipeCount} />
      <SectionBrewDay />
      <SectionMath />
      <SectionLearn />
      <SectionCommunity recipes={recipes} />
    </div>
  );
}
