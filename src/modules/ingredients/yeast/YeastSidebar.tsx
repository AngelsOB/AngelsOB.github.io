"use client";

import { useYeastHoverPreview } from "@/modules/builder/components/builder/yeastHoverPreview";
import { YEAST_PRESETS } from "@/modules/recipe/data/yeastPresets";

import IngredientSidebar from "../IngredientSidebar";
import { getYeast, yeastSidebarCategories } from "./yeastKind";

// Computed once — deterministic.
const CATEGORIES = yeastSidebarCategories();

/**
 * Yeast wrapper around the shared accordion sidebar that wires the builder's
 * dwell hover preview onto each row (long-hover a strain → the same spec +
 * same-strain/substitutes card the builder picker uses). Lives client-side so
 * the server detail page can still render it. Placement follows the cursor and
 * flips left near the right edge, so the panel stays on-screen even though the
 * sidebar hugs the right gutter. No Compare toggle — yeast has no compare tool.
 */
export default function YeastSidebar(props: {
  selectedSlugs?: string[];
}) {
  const { portal, getTriggerProps } = useYeastHoverPreview(YEAST_PRESETS, {
    placement: "cursor-right",
    showDelay: 550,
  });

  return (
    <IngredientSidebar
      basePath="yeast"
      categories={CATEGORIES}
      getRowHoverProps={(slug) => getTriggerProps(getYeast(slug))}
      hoverPortal={portal}
      {...props}
    />
  );
}
