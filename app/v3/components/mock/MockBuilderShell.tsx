"use client";

import { BrewsheetBone, type BrewsheetBoneState } from "./BrewsheetBone";
import { MockBuilder } from "./MockBuilder";
import type { Highlight, TabKey } from "./types";

// MockBuilderShell is the v3 tour's sticky-right-column visual root.
// Composes the bone-based MockBuilder + any overlay bones (currently
// just the Brewsheet bone since it needs to escape the section card
// boundaries entirely when in panel state).

interface Props {
  /** Forwarded to MockBuilder for click-driven tab switching. */
  activeTab: TabKey | undefined;
  onTabChange: (tab: TabKey) => void;
  /** Drives every bone's state. */
  highlight: Highlight;
  /** Whether the content reveal cascade inside BrewSheetPanel is playing. */
  contentPlaying: boolean;
}

export function MockBuilderShell({
  activeTab,
  onTabChange,
  highlight,
  contentPlaying,
}: Props) {
  const brewsheetState: BrewsheetBoneState =
    highlight === "brewsheet" ? "panel" : "tab";

  return (
    <div style={{ position: "relative" }}>
      <MockBuilder
        highlight={highlight}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      {/* Overlay bones — rendered as siblings so they can escape the
          mock card's layout. */}
      <BrewsheetBone state={brewsheetState} contentPlaying={contentPlaying} />
    </div>
  );
}
