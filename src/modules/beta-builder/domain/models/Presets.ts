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

export type YeastPreset = {
  name: string;
  attenuationPercent?: number;
  category: string; // "Escarpment Labs", "Wyeast", "Fermentis", etc.
};
