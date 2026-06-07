/**
 * Preset ingredient types for the Beta Builder
 *
 * These are the templates users can select from when adding ingredients.
 * Presets come from curated databases and can be extended with custom additions.
 */

export type FermentablePreset = {
  name: string;
  colorLovibond: number; // °L
  potentialGu: number; // GU/PPG at 100% conversion (as-is)
  type: "grain" | "adjunct_mashable" | "extract" | "sugar";
  originCode?: string; // ISO-3166-1 alpha-2 (e.g., US, DE, GB)
  fermentability?: number; // 0-1, override for non-standard ingredients
  producer?: string; // maltster/vendor, parsed from "Vendor - Product" names
  productName?: string; // product name without the vendor prefix, for display
};

// Hop flavor keys in radar order
export const HOP_FLAVOR_KEYS = [
  "citrus",
  "tropicalFruit",
  "stoneFruit",
  "berry",
  "floral",
  "spice",
  "herbal",
  "grassy",
  "resinPine",
] as const;

export type HopFlavorProfile = {
  citrus: number;
  tropicalFruit: number;
  stoneFruit: number;
  berry: number;
  floral: number;
  grassy: number;
  herbal: number;
  spice: number;
  resinPine: number;
};

export type HopPreset = {
  name: string;
  alphaAcidPercent: number;
  category?: string; // "US Hops", "Noble Hops", "New Zealand Hops", etc.
  flavor?: HopFlavorProfile;
  notes?: string;
};

// Biological classification of a yeast strain (distinct from the recipe-level
// packaging `YeastType` in Recipe.ts, which is liquid-100/dry/slurry/etc.).
export type YeastStrainType =
  | "ale"
  | "lager"
  | "kveik"
  | "wheat"
  | "brett"
  | "wild"
  | "bacteria"
  | "blend"
  | "wine"
  | "other";

export type YeastForm = "liquid" | "dry";

// Mirrors BeerJSON FlocculationType.
export type YeastFlocculation =
  | "very-low"
  | "low"
  | "medium-low"
  | "medium"
  | "medium-high"
  | "high"
  | "very-high";

// NOTE: keep this in sync with the YeastPreset in src/utils/presets.ts (the data source).
export type YeastPreset = {
  name: string; // stable recipe lookup key — never rename (recipes reference yeast by name)
  category: string; // "Escarpment Labs", "Wyeast", "Fermentis", etc.
  attenuationPercent?: number; // 0-1, the single headline attenuation number
  // --- BeerJSON-aligned enrichment (all optional, additive for backward-compat) ---
  type?: YeastStrainType;
  form?: YeastForm;
  tempMinC?: number; // recommended fermentation temperature range (°C)
  tempMaxC?: number;
  flocculation?: YeastFlocculation;
  attenuationMin?: number; // 0-1, published attenuation range low
  attenuationMax?: number; // 0-1, published attenuation range high
  alcoholTolerance?: number; // approx. max ABV (%) the strain can reach
  producer?: string; // canonical producer name (may differ from the display `category`)
  labProductId?: string; // lab catalog id, e.g. "WLP001", "1056", "US-05"
  pof?: boolean; // phenolic off-flavor positive (4VG) — clove/spice capable
  sta1?: boolean; // STA1/diastaticus marker (super-attenuating)
  description?: string; // short tasting/usage notes
  styles?: string[]; // recommended beer styles
  substitutes?: string[]; // derived "similar / replaceable" strains (recipe-key names), best-first
  // Strain-equivalence ("same strain, other labs") — CURATED lineage, NOT computed from stats.
  strainGroup?: string; // slug shared by all labs' versions of one strain, e.g. "chico"
  strainGroupLabel?: string; // human label, e.g. "Chico / American Ale"
  // Provenance
  source?: string; // where the facts came from, e.g. "White Labs spec sheet"
  sourceConfidence?: "high" | "medium" | "low";
};
