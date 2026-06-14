/**
 * Canonical grain table.
 *
 * One place that decides how a free-form grain name ("Crisp Malting - Finest
 * Maris Otter", "Caramel 60 L") maps to a canonical display name and a
 * FermentableGroup. Used by:
 *  - compareUtils.normalizeGrainName (recipe aggregation — merge "the same"
 *    grain across recipes before averaging)
 *  - the paste-a-recipe importer (pre-normalize before preset matching)
 *
 * Rules are ordered — the first matching rule wins, mirroring the original
 * procedural implementation in compareUtils. Adding a grain = one entry here.
 *
 * PARITY CONTRACT: resolveCanonicalGrain(name).canonical must stay
 * output-identical to the legacy normalizeGrainName for existing inputs, or
 * computeMeanRecipe's grain merging silently regresses. Locked by
 * tests/canonicalGrains.test.ts.
 */

import {
  categorizeFermentable,
  inferType,
  type FermentableGroup,
} from "./fermentablePresets";

export type CanonicalGrainRule = {
  /**
   * Canonical name when the rule fires. A function for parameterized names
   * (color suffix, flaked-grain word) — receives the maltster-stripped name.
   */
  canonical: string | ((strippedName: string) => string);
  category: FermentableGroup;
  /** Rule fires when ANY of these match the maltster-stripped name. */
  match: RegExp[];
  /** Rule is skipped when this matches (later rules still get a chance). */
  exclude?: RegExp;
};

export const CANONICAL_GRAINS: CanonicalGrainRule[] = [
  // Anything containing "maris otter" is Maris Otter.
  { canonical: "Maris Otter", category: "Base malts", match: [/maris\s*otter/i] },
  { canonical: "Pale Ale Malt", category: "Base malts", match: [/^pale\s+ale\s+malt/i] },
  // "2-Row Pilsner/Vienna/Munich" belong to their own rules below.
  {
    canonical: "2-Row Pale Malt",
    category: "Base malts",
    match: [/\b(2-row|two[- ]row)\b/i],
    exclude: /pilsner|vienna|munich/i,
  },
  { canonical: "Pilsner Malt", category: "Base malts", match: [/^pilsner/i, /^pils\b/i] },
  {
    canonical: (s) => {
      const colorMatch = s.match(/(\d+)\s*°?L/i);
      return colorMatch ? `Munich Malt ${colorMatch[1]}L` : "Munich Malt";
    },
    category: "Base malts",
    match: [/^munich/i],
  },
  { canonical: "Vienna Malt", category: "Base malts", match: [/^vienna/i] },
  {
    canonical: (s) => {
      const m = s.match(/^(?:crystal|caramel)\s*(?:malt\s*)?(\d+)\s*°?L?/i);
      return `Crystal ${m![1]}L`;
    },
    category: "Crystal/Caramel",
    match: [/^(?:crystal|caramel)\s*(?:malt\s*)?(\d+)\s*°?L?/i],
  },
  // Color-first book wording: "45°L crystal malt", "160 L caramel".
  {
    canonical: (s) => {
      const m = s.match(/^(\d{1,3})\s*°?\s*L\b[\s.,-]*(?:crystal|caramel)/i);
      return `Crystal ${m![1]}L`;
    },
    category: "Crystal/Caramel",
    match: [/^(\d{1,3})\s*°?\s*L\b[\s.,-]*(?:crystal|caramel)/i],
  },
  { canonical: "Roasted Barley", category: "Roasted", match: [/roasted\s*barley/i] },
  {
    canonical: "Chocolate Malt",
    category: "Roasted",
    match: [/^(?:pale\s+)?chocolate(?:\s+malt)?$/i],
  },
  { canonical: "Black Malt", category: "Roasted", match: [/^black\s*(malt|patent)/i] },
  { canonical: "Black Barley", category: "Roasted", match: [/^black\s*barley/i] },
  {
    canonical: (s) => {
      const m = s.match(/^flaked\s+(\w+)/i);
      const word = m![1];
      return `Flaked ${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    },
    category: "Adjuncts (mashable/flaked)",
    match: [/^flaked\s+(\w+)/i],
  },
  { canonical: "Victory Malt", category: "Toasted & specialty", match: [/^victory/i] },
  { canonical: "Biscuit Malt", category: "Toasted & specialty", match: [/^biscuit/i] },
  { canonical: "Melanoidin Malt", category: "Toasted & specialty", match: [/^melanoidin/i] },
  { canonical: "Aromatic Malt", category: "Toasted & specialty", match: [/^aromatic/i] },
  { canonical: "Wheat Malt", category: "Base malts", match: [/^wheat\s*(malt)?$/i] },
  {
    canonical: "CaraPils / Dextrine",
    category: "Crystal/Caramel",
    match: [/^cara\s*pils/i, /^dextrin/i],
  },
];

/**
 * Strips maltster/brand prefixes ("Briess - ", "Crisp Malting - ") and
 * marketing qualifiers ("Finest", "Premium", …) — the pre-pass every rule
 * (and the fallback) sees.
 */
export function stripGrainQualifiers(name: string): string {
  let normalized = name.replace(/^[A-Za-z\s&'.]+\s*[-–—]\s*/, "");
  normalized = normalized.replace(/\b(Finest|Premium|Best|Extra|Superior)\s+/gi, "");
  return normalized;
}

function fallbackCategory(name: string): FermentableGroup {
  // Color is unknown for a bare name; 0°L sidesteps the color-band branches
  // so only the name-based heuristics in categorizeFermentable apply.
  return categorizeFermentable({
    name,
    colorLovibond: 0,
    potentialGu: 0,
    type: inferType(name),
  });
}

export function resolveCanonicalGrain(name: string): {
  canonical: string;
  category: FermentableGroup;
} {
  const stripped = stripGrainQualifiers(name);
  for (const rule of CANONICAL_GRAINS) {
    if (rule.exclude?.test(stripped)) continue;
    if (rule.match.some((re) => re.test(stripped))) {
      const canonical =
        typeof rule.canonical === "function" ? rule.canonical(stripped) : rule.canonical;
      return { canonical, category: rule.category };
    }
  }
  return { canonical: stripped.trim(), category: fallbackCategory(stripped) };
}
