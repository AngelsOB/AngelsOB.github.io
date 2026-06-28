"use client";

import { useHopHoverPreview } from "@/modules/builder/components/builder/hopHoverPreview";
import { HOP_PRESETS } from "@/modules/recipe/data/hopPresets";

import IngredientSidebar from "../IngredientSidebar";
import { getHop, hopSidebarCategories } from "./hopKind";

// Computed once — deterministic.
const CATEGORIES = hopSidebarCategories();

/**
 * Hop wrapper around the shared accordion sidebar that wires the builder's
 * dwell hover preview onto each row (long-hover a hop → the same flavor-radar
 * card the builder uses). Lives client-side so the server detail page can still
 * render it. Placement follows the cursor and flips left near the right edge,
 * so the panel stays on-screen even though the sidebar hugs the right gutter.
 */
export default function HopSidebar(props: {
  defaultCompare?: boolean;
  onPickCompare?: (slug: string) => void;
  compareSeed?: string;
  selectedSlugs?: string[];
}) {
  const { portal, getTriggerProps } = useHopHoverPreview(HOP_PRESETS, {
    placement: "cursor-right",
    showDelay: 550,
  });

  return (
    <IngredientSidebar
      basePath="hops"
      categories={CATEGORIES}
      getRowHoverProps={(slug) => getTriggerProps(getHop(slug))}
      hoverPortal={portal}
      {...props}
    />
  );
}
