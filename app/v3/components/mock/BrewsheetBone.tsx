"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import BrewSheetPanel from "../BrewSheetPanel";
import { Bone, type BoneStyle } from "./Bone";

// The Brewsheet bone. Same single DOM element that morphs between two
// named states: `"tab"` (small dark button at the right end of the tab
// bar) and `"panel"` (full brew sheet content lifted forward over the
// recessed mock).
//
// In future, this bone could grow more states (e.g. `"focus-callout"`
// where the Pre-Boil OG recovery sub-bone lifts further) without
// changing the wrapper.

export type BrewsheetBoneState = "tab" | "panel";

// Geometry tuned to the v3 sticky-mock layout. TAB sits at the right end
// of the mock's tab bar — `top: 264` aligns with the regular tab buttons'
// tops (measured live), `right: 16` matches the mock card's right inner
// padding so the bone's right edge is flush against the card edge.
// PANEL covers the upper part of the sticky area with the mock recessed
// behind it.
const STATES: Record<BrewsheetBoneState, BoneStyle> = {
  tab: {
    position: "absolute",
    top: 264,
    right: 16,
    width: 95,
    // Height matches the regular tab buttons (36 = padding 8+8 + content 12
    // + border 2*2, extending 2px past the tab bar bottom border just like
    // the active tab does via marginBottom:-2). Bottom edge sits flush
    // against the section card top.
    height: 36,
    background: hsTokens.ink,
    color: hsTokens.cream,
    borderRadius: "10px 0 0 0",
    padding: "8px 14px",
    border: "2px solid transparent",
    overflow: "hidden",
    fontFamily: hsTokens.body,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  panel: {
    position: "absolute",
    top: 10,
    right: 0,
    width: 580,
    height: "auto",
    background: hsTokens.cream,
    color: hsTokens.ink,
    borderRadius: 14,
    padding: 0,
    border: `2px solid var(--hs-ink)`,
    overflow: "hidden",
    fontFamily: hsTokens.body,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
};

interface Props {
  state: BrewsheetBoneState;
  contentPlaying: boolean;
}

export function BrewsheetBone({ state, contentPlaying }: Props) {
  const isPanel = state === "panel";
  return (
    <Bone<BrewsheetBoneState>
      id="brewsheet"
      states={STATES}
      state={state}
      zIndex={20}
    >
      {/* The drop-shadow needs to be on the bone itself (or its child) —
          box-shadow can't be in the BoneStyle states since framer-motion
          doesn't interpolate box-shadow strings reliably. Apply via CSS
          transition on a child wrapper so it fades alongside the morph. */}
      <div
        style={{
          width: "100%",
          height: "100%",
          boxShadow: isPanel ? "6px 6px 0 var(--hs-ink)" : "none",
          transition: "box-shadow 0.5s ease",
        }}
      >
        {isPanel ? (
          <BrewSheetPanel playing={contentPlaying} compact={false} />
        ) : (
          <span style={{ display: "inline-block" }}>Brew sheet</span>
        )}
      </div>
    </Bone>
  );
}
