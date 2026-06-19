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
    Ca: 0.2328 * 1000, // 40.078 / 172.164
    SO4: 0.5579 * 1000, // 96.056 / 172.164
  },
  cacl2: {
    Ca: 0.2726 * 1000, // 40.078 / 147.014
    Cl: 0.4823 * 1000, // 70.906 / 147.014
  },
  epsom: {
    Mg: 0.0986 * 1000, // 24.305 / 246.466
    SO4: 0.3897 * 1000, // 96.056 / 246.466
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
  const sum = volumesAndProfiles.reduce((acc, { volumeL, profile }) => {
    // Floor negative volumes here too (the denominator already does), so a
    // negative entry contributes nothing rather than subtracting — keeps the
    // result a true weighted average within the source profiles' bounds.
    const v = Math.max(0, volumeL);
    return {
      Ca: acc.Ca + profile.Ca * v,
      Mg: acc.Mg + profile.Mg * v,
      Na: acc.Na + profile.Na * v,
      Cl: acc.Cl + profile.Cl * v,
      SO4: acc.SO4 + profile.SO4 * v,
      HCO3: acc.HCO3 + profile.HCO3 * v,
    };
  }, zeroProfile());
  return scaleProfile(sum, 1 / totalV);
}

export function chlorideToSulfateRatio(profile: WaterProfile): number | null {
  const { Cl, SO4 } = profile;
  if (SO4 <= 0) return null;
  return Cl / SO4;
}

// The live, corrected set of built-in water profiles lives in
// WaterChemistryService.ts (COMMON_WATER_PROFILES). The legacy duplicate that
// used to sit here was removed in the Tier-1 water consolidation: it was unused
// (every importer reads the service's copy) and had drifted from it (e.g. the
// Montreal/Dortmund values).

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

// (Legacy STYLE_TARGETS removed — superseded by BEER_STYLE_TARGETS in
// src/modules/recipe/services/WaterChemistryService.ts)
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
