import { loadJson, saveJson } from "./storage";
// Single source of truth for fermentables (generated offline and committed)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import handled by bundler
import GENERATED_GRAINS from "./presets.generated.grains.json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import handled by bundler
import GENERATED_HOPS from "./presets.generated.hops.json";

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

export type YeastPreset = {
  name: string;
  attenuationPercent?: number;
  category: string; // e.g., "Escarpment Labs", "Wyeast", "Fermentis"
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

export const YEAST_PRESETS: YeastPreset[] = [
  // Escarpment Labs
  {
    name: "American Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "Anchorman Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "Ardennes Belgian Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "Arset Kveik Blend",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  { name: "Belgian Sour Blend", category: "Escarpment Labs" },
  { name: "Berliner Brett I", category: "Escarpment Labs" },
  {
    name: "Biergarten Lager",
    category: "Escarpment Labs",
    attenuationPercent: 0.73,
  },
  { name: "Brett B", category: "Escarpment Labs" },
  { name: "Brett D", category: "Escarpment Labs" },
  { name: "Brett Q", category: "Escarpment Labs" },
  { name: "Brussels Brett", category: "Escarpment Labs" },
  { name: "Cali Ale", category: "Escarpment Labs", attenuationPercent: 0.78 },
  { name: "Cerberus", category: "Escarpment Labs", attenuationPercent: 0.75 },
  {
    name: "Classic Witbier",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "Copenhagen Lager",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "Czech Lager",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "Dry Belgian Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "Ebbegarden Kveik Blend",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "English Ale I",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "English Ale II",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "English Ale III",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "Foggy London Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "Fruit Bomb Saison",
    category: "Escarpment Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "Fruity Witbier",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "Hornindal Kveik Blend",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  { name: "Irish Ale", category: "Escarpment Labs", attenuationPercent: 0.75 },
  { name: "Isar Lager", category: "Escarpment Labs", attenuationPercent: 0.78 },
  { name: "Kolsch Ale", category: "Escarpment Labs", attenuationPercent: 0.78 },
  { name: "Krispy", category: "Escarpment Labs", attenuationPercent: 0.76 },
  { name: "Lactobacillus Blend 2.0", category: "Escarpment Labs" },
  { name: "Lactobacillus brevis", category: "Escarpment Labs" },
  {
    name: "Mexican Lager",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "Munich Lager",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "New World Saison",
    category: "Escarpment Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "Old World Saison Blend",
    category: "Escarpment Labs",
    attenuationPercent: 0.85,
  },
  {
    name: "Ontario Farmhouse Ale Blend",
    category: "Escarpment Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "Saison Maison",
    category: "Escarpment Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "Skare Kveik",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "Spooky Saison",
    category: "Escarpment Labs",
    attenuationPercent: 0.85,
  },
  {
    name: "St-Remy Abbey Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "St. Lucifer Belgian Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "Stirling Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.75,
  },
  { name: "Uberweizen", category: "Escarpment Labs", attenuationPercent: 0.8 },
  {
    name: "Vermont Ale",
    category: "Escarpment Labs",
    attenuationPercent: 0.78,
  },
  { name: "Voss Kveik", category: "Escarpment Labs", attenuationPercent: 0.78 },
  { name: "Weizen I", category: "Escarpment Labs", attenuationPercent: 0.8 },
  { name: "Wild Thing", category: "Escarpment Labs", attenuationPercent: 0.85 },

  // Wyeast
  { name: "1056 American Ale", category: "Wyeast", attenuationPercent: 0.77 },
  { name: "1318 London Ale III", category: "Wyeast", attenuationPercent: 0.75 },
  { name: "1084 Irish Ale", category: "Wyeast", attenuationPercent: 0.75 },
  { name: "1968 London ESB Ale", category: "Wyeast", attenuationPercent: 0.73 },
  { name: "2565 Kölsch", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "3711 French Saison", category: "Wyeast", attenuationPercent: 0.85 },
  {
    name: "3787 Trappist High Gravity",
    category: "Wyeast",
    attenuationPercent: 0.8,
  },
  { name: "1010 American Wheat", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "1028 London Ale", category: "Wyeast", attenuationPercent: 0.75 },
  { name: "1098 British Ale", category: "Wyeast", attenuationPercent: 0.75 },
  {
    name: "1272 American Ale II",
    category: "Wyeast",
    attenuationPercent: 0.77,
  },
  { name: "1332 Northwest Ale", category: "Wyeast", attenuationPercent: 0.75 },
  {
    name: "1450 Denny's Favorite 50 Ale",
    category: "Wyeast",
    attenuationPercent: 0.77,
  },
  { name: "1728 Scottish Ale", category: "Wyeast", attenuationPercent: 0.75 },
  { name: "1764 Pacman", category: "Wyeast", attenuationPercent: 0.78 },
  {
    name: "2001 Pilsner Urquell H-Strain",
    category: "Wyeast",
    attenuationPercent: 0.78,
  },
  { name: "2007 Pilsen Lager", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "2042 Danish Lager", category: "Wyeast", attenuationPercent: 0.78 },
  {
    name: "2112 California Lager",
    category: "Wyeast",
    attenuationPercent: 0.78,
  },
  { name: "2124 Bohemian Lager", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "2206 Bavarian Lager", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "2278 Czech Pils", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "2308 Munich Lager", category: "Wyeast", attenuationPercent: 0.78 },
  {
    name: "3068 Weihenstephan Weizen",
    category: "Wyeast",
    attenuationPercent: 0.8,
  },
  { name: "3333 German Wheat", category: "Wyeast", attenuationPercent: 0.78 },
  { name: "3724 Belgian Saison", category: "Wyeast", attenuationPercent: 0.85 },
  { name: "3726 Farmhouse Ale", category: "Wyeast", attenuationPercent: 0.85 },

  // Fermentis (Standard Dry Yeasts)
  { name: "SafAle BE-134", category: "Fermentis", attenuationPercent: 0.85 },
  { name: "SafAle BE-256", category: "Fermentis", attenuationPercent: 0.8 },
  { name: "SafAle F-2", category: "Fermentis", attenuationPercent: 0.9 },
  { name: "SafAle K-97", category: "Fermentis", attenuationPercent: 0.75 },
  { name: "SafAle S-04", category: "Fermentis", attenuationPercent: 0.75 },
  { name: "SafAle S-33", category: "Fermentis", attenuationPercent: 0.7 },
  { name: "SafAle T-58", category: "Fermentis", attenuationPercent: 0.7 },
  { name: "SafAle US-05", category: "Fermentis", attenuationPercent: 0.78 },
  { name: "SafAle WB-06", category: "Fermentis", attenuationPercent: 0.8 },
  { name: "SafBrew DA-16", category: "Fermentis", attenuationPercent: 0.9 },
  { name: "SafBrew HA-18", category: "Fermentis", attenuationPercent: 0.9 },
  { name: "SafBrew LA-01", category: "Fermentis", attenuationPercent: 0.85 },
  { name: "SafLager S-189", category: "Fermentis", attenuationPercent: 0.82 },
  { name: "SafLager S-23", category: "Fermentis", attenuationPercent: 0.78 },
  { name: "SafLager W-34/70", category: "Fermentis", attenuationPercent: 0.82 },
  { name: "SafSour LP 652", category: "Fermentis" },

  // Lallemand (Standard Dry Yeasts)
  { name: "LalBrew Abbaye", category: "Lallemand", attenuationPercent: 0.75 },
  {
    name: "LalBrew Belle Saison",
    category: "Lallemand",
    attenuationPercent: 0.85,
  },
  {
    name: "LalBrew BRY-97 American West Coast Ale",
    category: "Lallemand",
    attenuationPercent: 0.78,
  },
  { name: "LalBrew CBC-1", category: "Lallemand", attenuationPercent: 0.75 },
  {
    name: "LalBrew Diamond Lager",
    category: "Lallemand",
    attenuationPercent: 0.78,
  },
  { name: "LalBrew Koln", category: "Lallemand", attenuationPercent: 0.78 },
  { name: "LalBrew London", category: "Lallemand", attenuationPercent: 0.75 },
  {
    name: "LalBrew Munich Classic",
    category: "Lallemand",
    attenuationPercent: 0.75,
  },
  {
    name: "LalBrew New England",
    category: "Lallemand",
    attenuationPercent: 0.78,
  },
  {
    name: "LalBrew Nottingham",
    category: "Lallemand",
    attenuationPercent: 0.75,
  },
  {
    name: "LalBrew Verdant IPA",
    category: "Lallemand",
    attenuationPercent: 0.78,
  },
  {
    name: "LalBrew Voss Kveik",
    category: "Lallemand",
    attenuationPercent: 0.8,
  },
  { name: "LalBrew Windsor", category: "Lallemand", attenuationPercent: 0.75 },
  { name: "LalBrew Wit", category: "Lallemand", attenuationPercent: 0.75 },
  {
    name: "Prise de Mousse Wine Yeast",
    category: "Lallemand",
    attenuationPercent: 1.0,
  },
  { name: "Sourvisiae", category: "Lallemand" },
  { name: "WildBrew Philly Sour", category: "Lallemand" },

  // Imperial Yeast (limited to common use)
  {
    name: "Imperial Organic Yeast A07 Flagship",
    category: "Imperial Yeast",
    attenuationPercent: 0.78,
  },

  // Omega Yeast
  {
    name: "Omega Yeast OYL-004 West Coast Ale I",
    category: "Omega Yeast",
    attenuationPercent: 0.78,
  },
  {
    name: "OYL-006 Voss Kveik",
    category: "Omega Yeast",
    attenuationPercent: 0.8,
  },
  {
    name: "OYL-011 British Ale I",
    category: "Omega Yeast",
    attenuationPercent: 0.75,
  },
  {
    name: "OYL-013 London Ale",
    category: "Omega Yeast",
    attenuationPercent: 0.75,
  },
  { name: "OYL-024 Dry Hop", category: "Omega Yeast", attenuationPercent: 0.8 },
  {
    name: "OYL-030 Tropical IPA",
    category: "Omega Yeast",
    attenuationPercent: 0.8,
  },
  {
    name: "OYL-033 Hornindal Kveik",
    category: "Omega Yeast",
    attenuationPercent: 0.8,
  },
  {
    name: "OYL-041 DIPA Ale",
    category: "Omega Yeast",
    attenuationPercent: 0.78,
  },
  {
    name: "OYL-052 Omega HotHead Ale",
    category: "Omega Yeast",
    attenuationPercent: 0.75,
  },
  {
    name: "OYL-057 Wallonian Farmhouse",
    category: "Omega Yeast",
    attenuationPercent: 0.85,
  },
  {
    name: "OYL-061 Lutra Kveik",
    category: "Omega Yeast",
    attenuationPercent: 0.85,
  },
  { name: "OYL-101 Saisonstein's Monster", category: "Omega Yeast" },
  {
    name: "OYL-200 Kolsch I",
    category: "Omega Yeast",
    attenuationPercent: 0.78,
  },
  {
    name: "OYL-203 Hefe Weizen",
    category: "Omega Yeast",
    attenuationPercent: 0.8,
  },
  { name: "OYL-300 Lactobacillus Blend", category: "Omega Yeast" },
  {
    name: "OYL-400 American Lager",
    category: "Omega Yeast",
    attenuationPercent: 0.78,
  },
  {
    name: "OYL-500 Belgian Ale A",
    category: "Omega Yeast",
    attenuationPercent: 0.75,
  },

  // White Labs
  {
    name: "WLP001 California Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP002 English Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "WLP007 Dry English Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "WLP008 East Coast Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "WLP013 London Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.75,
  },
  {
    name: "WLP029 German Ale/Kölsch Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP051 California Ale V Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP066 London Fog Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP300 Hefeweizen Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "WLP500 Trappist Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.8,
  },
  {
    name: "WLP530 Abbey Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP550 Belgian Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP565 Belgian Saison I Ale Yeast",
    category: "White Labs",
    attenuationPercent: 0.85,
  },
  {
    name: "WLP800 Pilsner Lager Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP830 German Lager Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP833 German Bock Lager Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP838 Southern German Lager Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
  {
    name: "WLP860 Munich Helles Yeast",
    category: "White Labs",
    attenuationPercent: 0.78,
  },
];

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
