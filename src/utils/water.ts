import { loadJson, saveJson } from "./storage";
import { uid } from "@/utils/uid";
// Basic water chemistry helpers for salt additions and ion profiles

export type WaterProfile = {
  Ca: number; // ppm
  Mg: number; // ppm
  Na: number; // ppm
  Cl: number; // ppm
  SO4: number; // ppm as sulfate
  HCO3: number; // ppm as bicarbonate
};

export const RO_PROFILE: WaterProfile = {
  Ca: 0,
  Mg: 0,
  Na: 0,
  Cl: 0,
  SO4: 0,
  HCO3: 0,
};

export type SaltAdditions = {
  gypsum_g?: number; // CaSO4·2H2O
  cacl2_g?: number; // CaCl2·2H2O
  epsom_g?: number; // MgSO4·7H2O
  nacl_g?: number; // NaCl
  nahco3_g?: number; // NaHCO3 (baking soda)
};

// Ion contributions per 1 g of salt added to 1 L of water (mg/L aka ppm)
// Mass fractions computed from molar masses.
// 1 g/L = 1000 mg/L, ppm contribution = mass_fraction * 1000
export const ION_PPM_PER_G_PER_L = {
  gypsum: {
    Ca: 0.2328 * 1000, // 40.078 / 172.169
    SO4: 0.5583 * 1000, // 96.061 / 172.169
  },
  cacl2: {
    Ca: 0.2726 * 1000, // 40.078 / 147.014
    Cl: 0.482 * 1000, // 70.906 / 147.014
  },
  epsom: {
    Mg: 0.0986 * 1000, // 24.305 / 246.471
    SO4: 0.3896 * 1000, // 96.061 / 246.471
  },
  nacl: {
    Na: 0.3934 * 1000, // 22.990 / 58.443
    Cl: 0.6066 * 1000, // 35.453 / 58.443
  },
  nahco3: {
    Na: 0.2737 * 1000, // 22.990 / 84.006
    HCO3: 0.7263 * 1000, // 61.016 / 84.006 (as bicarbonate)
  },
} as const;

export function addProfiles(a: WaterProfile, b: WaterProfile): WaterProfile {
  return {
    Ca: a.Ca + b.Ca,
    Mg: a.Mg + b.Mg,
    Na: a.Na + b.Na,
    Cl: a.Cl + b.Cl,
    SO4: a.SO4 + b.SO4,
    HCO3: a.HCO3 + b.HCO3,
  };
}

export function subtractProfiles(
  a: WaterProfile,
  b: WaterProfile
): WaterProfile {
  return {
    Ca: a.Ca - b.Ca,
    Mg: a.Mg - b.Mg,
    Na: a.Na - b.Na,
    Cl: a.Cl - b.Cl,
    SO4: a.SO4 - b.SO4,
    HCO3: a.HCO3 - b.HCO3,
  };
}

export function scaleProfile(p: WaterProfile, factor: number): WaterProfile {
  return {
    Ca: p.Ca * factor,
    Mg: p.Mg * factor,
    Na: p.Na * factor,
    Cl: p.Cl * factor,
    SO4: p.SO4 * factor,
    HCO3: p.HCO3 * factor,
  };
}

export function zeroProfile(): WaterProfile {
  return { ...RO_PROFILE };
}

// Compute ion delta (ppm) contributed by the given salts at a specific water volume.
// grams are total grams added to that volume, not per liter.
export function ionDeltaFromSalts(
  add: SaltAdditions,
  volumeL: number
): WaterProfile {
  const v = Math.max(0.0001, volumeL);
  const perL = (g?: number) => (g && g > 0 ? g / v : 0); // g/L
  const gyp = perL(add.gypsum_g);
  const cac = perL(add.cacl2_g);
  const eps = perL(add.epsom_g);
  const nac = perL(add.nacl_g);
  const nah = perL(add.nahco3_g);

  return {
    Ca:
      gyp * ION_PPM_PER_G_PER_L.gypsum.Ca + cac * ION_PPM_PER_G_PER_L.cacl2.Ca,
    Mg: eps * ION_PPM_PER_G_PER_L.epsom.Mg,
    Na: nac * ION_PPM_PER_G_PER_L.nacl.Na + nah * ION_PPM_PER_G_PER_L.nahco3.Na,
    Cl: cac * ION_PPM_PER_G_PER_L.cacl2.Cl + nac * ION_PPM_PER_G_PER_L.nacl.Cl,
    SO4:
      gyp * ION_PPM_PER_G_PER_L.gypsum.SO4 +
      eps * ION_PPM_PER_G_PER_L.epsom.SO4,
    HCO3: nah * ION_PPM_PER_G_PER_L.nahco3.HCO3,
  };
}

export function clampProfile(p: WaterProfile): WaterProfile {
  return {
    Ca: Math.max(0, p.Ca),
    Mg: Math.max(0, p.Mg),
    Na: Math.max(0, p.Na),
    Cl: Math.max(0, p.Cl),
    SO4: Math.max(0, p.SO4),
    HCO3: Math.max(0, p.HCO3),
  };
}

export function mixProfiles(
  volumesAndProfiles: Array<{ volumeL: number; profile: WaterProfile }>
): WaterProfile {
  const totalV = volumesAndProfiles.reduce(
    (s, x) => s + Math.max(0, x.volumeL),
    0
  );
  if (totalV <= 0.0001) return zeroProfile();
  const sum = volumesAndProfiles.reduce(
    (acc, { volumeL, profile }) => ({
      Ca: acc.Ca + profile.Ca * volumeL,
      Mg: acc.Mg + profile.Mg * volumeL,
      Na: acc.Na + profile.Na * volumeL,
      Cl: acc.Cl + profile.Cl * volumeL,
      SO4: acc.SO4 + profile.SO4 * volumeL,
      HCO3: acc.HCO3 + profile.HCO3 * volumeL,
    }),
    zeroProfile()
  );
  return scaleProfile(sum, 1 / totalV);
}

export function chlorideToSulfateRatio(profile: WaterProfile): number | null {
  const { Cl, SO4 } = profile;
  if (SO4 <= 0) return null;
  return Cl / SO4;
}

export const COMMON_WATER_PROFILES: Record<string, WaterProfile> = {
  RO: RO_PROFILE,
  Pilsen: { Ca: 7, Mg: 3, Na: 2, Cl: 5, SO4: 5, HCO3: 15 },
  Dortmund: { Ca: 225, Mg: 40, Na: 60, Cl: 180, SO4: 120, HCO3: 180 },
  Burton: { Ca: 275, Mg: 40, Na: 25, Cl: 35, SO4: 470, HCO3: 300 },
  Dublin: { Ca: 120, Mg: 4, Na: 12, Cl: 19, SO4: 53, HCO3: 319 },
  Vienna: { Ca: 163, Mg: 12, Na: 10, Cl: 40, SO4: 125, HCO3: 258 },
  Montreal: { Ca: 31, Mg: 8, Na: 15, Cl: 26, SO4: 22, HCO3: 0 },
};

export const ION_KEYS: Array<keyof WaterProfile> = [
  "Ca",
  "Mg",
  "Na",
  "Cl",
  "SO4",
  "HCO3",
];

export const DEFAULT_TOLERANCE_PPM = 20;

// Hover hints per ion, distilled from the quick reference guide
export const ION_HINTS: Record<keyof WaterProfile, string> = {
  Ca: [
    "Target: 50–200 ppm",
    "Function: pH control, enzymes, yeast health, hot break",
    "Flavor: neutral; >200 ppm can taste minerally",
    "Note: Critical for mash pH drop and clarity",
  ].join("\n"),
  Mg: [
    "Target: 15–30 ppm (malt contributes ~70 ppm)",
    "Function: yeast nutrient; pH control (half Ca)",
    "Flavor: >86 ppm can be sour/bitter",
    "Tip: Dark beers benefit from 30+ ppm",
  ].join("\n"),
  SO4: [
    "Target: 0–500 ppm (style dependent)",
    "Function: boosts hop expression and bitterness linger",
    "Flavor: dry, crisp, assertive",
    "Warn: Avoid high sulfate in delicate lagers",
  ].join("\n"),
  Cl: [
    "Target: 50–200 ppm",
    "Function: enhances malt body and mouthfeel",
    "Flavor: rounder, fuller, sweeter",
    "Warn: >300 ppm hurts clarity/stability",
  ].join("\n"),
  Na: [
    "Target: <100 ppm (avg ~35 ppm)",
    "Function: enhances flavor at low levels",
    "Flavor: sweetens malt; >150 ppm salty/harsh",
    "Tip: improves fullness in pale beers when <150 ppm",
  ].join("\n"),
  HCO3: [
    "Alkalinity proxy (bicarbonate)",
    "Function: pH buffering; higher for dark beers",
    "Rule: low alkalinity for light beers; higher for dark",
    "Critical: controls mash pH and flavor development",
  ].join("\n"),
};

// Convert alkalinity (as CaCO3) range to HCO3 range (~×1.22)
function alkRangeToHco3Range(min: number, max: number): [number, number] {
  const f = 61.016 / 50.0; // ≈1.22
  return [Math.round(min * f), Math.round(max * f)];
}

export type StyleTarget = {
  profile: WaterProfile; // midpoint for calc
  ranges?: Partial<Record<keyof WaterProfile, [number, number]>>; // display
  tips: string;
};

// Style-driven target profiles with ranges (when known)
export const STYLE_TARGETS: Record<string, StyleTarget> = {
  "Belgian Ale": {
    profile: { Ca: 60, Mg: 6, Na: 18, Cl: 79, SO4: 62, HCO3: 47 },
    ranges: {
      Ca: [50, 100],
      SO4: [50, 150],
      Cl: [50, 150],
      HCO3: alkRangeToHco3Range(0, 80),
      Mg: [5, 20],
      Na: [0, 50],
    },
    tips: [
      "Balanced chloride:sulfate for rounded malt with crisp finish",
      "Keep bicarbonate low (0-80ppm HCO3) for pale Abbey/Single grists",
      "Use CaCl₂ for body, small gypsum for hop expression",
      "Target 2:1 to 1:2 Cl:SO4 ratio - chloride for body, sulfate for crispness",
    ].join("\n"),
  },

  Pilsner: {
    profile: { Ca: 50, Mg: 8, Na: 8, Cl: 75, SO4: 25, HCO3: 24 },
    ranges: {
      Ca: [40, 70],
      SO4: [0, 50],
      Cl: [50, 100],
      HCO3: alkRangeToHco3Range(0, 40),
      Mg: [5, 15],
      Na: [0, 50],
    },
    tips: [
      "Avoid sulfate to preserve soft noble hop character",
      "Soft water + small CaCl₂ is ideal",
      "Keep bicarbonate low (0-40ppm HCO3) for negative RA with pale grists",
    ].join("\n"),
  },

  "American Pale Ale": {
    profile: { Ca: 75, Mg: 15, Na: 20, Cl: 50, SO4: 200, HCO3: 49 },
    ranges: {
      Ca: [50, 100],
      SO4: [100, 400],
      Cl: [0, 100],
      HCO3: alkRangeToHco3Range(0, 80),
      Mg: [10, 30],
      Na: [0, 100],
    },
    tips: [
      "Sulfate:Chloride 2:1–4:1 for crisp hop edge",
      "Target bicarbonate 0-80ppm HCO3 for RA about -30 to +30 ppm",
      "Keep chloride moderate to avoid muting hops",
    ].join("\n"),
  },

  "NEIPA / Hazy IPA": {
    profile: { Ca: 100, Mg: 20, Na: 20, Cl: 200, SO4: 75, HCO3: 49 },
    ranges: {
      Ca: [75, 150],
      SO4: [50, 150],
      Cl: [100, 300],
      HCO3: alkRangeToHco3Range(0, 80),
      Mg: [15, 30],
      Na: [0, 100],
    },
    tips: [
      "Chloride:Sulfate 2:1–3:1 for juicy fullness",
      "Higher chloride (150-250ppm) enhances mouthfeel and hop juiciness",
      "Keep sulfate modest (50-100ppm) to avoid astringency",
    ].join("\n"),
  },

  "Stout / Porter": {
    profile: { Ca: 60, Mg: 20, Na: 25, Cl: 100, SO4: 100, HCO3: 146 },
    ranges: {
      Ca: [50, 100],
      SO4: [50, 200],
      Cl: [75, 150],
      HCO3: alkRangeToHco3Range(100, 180),
      Mg: [15, 30],
      Na: [0, 100],
    },
    tips: [
      "Balanced Cl:SO₄ with higher bicarbonate (100-180ppm HCO3) for dark malts",
      "Target bicarbonate for RA 60–120 ppm to neutralize roasted grain acidity",
      "Higher calcium (75-100ppm) helps yeast in robust gravity ranges",
    ].join("\n"),
  },

  "German Helles": {
    profile: { Ca: 60, Mg: 15, Na: 10, Cl: 75, SO4: 25, HCO3: 73 },
    ranges: {
      Ca: [50, 80],
      SO4: [0, 50],
      Cl: [50, 100],
      HCO3: alkRangeToHco3Range(40, 100),
      Mg: [10, 25],
      Na: [0, 50],
    },
    tips: [
      "Low sulfate (0-30ppm) to emphasize malt smoothness",
      "Moderate bicarbonate (40-80ppm HCO3) for Munich malt character",
      "Balanced chloride (50-75ppm) for body without sweetness",
    ].join("\n"),
  },

  "English Bitter / ESB": {
    profile: { Ca: 100, Mg: 20, Na: 25, Cl: 75, SO4: 200, HCO3: 98 },
    ranges: {
      Ca: [75, 150],
      SO4: [150, 400],
      Cl: [50, 100],
      HCO3: alkRangeToHco3Range(60, 140),
      Mg: [15, 30],
      Na: [0, 100],
    },
    tips: [
      "Higher sulfate (200-350ppm) for traditional Burton-on-Trent character",
      "Sulfate:Chloride 2:1–4:1 for firm, dry hop expression",
      "Moderate bicarbonate (60-120ppm HCO3) balances crystal malts",
    ].join("\n"),
  },

  "Wheat Beer": {
    profile: { Ca: 50, Mg: 10, Na: 10, Cl: 50, SO4: 25, HCO3: 24 },
    ranges: {
      Ca: [40, 70],
      SO4: [0, 50],
      Cl: [25, 75],
      HCO3: alkRangeToHco3Range(0, 60),
      Mg: [5, 20],
      Na: [0, 50],
    },
    tips: [
      "Soft profile keeps all minerals minimal",
      "Low bicarbonate (0-40ppm HCO3) for negative RA with pale wheat grists",
      "Let yeast phenolics and wheat protein shine through",
    ].join("\n"),
  },

  "Strong Ale": {
    profile: { Ca: 100, Mg: 20, Na: 25, Cl: 100, SO4: 100, HCO3: 98 },
    ranges: {
      Ca: [75, 150],
      SO4: [75, 200],
      Cl: [75, 150],
      HCO3: alkRangeToHco3Range(60, 140),
      Mg: [15, 30],
      Na: [0, 100],
    },
    tips: [
      "Balanced minerals support rich malt complexity",
      "Tune Cl:SO₄ ratio for malt vs hop emphasis",
      "Higher gravity provides natural pH buffering but always verify mash pH",
    ].join("\n"),
  },
};
// ==========================
// Saved custom water profiles (localStorage)
// ==========================

export type SavedWaterProfile = {
  id: string;
  name: string;
  profile: WaterProfile;
};

const SAVED_WATER_PROFILES_KEY = "beerapp.waterProfiles";

export function loadSavedWaterProfiles(): SavedWaterProfile[] {
  return loadJson<SavedWaterProfile[]>(SAVED_WATER_PROFILES_KEY, []);
}

export function saveNewWaterProfile(
  name: string,
  profile: WaterProfile
): SavedWaterProfile {
  const list = loadSavedWaterProfiles();
  const item: SavedWaterProfile = { id: uid(), name, profile };
  const next = [item, ...list];
  saveJson(SAVED_WATER_PROFILES_KEY, next);
  return item;
}

export function updateSavedWaterProfile(
  id: string,
  name: string,
  profile: WaterProfile
): SavedWaterProfile | null {
  const list = loadSavedWaterProfiles();
  const idx = list.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const updated: SavedWaterProfile = { id, name, profile };
  const next = [...list.slice(0, idx), updated, ...list.slice(idx + 1)];
  saveJson(SAVED_WATER_PROFILES_KEY, next);
  return updated;
}

export function deleteSavedWaterProfile(id: string): void {
  const list = loadSavedWaterProfiles();
  const next = list.filter((x) => x.id !== id);
  saveJson(SAVED_WATER_PROFILES_KEY, next);
}
