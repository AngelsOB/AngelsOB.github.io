"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import { MockHeader } from "./MockHeader";
import { MockStats } from "./MockStats";
import { MockTabBar } from "./MockTabBar";
import { FermentablesContent } from "./sections/FermentablesContent";
import { HopsContent } from "./sections/HopsContent";
import { WaterContent } from "./sections/WaterContent";
import { MashContent } from "./sections/MashContent";
import { YeastContent } from "./sections/YeastContent";
import { type Highlight, type TabKey, highlightToTab } from "./types";

// MockBuilder. Brewsheet-style recede applied to every highlight.
//
// Three phases per section highlight:
//   Phase 1 (0ms): tab change. activeTab updates immediately. The
//                  section content in the slot swaps inline. Mock at
//                  full opacity.
//   Phase 2 (~400ms): mock recedes left like the brewsheet does
//                     (scale 0.7, opacity 0.35, x -28). The section
//                     content overlay (sibling of mock, escapes the
//                     recede) becomes the focal frame at the same slot
//                     position the inline content was in, now at full
//                     opacity. Visually the mock goes off to the left
//                     while the section stays put as the main frame.
//   Phase 3 (~1000ms): sub-bones inside the focal section explode out
//                      further. HopVisualizer / SaltCells / AutoCalc /
//                      PhCallout fire their lift transforms.
//
// Between stages (onLeave clears the highlight): everything closes back
// to the default editor. Mock returns to full visibility, section
// overlay unmounts.

interface Props {
  highlight: Highlight;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

// Slot position for the section overlay. Matches where the section card
// sits inside the mock card so the overlay visually replaces it without
// any motion — only the mock recedes.
const SLOT_TOP = 280;
const SLOT_LEFT = 18;
const SLOT_RIGHT = 18;
const SLOT_HEIGHT = 360;

export function MockBuilder({
  highlight,
  activeTab: controlledTab,
  onTabChange,
}: Props) {
  const [internalTab, setInternalTab] = useState<TabKey>("fermentables");
  const derived = highlightToTab(highlight);
  const activeTab: TabKey = controlledTab ?? derived ?? internalTab;
  const setTab = (tab: TabKey) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  const sectionFocus = derived !== null;
  const brewsheetFocus = highlight === "brewsheet";
  const anyFocus = sectionFocus || brewsheetFocus;

  // Phase state machine.
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    if (highlight === "none") {
      setPhase(0);
      return;
    }
    setPhase(1);
    const t2 = setTimeout(() => setPhase(2), 400);
    const t3 = setTimeout(() => setPhase(3), 1000);
    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [highlight]);

  // Mock recedes when phase 2 hits (after tab change settles).
  const mockRecedes = anyFocus && phase >= 2;
  // Section overlay is the focal frame during section focus once mock
  // has receded.
  const sectionOverlayActive = sectionFocus && phase >= 2;
  // Sub-bones inside the overlay explode at phase 3.
  const subBonesExploded = sectionFocus && phase >= 3;
  const effectiveHighlight: Highlight = subBonesExploded ? highlight : "none";

  return (
    <div style={{ position: "relative" }}>
      <motion.div
        animate={
          mockRecedes
            ? { opacity: 0.35, scale: 0.7, x: -28 }
            : { opacity: 1, scale: 1, x: 0 }
        }
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          transformOrigin: "left top",
          pointerEvents: mockRecedes ? "none" : "auto",
        }}
      >
        <div
          style={{
            background: hsTokens.cream,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 14,
            boxShadow: "6px 6px 0 var(--hs-ink)",
            padding: "16px 18px 18px",
            position: "relative",
          }}
        >
          <MockHeader />
          <MockStats />
          <MockTabBar
            activeTab={activeTab}
            highlight={highlight}
            onTabChange={setTab}
          />

          {/* Inline section card slot. Section content renders here during
              phase 0/1 (before mock recede) and at all times when the
              user is just clicking through tabs without a stage highlight.
              When the overlay is active, the inline content fades with
              the mock recede — the overlay sibling provides the focal
              version at full opacity. */}
          <div
            style={{
              position: "relative",
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderTop: "none",
              borderRadius: "0 0 14px 14px",
              boxShadow: "4px 4px 0 var(--hs-ink)",
              height: 360,
              overflow: "hidden",
            }}
          >
            {activeTab === "fermentables" && (
              <FermentablesContent highlight="none" />
            )}
            {activeTab === "hops" && <HopsContent highlight="none" />}
            {activeTab === "water" && <WaterContent highlight="none" />}
            {activeTab === "mash" && <MashContent />}
            {activeTab === "yeast" && <YeastContent />}
          </div>
        </div>
      </motion.div>

      {/* Section content OVERLAY — sibling of mock, escapes the recede.
          Sits at the original slot position so it visually stays put
          while the mock goes off to the left. The slot position is
          where the section card was inside the receding mock, so the
          overlay LOOKS like the section that stayed behind while the
          rest of the builder went away. */}
      {sectionOverlayActive ? (
        <motion.div
          data-bone={`section-overlay-${derived}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            top: SLOT_TOP,
            left: SLOT_LEFT,
            right: SLOT_RIGHT,
            height: SLOT_HEIGHT,
            background: hsTokens.paper,
            border: `2px solid var(--hs-ink)`,
            borderRadius: "0 0 14px 14px",
            boxShadow: "4px 4px 0 var(--hs-ink)",
            overflow: "visible",
            zIndex: 20,
          }}
        >
          {activeTab === "fermentables" && (
            <FermentablesContent highlight={effectiveHighlight} />
          )}
          {activeTab === "hops" && (
            <HopsContent highlight={effectiveHighlight} />
          )}
          {activeTab === "water" && (
            <WaterContent highlight={effectiveHighlight} />
          )}
          {activeTab === "mash" && <MashContent />}
          {activeTab === "yeast" && <YeastContent />}
        </motion.div>
      ) : null}
    </div>
  );
}
