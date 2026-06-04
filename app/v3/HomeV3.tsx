"use client";

import { useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import type { CommunityRecipeCard } from "../_home/lib/communityCard";
import StageHero from "./components/StageHero";
import StageOpening from "./components/StageOpening";
import StageGrains from "./components/StageGrains";
import StageHops from "./components/StageHops";
import StageWater from "./components/StageWater";
import StageBrewSheet from "./components/StageBrewSheet";
import StageBrewedAgain from "./components/StageBrewedAgain";
import StageCommunityCompare from "./components/StageCommunityCompare";
import StageWhatElse from "./components/StageWhatElse";
import StageLearn from "./components/StageLearn";
import StageFAQ from "./components/StageFAQ";
import StageFinalCTA from "./components/StageFinalCTA";
import TourMock, { type MockState, useReducedMotion } from "./components/TourMock";
import type { TabKey } from "./components/mock/types";

interface Props {
  recipes: CommunityRecipeCard[];
  recipeCount: number;
}

/**
 * v3 homepage. Lives at /v3 during build; will replace app/_home/Home.tsx
 * when ready. The sticky right-column mock starts in auto-rotate mode (hero
 * showcase) and switches to scroll-driven tab control as soon as the visitor
 * scrolls past stage 2.
 */
export default function HomeV3({ recipes, recipeCount }: Props) {
  // null = no scroll-driven tab yet (auto-rotate still owns the mock). Once
  // any tour stage enters view, this becomes non-null and stays that way for
  // the rest of the session per PRD section 5 ("auto-rotate disables and
  // does not re-enable").
  const [scrollTab, setScrollTab] = useState<TabKey | null>(null);
  const setTab = (tab: TabKey) => setScrollTab(tab);

  // mockState drives the bone choreography. Each stage onEnter sets a
  // different value — that value flows down to TourMock → MockBuilderShell
  // → every bone, which choose their animation state accordingly.
  const [mockState, setMockState] = useState<MockState>("default");

  const reducedMotion = useReducedMotion();
  return (
    <div
      style={{
        background: hsTokens.cream,
        // `overflow: clip` (both axes) instead of `overflowX: hidden`.
        // `hidden` creates a scroll context that breaks `position: sticky`
        // on every descendant. Per the CSS Overflow spec, setting only
        // overflow-x to clip while overflow-y stays visible computes
        // overflow-y to auto — which ALSO breaks sticky. So clip both
        // axes; the page still scrolls via html/body so visible scroll
        // is unaffected, the sticky element uses the document as its
        // scroll context, and horizontal overflow (from AmbientBlobs and
        // wide hero cards on narrow viewports) is still clipped.
        overflow: "clip",
        position: "relative",
      }}
    >
      <AmbientBlobs />

      {/* Tour: stages 1–8 share a sticky right-column mock.
          alignItems intentionally omitted (default `stretch`): the right
          column needs to grow to the full tour height so position:sticky
          inside it can scroll across all 8 stages. With alignItems:start
          the right column collapsed to its content height (~700px), the
          sticky un-stuck after one viewport of scroll, and the mock
          disappeared before stage 4. */}
      <div
        className="v3-tour"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding:
            "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          gap: 48,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div className="v3-tour-left" style={{ minWidth: 0 }}>
          <StageHero recipeCount={recipeCount} />
          <StageOpening />
          <StageGrains
            onEnter={() => {
              setTab("fermentables");
              setMockState("fermentables");
            }}
            onLeave={() =>
              setMockState((curr) =>
                curr === "fermentables" ? "default" : curr,
              )
            }
          />
          <StageHops
            onEnter={() => {
              setTab("hops");
              setMockState("hops");
            }}
            onLeave={() =>
              setMockState((curr) => (curr === "hops" ? "default" : curr))
            }
          />
          <StageWater
            onEnter={() => {
              setTab("water");
              setMockState("water");
            }}
            onLeave={() =>
              setMockState((curr) => (curr === "water" ? "default" : curr))
            }
          />
          <StageBrewSheet
            onEnter={() => {
              setMockState("brewsheet");
            }}
            onLeave={() =>
              setMockState((curr) =>
                curr === "brewsheet" ? "default" : curr,
              )
            }
          />
          <StageBrewedAgain />
          <StageCommunityCompare recipes={recipes} />
        </div>

        <div className="v3-tour-right" style={{ position: "relative", minWidth: 0 }}>
          <div
            className="v3-sticky-mock"
            style={{
              position: "sticky",
              // Vertical-center the mock in the visible viewport area below
              // the hs-header (which is itself sticky at top:0, ~92px tall).
              // 50vh - 290px centers a ~670px mock under a 92px header on
               // typical viewport heights; clamped so the mock stays below
              // the header on short viewports and doesn't drift too far
              // down on tall ones.
              top: "clamp(112px, calc(50vh - 290px), 280px)",
            }}
          >
            <TourMock
              controlledTab={scrollTab ?? undefined}
              onTabChange={setTab}
              mockState={mockState}
              reducedMotion={reducedMotion}
            />
          </div>
        </div>
      </div>

      {/* Below the tour: full-width stages. No mock. */}
      <StageWhatElse />
      <StageLearn />
      <StageFAQ />
      <StageFinalCTA />

      <style>{`
        @media (max-width: 1024px) {
          .v3-tour {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
          .v3-sticky-mock {
            position: relative !important;
            top: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

// Reused from SectionHero. Soft cream/malt/water/hops blobs in the top corners.
// Subtle, ambient, no parallax. Lives behind the tour container.
function AmbientBlobs() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "5%",
          width: 320,
          height: 320,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.malt} 18%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "8%",
          width: 280,
          height: 280,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.water} 14%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
    </div>
  );
}
