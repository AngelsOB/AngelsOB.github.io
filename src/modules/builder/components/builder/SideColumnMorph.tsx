"use client";

import HelperCardMorph from "./HelperCardMorph";

type TabKey =
  | "fermentables"
  | "hops"
  | "mash"
  | "water"
  | "yeast"
  | "fermentation"
  | "brewsheet";

interface Props {
  /** Render the side column? False during a section's full-width empty/intro
   *  state (and on the brew sheet), matching the grid's single-column collapse
   *  (`.section-empty`). */
  show: boolean;
  activeTab: TabKey;
}

/**
 * The builder side column (contextual helper card). Rendered only when the
 * active section has content — during a section's empty/intro state the grid
 * collapses to a single column and this returns null.
 *
 * Deliberately no wrapper `layout`/opacity animation: the tab-to-tab morph is
 * owned entirely by HelperCardMorph (a fast 125ms FLIP), which matches the
 * live builder. An extra `layout` wrapper here stacked a second, slower FLIP
 * on top and made the helper column visibly squish on every tab change. The
 * empty↔filled column change is an instant CSS grid switch.
 */
export default function SideColumnMorph({ show, activeTab }: Props) {
  if (!show) return null;
  return (
    <div className="hs-builder-side">
      <HelperCardMorph activeTab={activeTab} />
    </div>
  );
}
