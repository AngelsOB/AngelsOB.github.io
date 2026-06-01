import type { Recipe, Hop } from "@/modules/beta-builder/domain/models/Recipe";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { hsTokens } from "@/modules/hopskip/tokens";

export type MockFermentable = {
  name: string;
  category: string;
  srm: number;
  weight: string;
  percent: string;
};

export type MockHop = {
  name: string;
  usage: string;
  color: string;
  weight: string;
  time: string;
  aa: string;
  ibu: number;
};

export type MockMashStep = {
  name: string;
  temp: string;
  time: string;
  color: string;
  kind: string;
};

export type MockYeast = {
  name: string;
  lab: string;
  attenuation: number;
  tempRange: string;
  flocc: string;
  pitch: string;
};

export type MockSalt = {
  key: "gypsum" | "cacl2" | "epsom" | "nacl" | "nahco3";
  label: string;
  formula: string;
  grams: number;
};

export type MockData = {
  name: string;
  style: string;
  batch: string;
  profile: string;
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  cal: number;
  srm: number;
  fermentables: MockFermentable[];
  fermentablesTotalLb: string;
  hops: MockHop[];
  mashSteps: MockMashStep[];
  yeast: MockYeast;
  water: {
    salts: MockSalt[];
    source: string;
    target: string;
    ions: { Ca: number; Mg: number; Na: number; SO4: number; Cl: number; HCO3: number };
  };
};

const KG_TO_LB = 2.20462;
const G_TO_OZ = 0.0352739619;

function classifyGrain(srm: number, name?: string): string {
  if (name) {
    const n = name.toLowerCase();
    if (/(roast|chocolate|black|carafa|debittered)/.test(n)) return "Roast";
    if (/(crystal|caramel|cara[- ]?)/.test(n)) return "Crystal";
    if (/(wheat|rye|oat|flaked|rice|corn|adjunct|sugar|honey|lactose|dextrose)/.test(n)) {
      return "Adjunct";
    }
  }
  if (srm > 60) return "Roast";
  if (srm > 20) return "Crystal";
  return "Base malt";
}

function usageLabel(type: Hop["type"]): string {
  switch (type) {
    case "boil":
      return "Boil";
    case "whirlpool":
      return "Whirlpool";
    case "dry hop":
      return "Dry hop";
    case "first wort":
      return "First wort";
    case "mash":
      return "Mash";
  }
}

function usageColor(type: Hop["type"]): string {
  switch (type) {
    case "boil":
      return hsTokens.hops;
    case "whirlpool":
      return hsTokens.yeast;
    case "dry hop":
      return hsTokens.water;
    case "first wort":
      return hsTokens.malt;
    case "mash":
      return hsTokens.roast;
  }
}

function hopTimeLabel(h: Hop): string {
  if (h.type === "boil" || h.type === "first wort") {
    return `${h.timeMinutes ?? 0} min`;
  }
  if (h.type === "whirlpool") {
    const t = h.temperatureC ?? 80;
    const f = Math.round((t * 9) / 5 + 32);
    return `${f}°F · ${h.whirlpoolTimeMinutes ?? 0} min`;
  }
  if (h.type === "dry hop") {
    return `${h.dryHopDays ?? 0} days`;
  }
  return "—";
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

function fmtKgAsLb(kg: number): string {
  const lb = kg * KG_TO_LB;
  if (lb >= 10) return `${lb.toFixed(1)} lb`;
  return `${lb.toFixed(2)} lb`;
}

function fmtGramsAsOz(g: number): string {
  const oz = g * G_TO_OZ;
  if (oz < 0.1) return `${oz.toFixed(2)} oz`;
  return `${oz.toFixed(1)} oz`;
}

function inferYeastTempRange(name?: string): string {
  if (!name) return "—";
  const n = name.toLowerCase();
  if (/(saison|french|belgian|hothead|brett)/.test(n)) return "70–85°F";
  if (/(lager|pilsen|munich|w-?34)/.test(n)) return "48–58°F";
  if (/(kveik|voss|hornindal)/.test(n)) return "70–95°F";
  return "62–72°F";
}

function inferFlocc(attenuation: number): string {
  if (attenuation > 0.82) return "Low";
  if (attenuation < 0.72) return "High";
  return "Medium";
}

export function mapRecipeToMock(recipe: Recipe): MockData {
  const calc = recipeCalculationService.calculate(recipe);

  const totalGrainKg = recipe.fermentables.reduce(
    (sum, f) => sum + f.weightKg,
    0
  );
  const totalGrainLb = totalGrainKg * KG_TO_LB;

  const fermentables: MockFermentable[] = recipe.fermentables
    .slice(0, 3)
    .map((f) => {
      const percent =
        totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
      return {
        name: f.name,
        category: classifyGrain(f.colorLovibond, f.name),
        srm: Math.round(f.colorLovibond),
        weight: fmtKgAsLb(f.weightKg),
        percent: `${percent.toFixed(percent >= 10 ? 0 : 1)}%`,
      };
    });

  const totalIbu = Math.max(0, calc.ibu);
  const hops: MockHop[] = recipe.hops.slice(0, 3).map((h, i, arr) => {
    // Distribute IBU proportionally to weight × time × alpha as rough proxy
    const weights = arr.map(
      (x) => x.grams * (x.alphaAcid / 100) * (x.timeMinutes ?? 5)
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const ibu = totalWeight > 0 ? Math.round((weights[i] / totalWeight) * totalIbu) : 0;
    return {
      name: h.name,
      usage: usageLabel(h.type),
      color: usageColor(h.type),
      weight: fmtGramsAsOz(h.grams),
      time: hopTimeLabel(h),
      aa: `${h.alphaAcid.toFixed(1)}% AA`,
      ibu,
    };
  });

  const mashSteps: MockMashStep[] = recipe.mashSteps.slice(0, 2).map((s, i) => ({
    name: s.name,
    temp: `${cToF(s.temperatureC)}°F`,
    time: `${s.durationMinutes} min`,
    color: i === 0 ? hsTokens.malt : hsTokens.roast,
    kind:
      s.temperatureC >= 75 ? "Mash out" : s.temperatureC >= 65 ? "Saccharification" : "Beta rest",
  }));

  const firstYeast = recipe.yeasts[0];
  const yeast: MockYeast = firstYeast
    ? {
        name: firstYeast.name,
        lab: firstYeast.laboratory ?? "—",
        attenuation: Math.round(firstYeast.attenuation * 100),
        tempRange: inferYeastTempRange(firstYeast.name),
        flocc: inferFlocc(firstYeast.attenuation),
        pitch: firstYeast.starter
          ? `${firstYeast.starter.packs} ${firstYeast.starter.yeastType}`
          : "1 sachet",
      }
    : DEFAULT_MOCK_DATA.yeast;

  // Water — pull salt additions from recipe if available, else defaults
  const wc = recipe.waterChemistry;
  const salts: MockSalt[] = wc
    ? [
        { key: "gypsum", label: "Gypsum", formula: "CaSO₄", grams: round1(wc.saltAdditions.gypsum_g ?? 0) },
        { key: "cacl2", label: "CaCl₂", formula: "CaCl₂", grams: round1(wc.saltAdditions.cacl2_g ?? 0) },
        { key: "epsom", label: "Epsom", formula: "MgSO₄", grams: round1(wc.saltAdditions.epsom_g ?? 0) },
        { key: "nacl", label: "NaCl", formula: "NaCl", grams: round1(wc.saltAdditions.nacl_g ?? 0) },
        { key: "nahco3", label: "Baking", formula: "NaHCO₃", grams: round1(wc.saltAdditions.nahco3_g ?? 0) },
      ]
    : DEFAULT_MOCK_DATA.water.salts;

  const ions = wc
    ? wc.sourceProfile
    : DEFAULT_MOCK_DATA.water.ions;

  return {
    name: recipe.name || "Untitled recipe",
    style: recipe.style ? `${recipe.style}` : "Custom style",
    batch: `${(recipe.batchVolumeL * 0.264172).toFixed(1)} gal · ${recipe.equipment.boilTimeMin} min`,
    profile: recipe.equipmentProfileName || "Custom",
    og: calc.og,
    fg: calc.fg,
    abv: calc.abv,
    ibu: calc.ibu,
    cal: calc.calories,
    srm: Math.max(1, calc.srm),
    fermentables,
    fermentablesTotalLb: totalGrainLb >= 10 ? `${totalGrainLb.toFixed(1)} lb` : `${totalGrainLb.toFixed(2)} lb`,
    hops,
    mashSteps,
    yeast,
    water: {
      salts,
      source: wc?.sourceProfileName || "RO",
      target: wc?.targetStyleName || "Custom",
      ions,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Default = the Citra Mosaic IPA we ship for signed-out users.
export const DEFAULT_MOCK_DATA: MockData = {
  name: "Citra Mosaic IPA",
  style: "American IPA · 21A",
  batch: "5 gal · 60 min",
  profile: "BIAB",
  og: 1.062,
  fg: 1.012,
  abv: 6.6,
  ibu: 52,
  cal: 198,
  srm: 6.2,
  fermentables: [
    { name: "Pale 2-Row", category: "Base malt", srm: 2, weight: "9.0 lb", percent: "75%" },
    { name: "Munich II", category: "Base malt", srm: 8, weight: "1.5 lb", percent: "12.5%" },
    { name: "Caramel 40", category: "Crystal", srm: 40, weight: "1.5 lb", percent: "12.5%" },
  ],
  fermentablesTotalLb: "12.0 lb",
  hops: [
    { name: "Citra", usage: "Boil", color: hsTokens.hops, weight: "0.5 oz", time: "60 min", aa: "12.4% AA", ibu: 22 },
    { name: "Mosaic", usage: "Boil", color: hsTokens.hops, weight: "1.5 oz", time: "10 min", aa: "11.8% AA", ibu: 18 },
    { name: "Citra", usage: "Whirlpool", color: hsTokens.yeast, weight: "1.0 oz", time: "180°F · 20 min", aa: "12.4% AA", ibu: 12 },
  ],
  mashSteps: [
    { name: "Mash in", temp: "152°F", time: "60 min", color: hsTokens.malt, kind: "Saccharification" },
    { name: "Mash out", temp: "168°F", time: "10 min", color: hsTokens.roast, kind: "Denature enzymes" },
  ],
  yeast: {
    name: "SafAle US-05",
    lab: "Fermentis · Dry",
    attenuation: 78,
    tempRange: "59–75°F",
    flocc: "Medium",
    pitch: "1 sachet · 11.5 g",
  },
  water: {
    salts: [
      { key: "gypsum", label: "Gypsum", formula: "CaSO₄", grams: 5.2 },
      { key: "cacl2", label: "CaCl₂", formula: "CaCl₂", grams: 1.8 },
      { key: "epsom", label: "Epsom", formula: "MgSO₄", grams: 0.4 },
      { key: "nacl", label: "NaCl", formula: "NaCl", grams: 0.3 },
      { key: "nahco3", label: "Baking", formula: "NaHCO₃", grams: 0 },
    ],
    source: "RO",
    target: "Hoppy Pale",
    ions: { Ca: 95, Mg: 12, Na: 18, SO4: 240, Cl: 70, HCO3: 28 },
  },
};
