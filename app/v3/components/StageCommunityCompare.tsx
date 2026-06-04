"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import type { CommunityRecipeCard } from "../../_home/lib/communityCard";
import { STAGES } from "../data";
import StageEyebrow from "./StageEyebrow";

// Stage 8. In the scaffold, just the copy. Mock fades to ~40% and community
// cards + compare view get built in task #6. Cards data is passed through
// to whatever lands here next.
export default function StageCommunityCompare({
  recipes,
}: {
  recipes: CommunityRecipeCard[];
}) {
  return (
    <section
      style={{
        paddingTop: "clamp(56px, 8vw, 96px)",
        paddingBottom: "clamp(56px, 8vw, 96px)",
      }}
    >
      <StageEyebrow>{STAGES.community.h2}</StageEyebrow>
      <p
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(24px, 2.8vw, 32px)",
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
          color: hsTokens.ink,
          margin: "10px 0 18px",
          maxWidth: 540,
        }}
      >
        {STAGES.community.intro}
      </p>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 17,
          lineHeight: 1.6,
          color: hsTokens.muted,
          maxWidth: 480,
        }}
      >
        {STAGES.community.compareIntro}
      </p>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 17,
          lineHeight: 1.6,
          color: hsTokens.ink,
          maxWidth: 480,
          marginTop: 14,
        }}
      >
        {STAGES.community.closer}
      </p>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 12,
          color: hsTokens.muted,
          marginTop: 24,
          fontStyle: "italic",
        }}
      >
        scaffold: {recipes.length} community recipe{recipes.length === 1 ? "" : "s"} loaded, cards + compare view land in task #6.
      </p>
    </section>
  );
}
