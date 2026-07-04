import type { Recipe, Hop } from "@/modules/recipe/models/Recipe";
import { recipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import {
  waterChemistryService,
  type WaterProfile,
} from "@/modules/recipe/services/WaterChemistryService";
import { getBjcpStyleSpec, type RangeTuple } from "@/utils/bjcpSpecs";
import { matchBjcpStyle } from "@/utils/bjcpMatching";
import { hsTokens } from "@/modules/builder/tokens";

// Maps a real Recipe into the data the builder mock renders. The mock is hardcoded
// to a sample for the marketing tour; when a signed-in user views the homepage,
// we feed their recipe through this so every tab shows their actual brew. The
// tour never uses this (it keeps the hardcoded sample), so the beats are
// unaffected — this only powers the at-rest, signed-in hero.

const KG_TO_LB = 2.20462;
const G_TO_OZ = 0.0352739619;
const L_TO_GAL = 0.264172;

export type BuilderMockGrain = {
  name: string;
  category: string;
  weight: string;
  lb: number;
  srm: number;
  /** Unrounded °L straight off the fermentable — input for the malt-archetype
   *  matcher (the grain flavor radar), where the rounded display srm won't do. */
  lovibond: number;
};
export type BuilderMockHop = {
  name: string;
  amount: string;
  use: string;
  purpose: string;
  aa: string;
  ibu: number;
  // Raw addition fields, passed through for the hop flavor radar (the
  // dose/timing-weighted aggregation needs more than the display strings).
  grams: number;
  hopType: Hop["type"];
  timeMinutes?: number;
  temperatureC?: number;
  whirlpoolTimeMinutes?: number;
  flavor?: Hop["flavor"];
};
export type BuilderMockFermStep = {
  label: string;
  temp: string;
  days: number;
  color: string;
  dark: boolean;
  carb: boolean;
};
export type BuilderMockSalt = { short: string; name: string; grams: number };

export type BrewSheetData = {
  title: string;
  status: string;
  brewData: { label: string; value: string }[];
  targets: { label: string; value: string; srm?: number }[];
  yeast: { label: string; value: string }[];
  grains: { name: string; amount: string; srm: number }[];
  hops: { name: string; amount: string; use: string }[];
  water: { salts: string; profile: string; volumes: string };
  mash: string;
};

export type BuilderMockData = {
  name: string;
  style: string;
  batch: string;
  /** Batch volume in liters — the hop flavor aggregation's dose denominator. */
  batchL: number;
  profile: string;
  stats: { og: number; fg: number; abv: number; ibu: number; cal: number; srm: number };
  ranges: {
    og?: RangeTuple;
    fg?: RangeTuple;
    abv?: RangeTuple;
    ibu?: RangeTuple;
    srm?: RangeTuple;
  } | null;
  grains: BuilderMockGrain[];
  grainTotalLb: number;
  hops: BuilderMockHop[];
  mash: {
    stepName: string;
    tempF: number;
    timeMin: number;
    strikeF: string;
    mashWater: string;
    sparge: string;
    phValue: number | null;
  } | null;
  water: {
    sourceName: string;
    targetName: string;
    salts: BuilderMockSalt[];
    ions: Record<string, number>;
  };
  yeast: {
    name: string;
    lab: string;
    attenPct: number;
    tempF: string;
    flocc: string;
    starter: { sizeText: string; pitchText: string } | null;
  } | null;
  fermentation: BuilderMockFermStep[];
  brewSheet: BrewSheetData;
};

function classifyGrain(srm: number, name?: string): string {
  if (name) {
    const n = name.toLowerCase();
    if (/(roast|chocolate|black|carafa|debittered)/.test(n)) return "Roast";
    if (/(crystal|caramel|cara[- ]?)/.test(n)) return "Caramel";
    if (/(wheat|rye|oat|flaked|rice|corn|adjunct|sugar|honey|lactose|dextrose)/.test(n)) {
      return "Adjunct";
    }
    if (/(munich|vienna|aromatic|melanoidin)/.test(n)) return "Base · kilned";
  }
  if (srm > 60) return "Roast";
  if (srm > 20) return "Caramel";
  return "Base malt";
}

function hopUse(h: Hop): string {
  switch (h.type) {
    case "boil":
      return `boil ${h.timeMinutes ?? 0}`;
    case "first wort":
      return "first wort";
    case "whirlpool":
      return "whirlpool";
    case "dry hop":
      return "dry hop";
    case "mash":
      return "mash";
  }
}

function hopPurpose(h: Hop): string {
  if (h.type === "dry hop" || h.type === "whirlpool") return "Aroma";
  if (h.type === "boil" && (h.timeMinutes ?? 0) <= 20) return "Aroma";
  return "Bittering";
}

function inferYeastTempRange(name?: string): string {
  if (!name) return "62-72°F";
  const n = name.toLowerCase();
  if (/(saison|french|belgian|hothead|brett)/.test(n)) return "70-85°F";
  if (/(lager|pilsen|munich|w-?34|s-?23)/.test(n)) return "48-58°F";
  if (/(kveik|voss|hornindal)/.test(n)) return "70-95°F";
  return "62-72°F";
}

function inferFlocc(attenuation: number): string {
  if (attenuation > 0.82) return "Low";
  if (attenuation < 0.72) return "High";
  return "Med";
}

function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}
function lToGal(l: number): string {
  return `${(l * L_TO_GAL).toFixed(1)} gal`;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function fmtLb(kg: number): string {
  const lb = kg * KG_TO_LB;
  return `${lb >= 10 ? lb.toFixed(1) : lb.toFixed(2)} lb`;
}
function fmtOz(g: number): string {
  const oz = g * G_TO_OZ;
  return `${oz < 0.1 ? oz.toFixed(2) : oz.toFixed(1)}oz`;
}

// Real builder's stepTypeColor: primary=honey, diacetyl-rest=roast,
// cold-crash=#7faec9, conditioning/secondary=water. Keg/carb = honey + stripe.
function fermColor(type: string): { color: string; dark: boolean } {
  switch (type) {
    case "diacetyl-rest":
      return { color: hsTokens.roast, dark: true };
    case "cold-crash":
      return { color: "#7faec9", dark: false };
    case "secondary":
    case "conditioning":
      return { color: hsTokens.water, dark: false };
    default:
      return { color: hsTokens.honey, dark: false };
  }
}

export function mapRecipeToBuilderMock(recipe: Recipe): BuilderMockData {
  const calc = recipeCalculationService.calculate(recipe);

  // ── Style + ranges ──
  // Resolve the style through the shared matcher rather than assuming the
  // builder's "21A. American IPA" prefix format: browse/imported recipes carry
  // bare names ("American IPA"), aliases, or free text, and the old
  // split(".") lookup returned no spec for those — which is why the BJCP
  // range gauges only worked for builder-authored recipes.
  const match = matchBjcpStyle(recipe.style ?? "");
  const code = match.autoAccept ? match.best?.preset.code : undefined;
  const spec = getBjcpStyleSpec(code);
  const styleDisplay = match.canonical ?? (recipe.style?.trim() || "Custom style");

  // ── Grains ── (every fermentable; the mock body scrolls its grain ledger
  // so long bills aren't truncated — see TabSections FermentablesSection)
  const totalGrainKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
  const grains: BuilderMockGrain[] = recipe.fermentables.map((f) => ({
    name: f.name,
    category: classifyGrain(f.colorLovibond, f.name),
    weight: fmtLb(f.weightKg),
    lb: f.weightKg * KG_TO_LB,
    srm: Math.round(f.colorLovibond),
    lovibond: f.colorLovibond,
  }));

  // ── Hops ── (every hop; the mock body scrolls the hop bill — see BuilderMock
  // section-hops. Distribute computed total IBU by weight × time × alpha proxy.)
  const totalIbu = Math.max(0, calc.ibu);
  const hopsArr = recipe.hops;
  const weights = hopsArr.map(
    (h) => h.grams * (h.alphaAcid / 100) * ((h.timeMinutes ?? 5) + 1),
  );
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const hops: BuilderMockHop[] = hopsArr.map((h, i) => ({
    name: h.name,
    amount: fmtOz(h.grams),
    use: hopUse(h),
    purpose: hopPurpose(h),
    aa: `${h.alphaAcid.toFixed(1)}% AA`,
    ibu: weightSum > 0 ? Math.round((weights[i] / weightSum) * totalIbu) : 0,
    grams: h.grams,
    hopType: h.type,
    timeMinutes: h.timeMinutes,
    temperatureC: h.temperatureC,
    whirlpoolTimeMinutes: h.whirlpoolTimeMinutes,
    flavor: h.flavor,
  }));

  // ── Mash ──
  const firstStep = recipe.mashSteps[0];
  const mash = firstStep
    ? {
        stepName: firstStep.name || "Saccharification rest",
        tempF: cToF(firstStep.temperatureC),
        timeMin: Math.round(firstStep.durationMinutes),
        strikeF: calc.strikeTempC != null ? `${cToF(calc.strikeTempC)}°F` : "—",
        mashWater: lToGal(calc.mashWaterL),
        sparge: lToGal(calc.spargeWaterL),
        phValue: calc.estimatedMashPh,
      }
    : null;

  // ── Water ──
  const wc = recipe.waterChemistry;
  const sa = wc?.saltAdditions;
  const salts: BuilderMockSalt[] = [
    { short: "CaSO₄", name: "Gypsum", grams: round1(sa?.gypsum_g ?? 0) },
    { short: "CaCl₂", name: "Calcium Chloride", grams: round1(sa?.cacl2_g ?? 0) },
    { short: "MgSO₄", name: "Epsom", grams: round1(sa?.epsom_g ?? 0) },
    { short: "NaCl", name: "Salt", grams: round1(sa?.nacl_g ?? 0) },
  ];
  const sourceProfile: WaterProfile = wc?.sourceProfile ?? {
    Ca: 0,
    Mg: 0,
    Na: 0,
    Cl: 0,
    SO4: 0,
    HCO3: 0,
  };
  let ions: Record<string, number> = { ...sourceProfile };
  try {
    if (wc) {
      ions = waterChemistryService.calculateFinalProfileFromTotalSalts(
        sourceProfile,
        wc.saltAdditions,
        Math.max(0, calc.mashWaterL),
        Math.max(0, calc.spargeWaterL),
      ) as unknown as Record<string, number>;
    }
  } catch {
    ions = { ...sourceProfile };
  }

  // ── Yeast ──
  const fy = recipe.yeasts[0];
  const yeast = fy
    ? {
        name: fy.name,
        lab: fy.laboratory ?? "—",
        attenPct: Math.round(fy.attenuation * 100),
        tempF: inferYeastTempRange(fy.name),
        flocc: inferFlocc(fy.attenuation),
        starter: fy.starter
          ? {
              sizeText:
                fy.starter.steps[0] != null
                  ? `${fy.starter.steps[0].liters} L starter`
                  : `${fy.starter.packs} pack${fy.starter.packs === 1 ? "" : "s"}`,
              pitchText: `${fy.starter.packs} ${fy.starter.yeastType}`,
            }
          : null,
      }
    : null;

  // ── Fermentation ──
  const fermentation: BuilderMockFermStep[] = recipe.fermentationSteps.map((s) => {
    const c = fermColor(s.type);
    return {
      label: s.name || s.type,
      temp: `${cToF(s.temperatureC)}°F`,
      days: Math.max(1, Math.round(s.durationDays)),
      color: c.color,
      dark: c.dark,
      carb: false,
    };
  });
  // Append a carbonation segment if the recipe packages (keg or bottle).
  if (recipe.packaging?.methods?.length) {
    const isKeg = recipe.packaging.methods.includes("keg");
    fermentation.push({
      label: isKeg ? "Keg" : "Bottle",
      temp: isKeg
        ? `${round1(recipe.packaging.targetCo2Volumes ?? 2.4)} vol`
        : `${recipe.packaging.conditioningTempC != null ? cToF(recipe.packaging.conditioningTempC) + "°F" : "cond"}`,
      days: Math.max(1, Math.round(recipe.packaging.conditioningDays ?? 7)),
      color: hsTokens.honey,
      dark: false,
      carb: true,
    });
  }

  // ── Brew sheet (real data, no scripted pre-boil miss) ──
  const batchGal = (recipe.batchVolumeL * L_TO_GAL).toFixed(1);
  const boilMin = Math.round(recipe.equipment.boilTimeMin);
  const brewSheet: BrewSheetData = {
    title: recipe.name || "Brew sheet.",
    status: "Planned",
    brewData: [
      { label: "Batch", value: `${batchGal} gal` },
      { label: "Boil", value: `${boilMin} min` },
      { label: "Setup", value: recipe.equipmentProfileName || "Custom" },
      { label: "Eff", value: `${Math.round(recipe.equipment.brewhouseEfficiencyPercent)}%` },
    ],
    targets: [
      { label: "OG", value: calc.og.toFixed(3) },
      { label: "FG", value: calc.fg.toFixed(3) },
      { label: "ABV", value: `${calc.abv.toFixed(1)}%` },
      { label: "IBU", value: `${Math.round(calc.ibu)}` },
      { label: "SRM", value: calc.srm.toFixed(1), srm: Math.max(1, calc.srm) },
    ],
    yeast: fy
      ? [
          { label: "Strain", value: fy.name },
          { label: "Atten", value: `${Math.round(fy.attenuation * 100)}%` },
          { label: "Lab", value: fy.laboratory ?? "—" },
        ]
      : [{ label: "Yeast", value: "—" }],
    grains: grains.map((g) => ({ name: g.name, amount: g.weight, srm: g.srm })),
    hops: hops.map((h) => ({ name: h.name, amount: h.amount, use: h.use })),
    water: {
      salts: salts
        .filter((s) => s.grams > 0)
        .map((s) => `${s.name} ${s.grams}`)
        .join(" · ") || "none",
      profile: `Ca ${Math.round(ions.Ca ?? 0)} · SO₄ ${Math.round(ions.SO4 ?? 0)} · Cl ${Math.round(ions.Cl ?? 0)}`,
      volumes: `Mash ${lToGal(calc.mashWaterL)} · Sparge ${lToGal(calc.spargeWaterL)}`,
    },
    mash: mash ? `${mash.stepName} · ${mash.tempF}°F for ${mash.timeMin} min` : "—",
  };

  return {
    name: recipe.name || "Untitled recipe",
    style: styleDisplay,
    batch: `${batchGal} gal · ${boilMin} min`,
    batchL: recipe.batchVolumeL,
    profile: recipe.equipmentProfileName || "Custom",
    stats: {
      og: calc.og,
      fg: calc.fg,
      abv: calc.abv,
      ibu: calc.ibu,
      cal: calc.calories,
      srm: Math.max(0.1, calc.srm),
    },
    ranges: spec
      ? { og: spec.og, fg: spec.fg, abv: spec.abv, ibu: spec.ibu, srm: spec.srm }
      : null,
    grains,
    grainTotalLb: totalGrainKg * KG_TO_LB,
    hops,
    mash,
    water: {
      sourceName: wc?.sourceProfileName || "RO",
      targetName: wc?.targetStyleName || "Custom",
      salts,
      ions,
    },
    yeast,
    fermentation,
    brewSheet,
  };
}
