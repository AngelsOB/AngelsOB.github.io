// Single source of truth for what search matches on, per ingredient kind. Both
// the reference pages (hopRows/yeastRows `keywords`) and the builder picker
// modals build their haystack from these, so search behaves identically
// site-wide — the same query surfaces the same things whether you're on /yeast
// or picking a strain inside a recipe.
//
// PURE + light on purpose: no dataset imports, no module side effects, so it's
// safe in both the server bundle (the kind files) and the client bundle (the
// modals) without dragging the ~300KB preset data along.

import type { HopPreset, YeastPreset } from "@/modules/recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/recipe/models/Presets";
import { BREWING_ORIGINS } from "@/utils/flags";
import { formatStrainType } from "@/modules/builder/components/builder/yeastDetails";

// Flavor axis → the word a brewer would actually type. Defined here (not from
// the modal's display labels) so hop search text reads the same everywhere.
const HOP_FLAVOR_TERMS: Record<(typeof HOP_FLAVOR_KEYS)[number], string> = {
  citrus: "citrus",
  tropicalFruit: "tropical",
  stoneFruit: "stone fruit",
  berry: "berry",
  floral: "floral",
  spice: "spice",
  herbal: "herbal",
  grassy: "grassy",
  resinPine: "pine resin",
};

/** Country name for an origin code ("US" → "United States"), or "" for none. */
function originName(code: string | undefined): string {
  if (!code) return "";
  return BREWING_ORIGINS[code] ?? code;
}

/**
 * The lowercased text a hop is matched by, everywhere: name, category, origin
 * (both the code and the country name), and every flavor axis it actually has
 * (value > 0) as a plain word — so a hop is findable by a secondary note but
 * never by a flavor it lacks.
 */
export function hopSearchText(h: HopPreset): string {
  const flavors = h.flavor
    ? HOP_FLAVOR_KEYS.filter((k) => (h.flavor![k] ?? 0) > 0).map(
        (k) => HOP_FLAVOR_TERMS[k]
      )
    : [];
  return [
    h.name,
    h.category ?? "",
    h.originCode ?? "",
    originName(h.originCode),
    ...flavors,
  ]
    .join(" ")
    .toLowerCase()
    .trim();
}

/**
 * The lowercased text a yeast is matched by, everywhere: name, lab, producer,
 * strain type, and lab catalog id — plus the cross-lab identity that makes
 * "us 05" find the whole Chico family: its strainGroup common name, its aliases
 * (sibling codes, origin breweries, famous beers), and its suited styles.
 */
export function yeastSearchText(y: YeastPreset): string {
  return [
    y.name,
    y.category ?? "",
    y.producer ?? "",
    formatStrainType(y.type) ?? "",
    y.labProductId ?? "",
    y.strainGroup ?? "",
    ...(y.strainGroupAliases ?? []),
    ...(y.styles ?? []),
  ]
    .join(" ")
    .toLowerCase()
    .trim();
}
