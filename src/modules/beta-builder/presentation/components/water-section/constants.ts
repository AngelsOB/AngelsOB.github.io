/**
 * Constants for the Water Section components
 *
 * Shared labels, colors, and configuration for water chemistry,
 * salt additions, and other ingredients.
 */

import type { OtherIngredient, OtherIngredientCategory } from "../../../domain/models/Recipe";
import type { SaltAdditions, WaterProfile } from "../../../domain/services/WaterChemistryService";

export const SALT_LABELS: Record<keyof SaltAdditions, string> = {
  gypsum_g: "Gypsum (CaSO₄)",
  cacl2_g: "Calcium Chloride (CaCl₂)",
  epsom_g: "Epsom Salt (MgSO₄)",
  nacl_g: "Table Salt (NaCl)",
  nahco3_g: "Baking Soda (NaHCO₃)",
};

export const SALT_SHORT_LABELS: Record<keyof SaltAdditions, string> = {
  gypsum_g: "Gypsum (CaSO₄)",
  cacl2_g: "CaCl₂",
  epsom_g: "Epsom (MgSO₄)",
  nacl_g: "NaCl",
  nahco3_g: "Baking Soda",
};

export const ION_LABELS: Array<keyof WaterProfile> = ["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"];

export const UNITS = ["g", "kg", "tsp", "tbsp", "oz", "lb", "ml", "l", "drops", "capsule", "tablet", "packet"];

export const TIMINGS: OtherIngredient["timing"][] = ["mash", "boil", "whirlpool", "secondary", "kegging", "bottling"];

export const CATEGORY_LABELS: Record<OtherIngredientCategory, string> = {
  "water-agent": "Water Agent",
  fining: "Fining",
  spice: "Spice",
  flavor: "Flavor",
  herb: "Herb",
  other: "Other",
};

export const CATEGORY_COLORS: Record<OtherIngredientCategory, string> = {
  "water-agent": "brew-chip-active",
  fining: "brew-chip-active",
  spice: "brew-chip-active",
  flavor: "brew-chip-active",
  herb: "brew-chip-active",
  other: "brew-chip",
};

/**
 * Returns the default unit for a given ingredient category.
 */
export function getDefaultUnit(category: OtherIngredientCategory): string {
  switch (category) {
    case "water-agent": return "ml";
    case "fining": return "tablet";
    case "spice": return "g";
    case "flavor": return "g";
    case "herb": return "g";
    case "other": return "g";
  }
}

/**
 * Returns the default timing for a given ingredient category.
 */
export function getDefaultTiming(category: OtherIngredientCategory): OtherIngredient["timing"] {
  switch (category) {
    case "water-agent": return "mash";
    case "fining": return "boil";
    case "spice": return "boil";
    case "flavor": return "secondary";
    case "herb": return "boil";
    case "other": return "boil";
  }
}
