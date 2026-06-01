"use client";

import HSHeader from "@/modules/hopskip/components/HSHeader";
import HSFooter from "@/modules/hopskip/components/HSFooter";
import { hsTokens } from "@/modules/hopskip/tokens";
import type { CommunityRecipeCard } from "@/modules/hopskip/components/HopSkipCommunitySection";
import SectionHero from "./components/SectionHero";
import SectionCommunity from "./components/SectionCommunity";
import SectionBrewDay from "./components/SectionBrewDay";
import SectionMath from "./components/SectionMath";
import SectionLibraryDemo from "./components/SectionLibraryDemo";
import SectionLearn from "./components/SectionLearn";

interface Props {
  recipes: CommunityRecipeCard[];
  recipeCount: number;
}

export default function LandingV2({ recipes, recipeCount }: Props) {
  return (
    <div
      className="hs-theme"
      style={{
        background: hsTokens.cream,
        color: hsTokens.ink,
        minHeight: "100dvh",
        fontFamily: hsTokens.body,
        overflowX: "hidden",
      }}
    >
      <HSHeader />
      <SectionHero recipeCount={recipeCount} />
      <SectionBrewDay />
      <SectionMath />
      <SectionLearn />
      <SectionCommunity recipes={recipes} />
      <SectionLibraryDemo />
      <HSFooter />
    </div>
  );
}
