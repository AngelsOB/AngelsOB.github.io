/**
 * Hop preset database
 *
 * This file imports the hop database from the old builder
 * and provides it in a format suitable for the Beta Builder.
 *
 * Source: src/utils/presets.ts (HOP_PRESETS array)
 */

import type { HopPreset } from "../domain/models/Presets";
import { HOP_PRESETS as OLD_HOP_PRESETS } from "../../../utils/presets";

// Re-export the hop presets from the old builder
// They're already in the correct format
export const HOP_PRESETS: HopPreset[] = OLD_HOP_PRESETS;

/**
 * Hop categories for grouping
 */
export type HopCategory =
  | "US Hops"
  | "Noble Hops"
  | "New Zealand Hops"
  | "Australian Hops"
  | "English Hops"
  | "German Hops"
  | "Custom"
  | (string & {});

/**
 * Groups hops by category
 */
export function groupHops(
  presets: HopPreset[]
): Array<{ label: HopCategory; items: HopPreset[] }> {
  const groups: Record<string, HopPreset[]> = {};

  for (const preset of presets) {
    const category = preset.category || "Other";
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(preset);
  }

  // Return groups in preferred order, with any remaining categories appended
  const categoryOrder: string[] = [
    "US Hops",
    "Noble Hops",
    "New Zealand Hops",
    "Australian Hops",
    "English Hops",
    "German Hops",
  ];

  // Append any categories not in the preferred order (e.g., "Custom")
  const remainingCategories = Object.keys(groups).filter(
    (cat) => !categoryOrder.includes(cat)
  );

  return [...categoryOrder, ...remainingCategories]
    .filter((label) => groups[label] && groups[label].length > 0)
    .map((label) => ({
      label: label as HopCategory,
      items: groups[label],
    }));
}
