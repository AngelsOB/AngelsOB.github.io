import { loadJson, saveJson } from "./storage";
// Single source of truth for fermentables (generated offline and committed)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import handled by bundler
import GENERATED_GRAINS from "./presets.generated.grains.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import handled by bundler
import GENERATED_HOPS from "./presets.generated.hops.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import handled by bundler
import GENERATED_YEASTS from "./presets.generated.yeasts.json";

export type GrainPreset = {
  name: string;
  colorLovibond: number; // °L
  potentialGu: number; // GU/PPG at 100% conversion (as-is)
  type?: "grain" | "adjunct_mashable" | "extract" | "sugar"; // optional; default to grain
  originCode?: string; // ISO-3166-1 alpha-2 (e.g., US, DE, GB)
  producer?: string; // maltster/vendor, parsed from "Vendor - Product" names
  productName?: string; // product name without the vendor prefix, for display
};

export type HopPreset = {
  name: string;
  alphaAcidPercent: number;
  // Optional alpha/beta acid ranges + oil chemistry (from grower data via kasperg3, MIT)
  alphaLow?: number;
  alphaHigh?: number;
  betaAcidPercent?: number;
  betaLow?: number;
  betaHigh?: number;
  oilTotalMlPer100g?: number;
  cohumulonePercent?: number;
  originCode?: string; // ISO-3166-1 alpha-2 (e.g., US, DE, GB)
  category?: string; // Optional category, e.g., "US Hops", "Noble Hops", "New Zealand Hops"
  // Optional sensory flavor/aroma profile on a 0-5 scale (0 = none/unknown, 5 = very strong)
  flavor?: HopFlavorProfile;
  flavorSource?: "curated" | "derived"; // provenance of the flavor vector
  flavorConfidence?: "curated" | "high" | "low";
  // Optional free-form tasting notes or metadata
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

export type YeastPreset = {
  name: string; // stable recipe lookup key — never rename (recipes reference yeast by name)
  category: string; // lab/producer display group, e.g. "Escarpment Labs", "Wyeast", "Fermentis"
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
  // The canonical strain name shared by every lab's version — the grouping key AND the
  // display (two strains are the same strain iff this matches exactly).
  strainGroup?: string; // e.g. "Chico (American Ale)", "Westmalle"
  strainGroupAliases?: string[]; // other names brewers search for this strain, e.g. ["Sierra Nevada", "US-05"]
  // Provenance
  source?: string; // where the facts came from, e.g. "White Labs spec sheet"
  sourceConfidence?: "high" | "medium" | "low";
};

// Numeric flavor radar profile keys used by our comparison chart
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

export const HOP_FLAVOR_KEYS = [
  "citrus",
  "tropicalFruit",
  "stoneFruit",
  "berry",
  "floral",
  // Swap positions so spice sits where grassy was to better match the color wheel
  "spice",
  "herbal",
  "grassy",
  "resinPine",
] as const;

export const EMPTY_HOP_FLAVOR: HopFlavorProfile = {
  citrus: 0,
  tropicalFruit: 0,
  stoneFruit: 0,
  berry: 0,
  floral: 0,
  grassy: 0,
  herbal: 0,
  spice: 0,
  resinPine: 0,
};


// Hop presets: merged from curated house data + kasperg3 (MIT) grower facts.
// Flavor vectors: 64 hand-curated kept as-is; the rest derived by modulating kasperg3's
// measured aroma radar toward grower descriptors (flavorSource/flavorConfidence track provenance).
// See src/utils/presets.generated.hops.json (generated offline and committed).
export const HOP_PRESETS: HopPreset[] = GENERATED_HOPS as unknown as HopPreset[];

// Yeast presets: generated offline and committed (mirrors the hops/grains pattern).
// Currently name/category/attenuation only; BeerJSON-aligned enrichment fields are
// optional and filled in over time. See src/utils/presets.generated.yeasts.json.
export const YEAST_PRESETS: YeastPreset[] = GENERATED_YEASTS as unknown as YeastPreset[];

const CUSTOM_GRAINS_KEY = "beerapp.customGrains";
const CUSTOM_HOPS_KEY = "beerapp.customHops";
const CUSTOM_YEASTS_KEY = "beerapp.customYeasts";

export function getGrainPresets(): GrainPreset[] {
  const custom = loadJson<GrainPreset[]>(CUSTOM_GRAINS_KEY, []);
  const generated: GrainPreset[] = GENERATED_GRAINS as unknown as GrainPreset[];

  // Deduplicate by name (prefer generated -> custom)
  const byName = new Map<string, GrainPreset>();
  const put = (p: GrainPreset) =>
    byName.set(p.name, { ...byName.get(p.name), ...p });
  for (const p of generated) put(p);
  for (const p of custom) put(p);
  return Array.from(byName.values());
}

// Grouping for better UX in dropdowns
export type GrainGroup =
  | "Base malts"
  | "Crystal/Caramel"
  | "Roasted"
  | "Toasted & specialty"
  | "Adjuncts (mashable/flaked)"
  | "Extracts"
  | "Sugars"
  | "Lauter aids & other";

const GRAIN_GROUP_ORDER: GrainGroup[] = [
  "Base malts",
  "Crystal/Caramel",
  "Roasted",
  "Toasted & specialty",
  "Adjuncts (mashable/flaked)",
  "Extracts",
  "Sugars",
  "Lauter aids & other",
];

function getPresetType(
  p: GrainPreset
): "grain" | "adjunct_mashable" | "extract" | "sugar" {
  const t = (p as { type?: string }).type as
    | "grain"
    | "adjunct_mashable"
    | "extract"
    | "sugar"
    | undefined;
  if (t) return t;
  const name = (p.name || "").toLowerCase();
  const isMaltNamed = name.includes("malt");

  // Extracts
  if (
    name.includes("extract") ||
    name.includes(" dme") ||
    name.includes("dme ") ||
    name.includes(" lme") ||
    name.includes("lme ")
  ) {
    return "extract";
  }

  // Sugars (avoid misclassifying Honey Malt)
  if (
    (!isMaltNamed && name.includes("honey")) ||
    name.includes("syrup") ||
    name.includes("candi") ||
    name.includes("sugar") ||
    name.includes("dextrose") ||
    name.includes("sucrose") ||
    name.includes("lactose") ||
    name.includes("maltodextrin") ||
    name.includes("turbinado") ||
    name.includes("molasses") ||
    name.includes("maple")
  ) {
    return "sugar";
  }

  // Adjunct mashables
  if (
    name.includes("flaked") ||
    name.includes("torrified") ||
    name.includes("torrefied") ||
    name.includes("grits")
  ) {
    return "adjunct_mashable";
  }

  return "grain";
}

function inferGrainGroup(p: GrainPreset): GrainGroup {
  const name = (p.name || "").toLowerCase();
  // Type-based groups first with name-based inference fallback
  const inferredType = getPresetType(p);
  if (inferredType === "extract") return "Extracts";
  if (inferredType === "sugar") return "Sugars";
  if (name.includes("rice hulls")) return "Lauter aids & other";
  if (inferredType === "adjunct_mashable") return "Adjuncts (mashable/flaked)";

  // Name-based inference for grains
  if (
    name.includes("crystal") ||
    name.includes("caramel") ||
    name.startsWith("cara") ||
    name.includes("caramunich") ||
    name.includes("caravienne") ||
    name.includes("carapils") ||
    name.includes("carafoam") ||
    name.includes("special b") ||
    name.includes("honey malt")
  ) {
    return "Crystal/Caramel";
  }

  if (
    name.includes("chocolate") ||
    name.includes("black") ||
    name.includes("roast") ||
    name.includes("roasted") ||
    name.includes("patent")
  ) {
    return "Roasted";
  }

  if (
    name.includes("biscuit") ||
    name.includes("victory") ||
    name.includes("amber") ||
    name.includes("aromatic") ||
    name.includes("melanoidin") ||
    name.includes("smoked") ||
    name.includes("peat") ||
    name.includes("brown malt") ||
    name.includes("acid")
  ) {
    return "Toasted & specialty";
  }

  if (
    name.includes("pilsner") ||
    name.includes("2-row") ||
    name.includes("6-row") ||
    name.includes("maris otter") ||
    name.includes("golden promise") ||
    name.includes("vienna") ||
    name.includes("munich") ||
    name.includes("mild malt") ||
    name.includes("wheat malt") ||
    name.includes("rye malt")
  ) {
    return "Base malts";
  }

  // Fallback
  return "Base malts";
}

export function getGrainPresetsGrouped(): Array<{
  label: GrainGroup;
  items: GrainPreset[];
}> {
  const grouped: Record<GrainGroup, GrainPreset[]> = {
    "Base malts": [],
    "Crystal/Caramel": [],
    Roasted: [],
    "Toasted & specialty": [],
    "Adjuncts (mashable/flaked)": [],
    Extracts: [],
    Sugars: [],
    "Lauter aids & other": [],
  };

  for (const p of getGrainPresets()) {
    const g = inferGrainGroup(p);
    grouped[g].push(p);
  }

  // Sort each group by name asc
  for (const key of Object.keys(grouped) as GrainGroup[]) {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  }

  return GRAIN_GROUP_ORDER.map((label) => ({ label, items: grouped[label] }));
}

// Infer a manufacturer/vendor from common "Vendor - Product" naming used by catalogs
function inferVendorFromName(name: string): string | undefined {
  const seps = [" - ", " — ", " – "];
  for (const sep of seps) {
    const idx = name.indexOf(sep);
    if (idx > 0) {
      const left = name.slice(0, idx).trim();
      const right = name.slice(idx + sep.length).trim();
      // Heuristics: allow vendors with digits as long as they also contain letters
      // (e.g., "1886 Malt House"). Ignore cases where left is only digits.
      const leftHasDigit = /\d/.test(left);
      const leftHasLetter = /[A-Za-z]/.test(left);
      if (leftHasDigit && !leftHasLetter) continue;
      // Must have a reasonable product part
      if (right.length < 3) continue;
      return left;
    }
  }
  return undefined;
}

// Group by grain group AND vendor, formatted as "<Group> · <Vendor>"
export function getGrainPresetsGroupedByVendor(): Array<{
  label: string;
  items: GrainPreset[];
}> {
  type BucketKey = { group: GrainGroup; vendor: string };
  const buckets = new Map<string, { key: BucketKey; items: GrainPreset[] }>();

  const add = (group: GrainGroup, vendor: string, p: GrainPreset) => {
    const k = `${group}__${vendor}`;
    if (!buckets.has(k)) buckets.set(k, { key: { group, vendor }, items: [] });
    buckets.get(k)!.items.push(p);
  };

  for (const p of getGrainPresets()) {
    const group = inferGrainGroup(p);
    const vendor = p.producer || inferVendorFromName(p.name) || "Generic";
    add(group, vendor, p);
  }

  // Sort items in each bucket
  for (const b of buckets.values()) {
    b.items.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Order buckets by group order then vendor asc, with Generic FIRST in each group
  const ordered = Array.from(buckets.values()).sort((a, b) => {
    const ga = GRAIN_GROUP_ORDER.indexOf(a.key.group);
    const gb = GRAIN_GROUP_ORDER.indexOf(b.key.group);
    if (ga !== gb) return ga - gb;
    // Generic first
    if (a.key.vendor === "Generic" && b.key.vendor !== "Generic") return -1;
    if (b.key.vendor === "Generic" && a.key.vendor !== "Generic") return 1;
    const normalize = (v: string) => {
      // Push numeric-leading vendors after alphabetic vendors
      return /^\d/.test(v) ? `~~~_${v}` : v;
    };
    const va = normalize(a.key.vendor);
    const vb = normalize(b.key.vendor);
    return va.localeCompare(vb);
  });

  return ordered.map((b) => ({
    label: `${b.key.group} · ${b.key.vendor}`,
    items: b.items,
  }));
}

export function getHopPresets(): HopPreset[] {
  const custom = loadJson<HopPreset[]>(CUSTOM_HOPS_KEY, []);
  return [...HOP_PRESETS, ...custom];
}

export function addCustomGrain(p: GrainPreset): GrainPreset[] {
  const list = loadJson<GrainPreset[]>(CUSTOM_GRAINS_KEY, []);
  const next = [...list.filter((x) => x.name !== p.name), p];
  saveJson(CUSTOM_GRAINS_KEY, next);
  return next;
}

export function addCustomHop(p: HopPreset): HopPreset[] {
  const list = loadJson<HopPreset[]>(CUSTOM_HOPS_KEY, []);
  const next = [...list.filter((x) => x.name !== p.name), p];
  saveJson(CUSTOM_HOPS_KEY, next);
  return [...HOP_PRESETS, ...next];
}

export function getYeastPresets(): YeastPreset[] {
  const custom = loadJson<YeastPreset[]>(CUSTOM_YEASTS_KEY, []);
  return [...YEAST_PRESETS, ...custom];
}

export function addCustomYeast(p: YeastPreset): YeastPreset[] {
  const list = loadJson<YeastPreset[]>(CUSTOM_YEASTS_KEY, []);
  const next = [...list.filter((x) => x.name !== p.name), p];
  saveJson(CUSTOM_YEASTS_KEY, next);
  return [...YEAST_PRESETS, ...next];
}

// Additional Ingredients presets (grouped)
export type OtherIngredientCategory =
  | "water-agent"
  | "fining"
  | "spice"
  | "flavor"
  | "herb"
  | "other";

export const OTHER_INGREDIENT_PRESETS: Record<
  OtherIngredientCategory,
  readonly string[]
> = {
  "water-agent": [
    "Acetic acid",
    "Acid blend",
    "Ascorbic Acid",
    "Baking Soda",
    "Calcium Chloride (anhydrous)",
    "Calcium Chloride (dihydrate)",
    "Campden Tablets",
    "Canning Salt",
    "Chalk",
    "Citric acid",
    "CRS/AMS",
    "Epsom Salt",
    "Gypsum",
    "Hydrochloric acid",
    "Lactic acid",
    "Lye",
    "Magnesium Chloride",
    "Phosphoric acid",
    "Potassium Metabisulfite",
    "Slaked Lime",
    "Sodium Ascorbate",
    "Sodium Bicarbonate",
    "Sulfuric acid",
    "Table Salt",
    "Tartaric acid",
    "Five Star 5.2 pH Stabilizer",
  ],
  fining: [
    "Biofine Clear",
    "Brewers Clarex",
    "Fermcap",
    "Gelatin",
    "Irish Moss",
    "Koppafloc",
    "Koppakleer",
    "Magicol",
    "Protafloc",
    "Whirlfloc",
    "White Labs Clarity Ferm",
    "White Labs Ultra-Ferm",
    "White Labs Crystalzyme",
    "White Labs Rapidase",
  ],
  spice: [
    "Allspice",
    "Cinnamon",
    "Cinnamon stick",
    "Clove",
    "Coriander Seed",
    "Ginger",
    "Grains of paradise",
    "Lemon Zest",
    "Lemongrass",
    "Lime Zest",
    "Mulling Spices",
    "Nutmeg",
    "Orange Zest",
    "Pumpkin pie spice",
    "Sea salt",
    "Vanilla Bean",
    "Vanilla extract",
  ],
  flavor: [
    "Bitter Orange Peel",
    "Cocao Nibs",
    "Cocoa powder",
    "Coffee",
    "Grapefruit Peel",
    "Hungarian Oak Cubes",
    "Lemon peel",
    "Lime Zest",
    "Oak Cubes Medium Toast",
    "Sweet Orange Peel",
    "Toasted Coconut",
  ],
  herb: ["Hibiscus"],
  other: [
    "Brewtan B",
    "Diammonium Phosphate (DAP)",
    "Diatomaceous Earth",
    "Fermaid K",
    "Fermaid O",
    "Go-Ferm",
    "Phantasm Powder",
    "Servomyces",
    "Yeast Energizer",
    "Yeast Nutrient",
  ],
};

export function getOtherIngredientPresets(): Record<
  OtherIngredientCategory,
  readonly string[]
> {
  return OTHER_INGREDIENT_PRESETS;
}
