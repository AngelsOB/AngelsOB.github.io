/**
 * Yeast preset database
 *
 * This file imports the yeast database from the old builder
 * and provides it in a format suitable for the Beta Builder.
 *
 * Source: src/utils/presets.ts (YEAST_PRESETS array)
 */

import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { YEAST_PRESETS as OLD_YEAST_PRESETS } from "@/utils/presets";

// Re-export the yeast presets from the old builder
export const YEAST_PRESETS: YeastPreset[] = OLD_YEAST_PRESETS;

/**
 * Yeast categories for grouping
 */
export type YeastCategory = string; // Lab name like "Wyeast", "White Labs", etc.

/**
 * Groups yeasts by laboratory/manufacturer
 */
export function groupYeasts(
  presets: YeastPreset[]
): Array<{ label: YeastCategory; items: YeastPreset[] }> {
  const groups: Record<string, YeastPreset[]> = {};

  for (const preset of presets) {
    const category = preset.category || "Other";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(preset);
  }

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groups).sort();

  return sortedCategories.map((label) => ({
    label,
    items: groups[label],
  }));
}
