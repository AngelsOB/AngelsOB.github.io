/**
 * Water Chemistry Service
 *
 * Business logic for water chemistry calculations:
 * - Ion contributions from salt additions
 * - Profile mixing and scaling
 * - Chloride:Sulfate ratio
 */

import { optimizeSaltAdditions } from './WaterSaltOptimizer';

export type WaterProfile = {
  Ca: number; // ppm
  Mg: number; // ppm
  Na: number; // ppm
  Cl: number; // ppm
  SO4: number; // ppm as sulfate
  HCO3: number; // ppm as bicarbonate
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
    HCO3: 0.7263 * 1000, // 61.016 / 84.006
  },
} as const;

export class WaterChemistryService {
  /**
   * Compute ion delta (ppm) contributed by the given salts at a specific water volume.
   * @param add Salt additions in grams (total for that volume)
   * @param volumeL Water volume in liters
   */
  ionDeltaFromSalts(add: SaltAdditions, volumeL: number): WaterProfile {
    const v = Math.max(0.0001, volumeL);
    const perL = (g?: number) => (g && g > 0 ? g / v : 0); // g/L

    const gyp = perL(add.gypsum_g);
    const cac = perL(add.cacl2_g);
    const eps = perL(add.epsom_g);
    const nac = perL(add.nacl_g);
    const nah = perL(add.nahco3_g);

    return {
      Ca:
        gyp * ION_PPM_PER_G_PER_L.gypsum.Ca +
        cac * ION_PPM_PER_G_PER_L.cacl2.Ca,
      Mg: eps * ION_PPM_PER_G_PER_L.epsom.Mg,
      Na:
        nac * ION_PPM_PER_G_PER_L.nacl.Na +
        nah * ION_PPM_PER_G_PER_L.nahco3.Na,
      Cl:
        cac * ION_PPM_PER_G_PER_L.cacl2.Cl +
        nac * ION_PPM_PER_G_PER_L.nacl.Cl,
      SO4:
        gyp * ION_PPM_PER_G_PER_L.gypsum.SO4 +
        eps * ION_PPM_PER_G_PER_L.epsom.SO4,
      HCO3: nah * ION_PPM_PER_G_PER_L.nahco3.HCO3,
    };
  }

  /**
   * Add two water profiles together (ion by ion)
   */
  addProfiles(a: WaterProfile, b: WaterProfile): WaterProfile {
    return {
      Ca: a.Ca + b.Ca,
      Mg: a.Mg + b.Mg,
      Na: a.Na + b.Na,
      Cl: a.Cl + b.Cl,
      SO4: a.SO4 + b.SO4,
      HCO3: a.HCO3 + b.HCO3,
    };
  }

  /**
   * Scale a water profile by a factor
   */
  scaleProfile(p: WaterProfile, factor: number): WaterProfile {
    return {
      Ca: p.Ca * factor,
      Mg: p.Mg * factor,
      Na: p.Na * factor,
      Cl: p.Cl * factor,
      SO4: p.SO4 * factor,
      HCO3: p.HCO3 * factor,
    };
  }

  /**
   * Clamp all ion values to be non-negative
   */
  clampProfile(p: WaterProfile): WaterProfile {
    return {
      Ca: Math.max(0, p.Ca),
      Mg: Math.max(0, p.Mg),
      Na: Math.max(0, p.Na),
      Cl: Math.max(0, p.Cl),
      SO4: Math.max(0, p.SO4),
      HCO3: Math.max(0, p.HCO3),
    };
  }

  /**
   * Calculate the chloride to sulfate ratio
   * Returns null if SO4 is zero or negative
   */
  chlorideToSulfateRatio(profile: WaterProfile): number | null {
    const { Cl, SO4 } = profile;
    if (SO4 <= 0) return null;
    return Cl / SO4;
  }

  /**
   * Calculate the final water profile after adding salts to source water
   */
  calculateFinalProfile(
    sourceProfile: WaterProfile,
    saltAdditions: SaltAdditions,
    totalWaterL: number
  ): WaterProfile {
    const saltDelta = this.ionDeltaFromSalts(saltAdditions, totalWaterL);
    const finalProfile = this.addProfiles(sourceProfile, saltDelta);
    return this.clampProfile(finalProfile);
  }

  /**
   * Automatically split total salt additions between mash and sparge water proportionally
   * @param totalSalts Total salt additions in grams
   * @param mashWaterL Mash water volume in liters
   * @param spargeWaterL Sparge water volume in liters
   * @returns Object with mashSalts and spargeSalts
   */
  splitSaltsProportionally(
    totalSalts: SaltAdditions,
    mashWaterL: number,
    spargeWaterL: number
  ): { mashSalts: SaltAdditions; spargeSalts: SaltAdditions } {
    const totalWaterL = mashWaterL + spargeWaterL;
    if (totalWaterL <= 0) {
      return { mashSalts: {}, spargeSalts: {} };
    }

    const mashRatio = mashWaterL / totalWaterL;
    const spargeRatio = spargeWaterL / totalWaterL;

    const mashSalts: SaltAdditions = {};
    const spargeSalts: SaltAdditions = {};

    // Split each salt proportionally
    (Object.keys(totalSalts) as Array<keyof SaltAdditions>).forEach((key) => {
      const total = totalSalts[key];
      if (total && total > 0) {
        mashSalts[key] = total * mashRatio;
        spargeSalts[key] = total * spargeRatio;
      }
    });

    return { mashSalts, spargeSalts };
  }

  /**
   * Calculate the combined final water profile from total salts (auto-split)
   */
  calculateFinalProfileFromTotalSalts(
    sourceProfile: WaterProfile,
    totalSalts: SaltAdditions,
    mashWaterL: number,
    spargeWaterL: number
  ): WaterProfile {
    const totalWaterL = mashWaterL + spargeWaterL;
    if (totalWaterL <= 0) return sourceProfile;

    // Calculate final profile using total salts and total water
    return this.calculateFinalProfile(sourceProfile, totalSalts, totalWaterL);
  }

  /**
   * Calculate optimal salts to hit a target profile using bounded least squares.
   * Returns total salt additions and the split between mash and sparge water.
   */
  calculateSaltsForTarget(
    sourceProfile: WaterProfile,
    targetProfile: WaterProfile,
    mashWaterL: number,
    spargeWaterL: number
  ): { totalSalts: SaltAdditions; mashSalts: SaltAdditions; spargeSalts: SaltAdditions } {
    const totalWaterL = mashWaterL + spargeWaterL;
    if (totalWaterL <= 0) {
      return { totalSalts: {}, mashSalts: {}, spargeSalts: {} };
    }

    const { salts: totalSalts } = optimizeSaltAdditions(sourceProfile, targetProfile, totalWaterL);
    const { mashSalts, spargeSalts } = this.splitSaltsProportionally(totalSalts, mashWaterL, spargeWaterL);

    return { totalSalts, mashSalts, spargeSalts };
  }
}

// Export a singleton instance
export const waterChemistryService = new WaterChemistryService();

// Common water profiles for presets
export const COMMON_WATER_PROFILES: Record<string, WaterProfile> = {
  RO: { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 },
  Pilsen: { Ca: 7, Mg: 3, Na: 2, Cl: 5, SO4: 5, HCO3: 15 },
  Dortmund: { Ca: 225, Mg: 40, Na: 60, Cl: 60, SO4: 120, HCO3: 220 },
  Burton: { Ca: 275, Mg: 40, Na: 25, Cl: 35, SO4: 470, HCO3: 300 },
  Dublin: { Ca: 120, Mg: 4, Na: 12, Cl: 19, SO4: 53, HCO3: 319 },
  Vienna: { Ca: 163, Mg: 12, Na: 10, Cl: 40, SO4: 125, HCO3: 258 },
  Montreal: { Ca: 31, Mg: 8, Na: 15, Cl: 26, SO4: 22, HCO3: 113 },
};

// Beer style-based target water profiles
export type BeerStyleTarget = {
  profile: WaterProfile;
  description: string;
  clToSo4Ratio: string; // e.g., "2.7:1 (Malty)"
};

export const BEER_STYLE_TARGETS: Record<string, BeerStyleTarget> = {
  "NEIPA / Hazy IPA": {
    profile: { Ca: 110, Mg: 8, Na: 18, Cl: 150, SO4: 75, HCO3: 40 },
    description: "High chloride for juicy, soft mouthfeel. Moderate sulfate for hop balance.",
    clToSo4Ratio: "2:1 (Malty)",
  },
  "American IPA": {
    profile: { Ca: 100, Mg: 10, Na: 15, Cl: 60, SO4: 200, HCO3: 40 },
    description: "High sulfate for crisp, dry hop character. Moderate chloride for balance.",
    clToSo4Ratio: "0.3:1 (Hoppy)",
  },
  "American Pale Ale": {
    profile: { Ca: 75, Mg: 10, Na: 15, Cl: 50, SO4: 150, HCO3: 40 },
    description: "High sulfate for hop accentuation. Lower chloride for clean finish.",
    clToSo4Ratio: "0.3:1 (Very Hoppy)",
  },
  "West Coast IPA": {
    profile: { Ca: 110, Mg: 10, Na: 15, Cl: 50, SO4: 250, HCO3: 40 },
    description: "Very high sulfate for aggressive hop bitterness. Low chloride for dry finish.",
    clToSo4Ratio: "0.2:1 (Very Hoppy)",
  },
  "English IPA": {
    profile: { Ca: 110, Mg: 10, Na: 15, Cl: 55, SO4: 250, HCO3: 20 },
    description: "High sulfate for firm, Burton-style bitterness. Low bicarbonate keeps pale-malt mash pH in range.",
    clToSo4Ratio: "0.2:1 (Very Hoppy)",
  },
  "Pilsner": {
    profile: { Ca: 45, Mg: 3, Na: 5, Cl: 50, SO4: 20, HCO3: 25 },
    description: "Very soft, low-sulfate water for a delicate Czech-style Pilsner. Favor CaCl₂ over gypsum.",
    clToSo4Ratio: "2.5:1 (Soft)",
  },
  "German Pilsner": {
    profile: { Ca: 50, Mg: 5, Na: 5, Cl: 50, SO4: 75, HCO3: 25 },
    description: "Soft water with moderate sulfate for crisp noble-hop bitterness.",
    clToSo4Ratio: "0.7:1 (Hoppy)",
  },
  "Munich Helles": {
    profile: { Ca: 75, Mg: 5, Na: 10, Cl: 75, SO4: 50, HCO3: 30 },
    description: "Chloride-leaning for a malt-forward lager. Low bicarbonate protects pale mash pH.",
    clToSo4Ratio: "1.5:1 (Malty)",
  },
  "Stout / Porter": {
    profile: { Ca: 90, Mg: 10, Na: 25, Cl: 75, SO4: 60, HCO3: 150 },
    description: "Chloride-forward for malty roast. High bicarbonate buffers dark-malt acidity.",
    clToSo4Ratio: "1.3:1 (Malty)",
  },
  "Irish Stout": {
    profile: { Ca: 110, Mg: 5, Na: 15, Cl: 25, SO4: 55, HCO3: 200 },
    description: "Faithful Dublin profile: high calcium and bicarbonate balance roasted-barley acidity, low minerals keep the finish dry.",
    clToSo4Ratio: "0.5:1 (Roasty)",
  },
  "Belgian Ale": {
    profile: { Ca: 60, Mg: 8, Na: 12, Cl: 55, SO4: 55, HCO3: 30 },
    description: "Soft, balanced profile with low alkalinity for pale Belgian styles (tripel, golden strong, saison).",
    clToSo4Ratio: "1:1 (Balanced)",
  },
  "Blonde / Cream Ale": {
    profile: { Ca: 50, Mg: 10, Na: 15, Cl: 55, SO4: 55, HCO3: 30 },
    description: "Clean, soft, balanced profile. Low minerals let the malt and yeast show.",
    clToSo4Ratio: "1:1 (Balanced)",
  },
  "Brown Ale": {
    profile: { Ca: 80, Mg: 12, Na: 20, Cl: 90, SO4: 55, HCO3: 100 },
    description: "Higher chloride for malt sweetness. Moderate bicarbonate.",
    clToSo4Ratio: "1.6:1 (Malty)",
  },
  "Amber / Dark Lager": {
    profile: { Ca: 50, Mg: 6, Na: 12, Cl: 60, SO4: 40, HCO3: 90 },
    description: "Malty, chloride-forward water with gentle alkalinity for amber-to-dark German lagers.",
    clToSo4Ratio: "1.5:1 (Malty)",
  },
  "Wheat / Witbier": {
    profile: { Ca: 45, Mg: 6, Na: 10, Cl: 50, SO4: 30, HCO3: 25 },
    description: "Soft, low-mineral water with a gentle chloride lean for yeast-driven wheat styles.",
    clToSo4Ratio: "1.7:1 (Soft)",
  },
  "Malty Strong / Barleywine": {
    profile: { Ca: 110, Mg: 10, Na: 25, Cl: 120, SO4: 60, HCO3: 80 },
    description: "Rounded, chloride-leaning, mineral-rich water for big malt-forward strong ales.",
    clToSo4Ratio: "2:1 (Malty)",
  },
  "Balanced": {
    profile: { Ca: 75, Mg: 8, Na: 20, Cl: 75, SO4: 75, HCO3: 49 },
    description: "Equal chloride and sulfate for neutral balance.",
    clToSo4Ratio: "1:1 (Balanced)",
  },
};

// Maps BJCP style names → closest BEER_STYLE_TARGETS key
const BJCP_TO_WATER_TARGET: Record<string, string> = {
  // 1 – Standard American Beer
  "American Light Lager": "Pilsner",
  "American Lager": "Pilsner",
  "Cream Ale": "Blonde / Cream Ale",
  "American Wheat Beer": "Wheat / Witbier",
  // 2 – International Lager
  "International Pale Lager": "Pilsner",
  "International Amber Lager": "Amber / Dark Lager",
  "International Dark Lager": "Amber / Dark Lager",
  // 3 – Czech Lager
  "Czech Pale Lager": "Pilsner",
  "Czech Premium Pale Lager": "Pilsner",
  "Czech Amber Lager": "Amber / Dark Lager",
  "Czech Dark Lager": "Amber / Dark Lager",
  // 4 – Pale Malty European Lager
  "Munich Helles": "Munich Helles",
  "Festbier": "Munich Helles",
  "Helles Bock": "Munich Helles",
  // 5 – Pale Bitter European Beer
  "German Leichtbier": "German Pilsner",
  "Kölsch": "German Pilsner",
  "German Helles Exportbier": "German Pilsner",
  "German Pils": "German Pilsner",
  // 6 – Amber Malty European Lager
  "Märzen": "Amber / Dark Lager",
  "Rauchbier": "Amber / Dark Lager",
  "Dunkles Bock": "Amber / Dark Lager",
  // 7 – Amber Bitter European Beer
  "Vienna Lager": "Amber / Dark Lager",
  "Altbier": "Amber / Dark Lager",
  // 8 – Dark European Lager
  "Munich Dunkel": "Amber / Dark Lager",
  "Schwarzbier": "Amber / Dark Lager",
  // 9 – Strong European Beer
  "Doppelbock": "Amber / Dark Lager",
  "Eisbock": "Amber / Dark Lager",
  "Baltic Porter": "Stout / Porter",
  // 10 – German Wheat Beer
  "Weissbier": "Wheat / Witbier",
  "Dunkles Weissbier": "Wheat / Witbier",
  "Weizenbock": "Wheat / Witbier",
  // 11 – British Bitter
  "Ordinary Bitter": "English IPA",
  "Best Bitter": "English IPA",
  "Strong Bitter": "English IPA",
  // 12 – Pale Commonwealth Beer
  "British Golden Ale": "English IPA",
  "Australian Sparkling Ale": "Balanced",
  "English IPA": "English IPA",
  // 13 – Brown British Beer
  "Dark Mild": "Brown Ale",
  "British Brown Ale": "Brown Ale",
  "English Porter": "Stout / Porter",
  // 14 – Scottish Ale
  "Scottish Light": "Brown Ale",
  "Scottish Heavy": "Brown Ale",
  "Scottish Export": "Brown Ale",
  // 15 – Irish Beer
  "Irish Red Ale": "Brown Ale",
  "Irish Stout": "Irish Stout",
  "Irish Extra Stout": "Irish Stout",
  // 16 – Dark British Beer
  "Sweet Stout": "Stout / Porter",
  "Oatmeal Stout": "Stout / Porter",
  "Tropical Stout": "Stout / Porter",
  "Foreign Extra Stout": "Stout / Porter",
  // 17 – Strong British Ale
  "British Strong Ale": "Malty Strong / Barleywine",
  "Old Ale": "Malty Strong / Barleywine",
  "Wee Heavy": "Malty Strong / Barleywine",
  "English Barley Wine": "Malty Strong / Barleywine",
  // 18 – Pale American Ale
  "Blonde Ale": "Blonde / Cream Ale",
  "American Pale Ale": "American Pale Ale",
  // 19 – Amber and Brown American Beer
  "American Amber Ale": "Balanced",
  "California Common": "Balanced",
  "American Brown Ale": "Brown Ale",
  // 20 – American Porter and Stout
  "American Porter": "Stout / Porter",
  "American Stout": "Stout / Porter",
  "Imperial Stout": "Stout / Porter",
  // 21 – IPA
  "American IPA": "American IPA",
  "Specialty IPA": "American IPA",
  "Specialty IPA: Belgian IPA": "American IPA",
  "Specialty IPA: Black IPA": "American IPA",
  "Specialty IPA: Brown IPA": "American IPA",
  "Specialty IPA: Red IPA": "American IPA",
  "Specialty IPA: Rye IPA": "American IPA",
  "Specialty IPA: White IPA": "American IPA",
  "Specialty IPA: Brut IPA": "American IPA",
  "Hazy IPA": "NEIPA / Hazy IPA",
  // 22 – Strong American Ale
  "Double IPA": "West Coast IPA",
  "American Strong Ale": "American IPA",
  "American Barleywine": "Malty Strong / Barleywine",
  "Wheatwine": "Malty Strong / Barleywine",
  // 23 – European Sour Ale
  "Berliner Weisse": "Pilsner",
  "Flanders Red Ale": "Balanced",
  "Oud Bruin": "Balanced",
  "Lambic": "Pilsner",
  "Gueuze": "Pilsner",
  "Fruit Lambic": "Pilsner",
  "Gose": "Pilsner",
  // 24 – Belgian Ale
  "Witbier": "Wheat / Witbier",
  "Belgian Pale Ale": "Belgian Ale",
  "Bière de Garde": "Belgian Ale",
  // 25 – Strong Belgian Ale
  "Belgian Blond Ale": "Belgian Ale",
  "Saison": "Belgian Ale",
  "Belgian Golden Strong Ale": "Belgian Ale",
  // 26 – Monastic Ale
  "Belgian Single": "Belgian Ale",
  "Belgian Dubbel": "Belgian Ale",
  "Belgian Tripel": "Belgian Ale",
  "Belgian Dark Strong Ale": "Belgian Ale",
  // 27 – Historical Beer
  "Kellerbier": "German Pilsner",
  "Kentucky Common": "Balanced",
  "Lichtenhainer": "Pilsner",
  "London Brown Ale": "Brown Ale",
  "Piwo Grodziskie": "Pilsner",
  "Pre-Prohibition Lager": "Pilsner",
  "Pre-Prohibition Porter": "Stout / Porter",
  "Roggenbier": "Balanced",
  "Sahti": "Balanced",
  // 28 – American Wild Ale
  "Brett Beer": "Balanced",
  "Mixed-Fermentation Sour Beer": "Balanced",
  "Wild Specialty Beer": "Balanced",
  "Straight Sour Beer": "Balanced",
  "Catharina Sour": "Balanced",
  // 29+ – Specialty
  "Fruit Beer": "Balanced",
  "Fruit and Spice Beer": "Balanced",
  "Specialty Fruit Beer": "Balanced",
  "Grape Ale": "Balanced",
  "Spice, Herb, or Vegetable Beer": "Balanced",
  "Autumn Seasonal Beer": "Balanced",
  "Winter Seasonal Beer": "Balanced",
  "Specialty Spice Beer": "Balanced",
  "Alternative Grain Beer": "Balanced",
  "Alternative Sugar Beer": "Balanced",
  "Classic Style Smoked Beer": "Balanced",
  "Specialty Smoked Beer": "Balanced",
  "Wood-Aged Beer": "Balanced",
  "Specialty Wood-Aged Beer": "Balanced",
  "Commercial Specialty Beer": "Balanced",
  "Mixed-Style Beer": "Balanced",
  "New Zealand Pilsner": "German Pilsner",
};

/**
 * Maps a recipe's BJCP style string (e.g. "21A. American IPA") to the
 * closest BEER_STYLE_TARGETS key for water chemistry auto-detection.
 */
export function getWaterTargetForBjcpStyle(recipeStyle: string): string {
  if (!recipeStyle) return "Balanced";
  // Recipe style is stored as "21A. American IPA" — extract name after ". "
  const dotIndex = recipeStyle.indexOf(". ");
  const styleName = dotIndex >= 0 ? recipeStyle.substring(dotIndex + 2) : recipeStyle;
  return BJCP_TO_WATER_TARGET[styleName] || "Balanced";
}
