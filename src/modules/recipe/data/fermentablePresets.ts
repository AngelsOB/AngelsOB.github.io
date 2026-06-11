/**
 * Fermentable preset database
 *
 * This file imports the generated grain database from the old builder
 * and provides it in a format suitable for the Beta Builder.
 *
 * Source: src/utils/presets.generated.grains.json
 */

import type { FermentablePreset } from "@/modules/recipe/models/Presets";

// Import the generated grain database
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import handled by bundler
import GENERATED_GRAINS_JSON from "@/utils/presets.generated.grains.json";

// Type-cast the imported JSON to our FermentablePreset type
export const FERMENTABLE_PRESETS: FermentablePreset[] =
  GENERATED_GRAINS_JSON as FermentablePreset[];

/**
 * Group names for organizing fermentables by type
 */
export type FermentableGroup =
  | "Base malts"
  | "Crystal/Caramel"
  | "Roasted"
  | "Toasted & specialty"
  | "Adjuncts (mashable/flaked)"
  | "Extracts"
  | "Sugars"
  | "Lauter aids & other";

/**
 * Categorizes a fermentable preset into a group
 */
export function categorizeFermentable(preset: FermentablePreset): FermentableGroup {
  const nameLower = preset.name.toLowerCase();

  // Extracts
  if (preset.type === "extract") {
    return "Extracts";
  }

  // Sugars
  if (preset.type === "sugar") {
    return "Sugars";
  }

  // Lauter aids
  if (nameLower.includes("rice hull")) {
    return "Lauter aids & other";
  }

  // Adjuncts (mashable/flaked)
  if (
    preset.type === "adjunct_mashable" ||
    nameLower.includes("flaked") ||
    nameLower.includes("torrified")
  ) {
    return "Adjuncts (mashable/flaked)";
  }

  // Roasted malts
  if (
    nameLower.includes("roasted") ||
    nameLower.includes("black") ||
    nameLower.includes("chocolate") ||
    nameLower.includes("carafa") ||
    (preset.colorLovibond >= 300 && !nameLower.includes("caramel"))
  ) {
    return "Roasted";
  }

  // Crystal/Caramel malts
  if (
    nameLower.includes("crystal") ||
    nameLower.includes("caramel") ||
    nameLower.includes("cara") ||
    (preset.colorLovibond >= 10 &&
      preset.colorLovibond < 200 &&
      !nameLower.includes("munich") &&
      !nameLower.includes("aromatic") &&
      !nameLower.includes("biscuit"))
  ) {
    return "Crystal/Caramel";
  }

  // Toasted & specialty
  if (
    nameLower.includes("aromatic") ||
    nameLower.includes("biscuit") ||
    nameLower.includes("victory") ||
    nameLower.includes("amber") ||
    nameLower.includes("brown") ||
    nameLower.includes("melanoidin") ||
    nameLower.includes("special") ||
    (preset.colorLovibond >= 20 && preset.colorLovibond < 100)
  ) {
    return "Toasted & specialty";
  }

  // Default to base malts
  return "Base malts";
}

/**
 * Default fermentability by category (0-1).
 *
 * Represents the fraction of extracted sugars that brewer's yeast can ferment.
 * These are category-level defaults — individual ingredients may override via
 * the `fermentability` field on FermentablePreset or Recipe.Fermentable.
 *
 * Crystal/Caramel malts use a color-based scale instead of a flat value — see
 * `crystalFermentability()` below.
 */
const CATEGORY_FERMENTABILITY: Record<FermentableGroup, number> = {
  "Base malts": 1.00,               // Pure starch — mash temp determines fermentable split
  "Crystal/Caramel": 0.75,          // Fallback only — crystalFermentability() used when color is known
  "Roasted": 0.60,                  // Heavily modified starch, partially pre-converted
  "Toasted & specialty": 0.85,      // Lightly pre-converted, mostly mashable starch
  "Adjuncts (mashable/flaked)": 1.00,// Pure starch (oats, wheat, rice) — mash temp handles the split
  "Extracts": 0.78,                 // Pre-mashed wort, typical fermentability already set
  "Sugars": 1.00,                   // Fully fermentable (overridden for lactose/maltodextrin)
  "Lauter aids & other": 0.00,      // Rice hulls etc — no gravity contribution
};

/**
 * Color-based fermentability for Crystal/Caramel malts.
 *
 * Briess maltster data: crystal malt extract is 10% (lighter) – 25% (darker)
 * less fermentable than base malt. Validated by the Beertech mash experiment
 * (C10 → −1% att at 15% usage, C40 → −3%, C120 → −4%).
 *
 * Linear interpolation from 0.90 (10°L) to 0.75 (120°L), clamped to [0.50, 0.95].
 *
 * Sources:
 *   - Briess, "Caramel Malt User's Manual" — brewingwithbriess.com
 *   - Beertech, "Crystal Malt Experiment — Attenuation Test" (2011)
 */
function crystalFermentability(colorLovibond: number): number {
  // Linear interpolation: 10°L → 0.90, 120°L → 0.75
  const f = 0.90 - ((colorLovibond - 10) * 0.15) / 110;
  return Math.max(0.50, Math.min(0.95, f));
}

/**
 * Name patterns for known non-/partially-fermentable ingredients.
 * Checked after category default, before explicit override.
 */
const NAME_OVERRIDES: Array<{ pattern: RegExp; fermentability: number }> = [
  { pattern: /\blactose\b/i, fermentability: 0 },
  { pattern: /\bmaltodextrin\b/i, fermentability: 0 },
  { pattern: /\bcara\s*pils\b/i, fermentability: 0.50 },  // Dextrine malt — adds body, low fermentability
  { pattern: /\bdextrin[e]?\s*malt\b/i, fermentability: 0.50 },
];

/**
 * Returns the fermentability (0-1) for a fermentable preset.
 *
 * Priority:
 *  1. Explicit `preset.fermentability` if set (custom presets)
 *  2. Name-based override (lactose, maltodextrin → 0)
 *  3. Color-based scale for Crystal/Caramel (Briess data)
 *  4. Category default from CATEGORY_FERMENTABILITY
 */
export function getFermentability(preset: FermentablePreset): number {
  // 1. Explicit override on preset
  if (preset.fermentability != null) return preset.fermentability;

  // 2. Name-based overrides
  for (const { pattern, fermentability } of NAME_OVERRIDES) {
    if (pattern.test(preset.name)) return fermentability;
  }

  // 3. Color-based scale for Crystal/Caramel
  const category = categorizeFermentable(preset);
  if (category === "Crystal/Caramel") {
    return crystalFermentability(preset.colorLovibond);
  }

  // 4. Category default
  return CATEGORY_FERMENTABILITY[category];
}

/**
 * Returns the fermentability (0-1) for a recipe fermentable that may not have
 * the full preset fields. Uses name heuristics matching categorizeFermentable logic.
 */
export function inferFermentability(fermentable: { name: string; colorLovibond: number }): number {
  // Name-based overrides first
  for (const { pattern, fermentability } of NAME_OVERRIDES) {
    if (pattern.test(fermentable.name)) return fermentability;
  }

  // Build a minimal preset-like object to reuse categorizeFermentable
  const pseudoPreset: FermentablePreset = {
    name: fermentable.name,
    colorLovibond: fermentable.colorLovibond,
    potentialGu: 0, // Not used by categorizeFermentable
    type: inferType(fermentable.name),
  };
  const category = categorizeFermentable(pseudoPreset);

  // Color-based scale for Crystal/Caramel
  if (category === "Crystal/Caramel") {
    return crystalFermentability(fermentable.colorLovibond);
  }

  return CATEGORY_FERMENTABILITY[category];
}

/** Infer the preset type from name (for recipe fermentables that don't store type) */
export function inferType(name: string): FermentablePreset["type"] {
  const n = name.toLowerCase();
  if (
    n.includes("extract") || n.includes("lme") || n.includes("dme") ||
    n.includes("liquid malt") || n.includes("dry malt")
  ) return "extract";
  if (
    n.includes("sugar") || n.includes("honey") || n.includes("syrup") ||
    n.includes("molasses") || n.includes("candi") || n.includes("candy") ||
    n.includes("dextrose") || n.includes("sucrose") || n.includes("lactose") ||
    n.includes("maltodextrin") || n.includes("agave") || n.includes("maple") ||
    n.includes("invert") || n.includes("jaggery") || n.includes("treacle") ||
    n.includes("corn sugar") || n.includes("cane")
  ) return "sugar";
  if (
    n.includes("flaked") || n.includes("torrified")
  ) return "adjunct_mashable";
  return "grain";
}

/**
 * Groups fermentables by category
 */
export function groupFermentables(
  presets: FermentablePreset[]
): Array<{ label: FermentableGroup; items: FermentablePreset[] }> {
  const groups: Record<FermentableGroup, FermentablePreset[]> = {
    "Base malts": [],
    "Crystal/Caramel": [],
    Roasted: [],
    "Toasted & specialty": [],
    "Adjuncts (mashable/flaked)": [],
    Extracts: [],
    Sugars: [],
    "Lauter aids & other": [],
  };

  for (const preset of presets) {
    const group = categorizeFermentable(preset);
    groups[group].push(preset);
  }

  // Return only non-empty groups in order
  const groupOrder: FermentableGroup[] = [
    "Base malts",
    "Crystal/Caramel",
    "Roasted",
    "Toasted & specialty",
    "Adjuncts (mashable/flaked)",
    "Extracts",
    "Sugars",
    "Lauter aids & other",
  ];

  return groupOrder
    .filter((label) => groups[label].length > 0)
    .map((label) => ({
      label,
      items: groups[label],
    }));
}
