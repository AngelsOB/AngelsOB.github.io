/**
 * Mash pH Calculation Service
 *
 * Predicts mash pH using a simplified proton deficit model:
 * 1. Classify each grain by pH category → assign pHdi (distilled-water pH)
 * 2. Calculate water effective alkalinity in mEq
 * 3. Solve for equilibrium pH where total proton balance = 0
 *
 * Based on AJ deLange's proton deficit framework (MBAA TQ 2013/2015),
 * as implemented by Bru'n Water. Uses a universal malt buffering capacity
 * (~40 mEq/kg/pH) with category-specific pHdi values.
 *
 * References: AJ deLange (MBAA), Bru'n Water, Kai Troester (braukaiser.com)
 */

import type { Recipe, Fermentable, OtherIngredient } from '../models/Recipe';
import type { WaterProfile, SaltAdditions } from './WaterChemistryService';
import { waterChemistryService } from './WaterChemistryService';
import { devWarn } from '@utils/logger';

/* ------------------------------------------------------------------ */
/*  Grain pH classification                                            */
/* ------------------------------------------------------------------ */

export type GrainPhCategory =
  | 'base'
  | 'wheat'
  | 'munich'
  | 'crystal'
  | 'roasted'
  | 'acidulated'
  | 'adjunct';

/**
 * Distilled-water mash pH ranges per grain category.
 * Sources: AJ deLange (MBAA TQ), Kai Troester (braukaiser.com).
 */
const GRAIN_DI_PH: Record<GrainPhCategory, { min: number; max: number }> = {
  base:       { min: 5.65, max: 5.72 },
  wheat:      { min: 5.95, max: 6.05 },  // deLange: wheat is less acidic than barley
  munich:     { min: 4.70, max: 5.55 },  // Interpolated by color: 4L→5.55, 200L+→4.70
  crystal:    { min: 4.50, max: 5.20 },
  roasted:    { min: 4.45, max: 4.60 },  // Tighter range per Bru'n Water data
  acidulated: { min: 3.35, max: 3.45 },
  adjunct:    { min: 5.70, max: 5.80 },
};

/**
 * Classify a grain into a pH category based on its name and color.
 *
 * The `type` parameter is optional — it exists on FermentablePreset but
 * not on the Fermentable domain model, so we rely primarily on name heuristics.
 */
export function classifyGrainForPh(
  name: string,
  colorLovibond: number,
  type?: string,
): GrainPhCategory {
  const n = name.toLowerCase();

  // Acidulated malt (very specific, check first)
  if (n.includes('acidulated') || n.includes('acid malt') || n.includes('sauermalz')) {
    return 'acidulated';
  }

  // Extract and sugar are not mashed — but if they somehow reach here, treat as adjunct
  if (type === 'extract' || type === 'sugar') {
    return 'adjunct';
  }

  // Roasted malts (check before crystal to catch "carafa")
  if (
    n.includes('roasted') ||
    n.includes('black malt') ||
    n.includes('black patent') ||
    n.includes('black barley') ||
    n.includes('chocolate') ||
    n.includes('carafa') ||
    n.includes('midnight wheat') ||
    n.includes('blackprinz') ||
    n.includes('dehusked') ||
    colorLovibond >= 300
  ) {
    return 'roasted';
  }

  // Crystal / Caramel malts
  if (
    n.includes('crystal') ||
    n.includes('caramel') ||
    n.includes('caramunich') ||
    n.includes('carapils') ||
    n.includes('carahell') ||
    n.includes('caravienne') ||
    n.includes('caraaroma') ||
    n.includes('carafoam') ||
    n.includes('carastan') ||
    n.includes('carared') ||
    n.includes('special b') ||
    (n.includes('cara') && !n.includes('carafa'))
  ) {
    return 'crystal';
  }

  // Wheat
  if (
    n.includes('wheat') ||
    n.includes('weizen') ||
    n.includes('white wheat') ||
    n.includes('red wheat')
  ) {
    return 'wheat';
  }

  // Munich / Vienna / kilned specialty malts
  // These are significantly more acidic than pale base malt (pHdi ~5.3-5.5)
  if (
    n.includes('munich') ||
    n.includes('vienna') ||
    n.includes('biscuit') ||
    n.includes('melanoidin') ||
    n.includes('melano') ||
    n.includes('aromatic') ||
    n.includes('amber') ||
    n.includes('brown') ||
    n.includes('victory') ||
    n.includes('special roast') ||
    n.includes('honey malt') ||
    n.includes('abbey') ||
    n.includes('brumalt') ||
    n.includes('cookie') ||
    n.includes('coffee malt') ||
    n.includes('red x') ||
    n.includes('red ale')
  ) {
    return 'munich';
  }

  // Adjuncts
  if (
    type === 'adjunct_mashable' ||
    n.includes('flaked') ||
    n.includes('torrified') ||
    n.includes('rice hull') ||
    n.includes('corn') ||
    n.includes('rice')
  ) {
    return 'adjunct';
  }

  // Color-based fallback: anything > 10L that didn't match above
  // is a kilned specialty malt, not a pale base malt
  if (colorLovibond > 10) {
    return 'munich';
  }

  // Default: pale base malt
  return 'base';
}

/**
 * Get the distilled-water mash pH for a grain based on its category and color.
 *
 * For crystal, munich/kilned, and roasted malts, interpolates within the
 * DI pH range based on color (darker = lower pH).
 */
export function getGrainDiPh(category: GrainPhCategory, colorLovibond: number): number {
  const range = GRAIN_DI_PH[category];

  if (category === 'munich') {
    // Kilned malts: 4L → 5.55, 200L+ → 4.70
    // Covers Vienna (4L) through Coffee Malt (230L)
    const minColor = 4;
    const maxColor = 200;
    const t = Math.min(1, Math.max(0, (colorLovibond - minColor) / (maxColor - minColor)));
    return range.max - t * (range.max - range.min);
  }

  if (category === 'crystal') {
    // Interpolate: 10L → 5.20, 120L+ → 4.50
    const minColor = 10;
    const maxColor = 120;
    const t = Math.min(1, Math.max(0, (colorLovibond - minColor) / (maxColor - minColor)));
    return range.max - t * (range.max - range.min);
  }

  if (category === 'roasted') {
    // Interpolate: 300L → 4.60, 500L+ → 4.45
    const minColor = 300;
    const maxColor = 500;
    const t = Math.min(1, Math.max(0, (colorLovibond - minColor) / (maxColor - minColor)));
    return range.max - t * (range.max - range.min);
  }

  // All other categories: return midpoint
  return (range.min + range.max) / 2;
}

/* ------------------------------------------------------------------ */
/*  Water chemistry helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Calculate Residual Alkalinity (RA) in ppm as CaCO3.
 *
 * RA = Alkalinity_as_CaCO3 − Ca/2.5 − Mg/3.33
 * Where Alkalinity_as_CaCO3 = HCO3_ppm × 50 / 61.016
 *
 * Positive RA → raises mash pH
 * Negative RA → lowers mash pH
 */
export function calculateResidualAlkalinity(profile: WaterProfile): number {
  const alkalinity = profile.HCO3 * 50 / 61.016;
  return alkalinity - (profile.Ca / 2.5) - (profile.Mg / 3.33);
}

/* ------------------------------------------------------------------ */
/*  Proton Deficit Model                                               */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Proton Deficit Model Constants                                     */
/*                                                                     */
/*  Based on AJ deLange's work (MBAA TQ 2013/2015) as implemented by  */
/*  Bru'n Water. Instead of a single RA-to-pH coefficient, we solve   */
/*  for the pH where total proton deficit = 0.                         */
/* ------------------------------------------------------------------ */

/**
 * Universal malt buffering capacity in mEq per kg per pH unit.
 * Negative: lowering pH requires adding protons (acid).
 * Source: AJ deLange measurements, ~40-46 mEq/kg/pH for most malts.
 */
const MALT_BUFFERING_MEQ_KG_PH = -40;

/**
 * 88% lactic acid: titratable acidity in mEq per mL.
 * Derivation: 0.88 (w/w) × 1.209 (g/mL) × 1000 / 90.08 (MW) ≈ 11.81
 */
const LACTIC_88_MEQ_PER_ML = 11.81;

/**
 * Baking soda (NaHCO3) alkalinity in mEq per gram.
 * 1 g / 84.006 g/mol × 1000 = 11.904 mEq
 */
const NAHCO3_MEQ_PER_G = 11.904;

/** Bisection solver bounds and convergence */
const BISECT_PH_LO = 3.0;
const BISECT_PH_HI = 8.0;
const BISECT_TOL = 0.001;
const BISECT_MAX_ITER = 50;

/**
 * Default mash pH target (room temperature measurement).
 * Literature consensus: 5.4 is the standard default used by Brewfather/BeerSmith.
 * Acceptable range is 5.2–5.6, with 5.2–5.4 being ideal for most styles.
 */
export const DEFAULT_TARGET_PH = 5.4;

/** Acceptable mash pH range */
export const MASH_PH_RANGE = { min: 5.2, max: 5.6 } as const;

/** Ideal mash pH range (green zone in UI) */
export const MASH_PH_IDEAL = { min: 5.2, max: 5.4 } as const;

/* ------------------------------------------------------------------ */
/*  Proton Deficit Solver                                              */
/* ------------------------------------------------------------------ */

/**
 * Effective alkalinity of water in mEq/L.
 *
 * Accounts for Ca²⁺ and Mg²⁺ precipitation with malt phosphates
 * (Kolbach's original divisors: 3.5 for Ca, 7 for Mg in mEq/L).
 */
function effectiveAlkalinityMeqPerL(profile: WaterProfile): number {
  return (
    profile.HCO3 / 61.016 -
    profile.Ca / (40.078 * 3.5) -
    profile.Mg / (24.305 * 7)
  );
}

/**
 * Proton balance function for bisection solver.
 *
 * f(pH) = waterAlk + Σ maltDeficit_i(pH) − acidMeq + baseMeq
 *
 * At equilibrium f(pH) = 0.
 *
 * Water alkalinity (positive when HCO3 dominates) resists pH drop.
 * Each malt pulls pH toward its pHdi via buffering capacity.
 * Acid provides H⁺ (consumes alkalinity → subtracted → lowers pH).
 * Base provides OH⁻ (adds alkalinity → added → raises pH).
 */
function protonBalance(
  pH: number,
  waterAlkMeq: number,
  grains: ReadonlyArray<{ weightKg: number; pHdi: number }>,
  acidMeq: number,
  baseMeq: number,
): number {
  let maltDeficit = 0;
  for (const g of grains) {
    maltDeficit += g.weightKg * MALT_BUFFERING_MEQ_KG_PH * (pH - g.pHdi);
  }
  return waterAlkMeq + maltDeficit - acidMeq + baseMeq;
}

/**
 * Find equilibrium mash pH via bisection.
 *
 * Returns the pH where protonBalance() ≈ 0, or null on edge cases.
 */
function solvePhBisection(
  waterAlkMeq: number,
  grains: ReadonlyArray<{ weightKg: number; pHdi: number }>,
  acidMeq: number,
  baseMeq: number,
): number | null {
  let lo = BISECT_PH_LO;
  let hi = BISECT_PH_HI;
  let fLo = protonBalance(lo, waterAlkMeq, grains, acidMeq, baseMeq);
  const fHi = protonBalance(hi, waterAlkMeq, grains, acidMeq, baseMeq);

  // No sign change → return boundary closer to zero
  // This indicates extreme water chemistry or acid/base additions
  // that push the equilibrium beyond the normal mash pH range
  if (fLo * fHi > 0) {
    const result = Math.abs(fLo) < Math.abs(fHi) ? lo : hi;
    devWarn(
      '[MashPh] Bisection solver: no sign change in bracket [3.0, 8.0]. ' +
        'Returning boundary pH',
      result.toFixed(2),
      '(extreme water chemistry or acid/base additions).',
    );
    return result;
  }

  for (let i = 0; i < BISECT_MAX_ITER; i++) {
    const mid = (lo + hi) / 2;
    const fMid = protonBalance(mid, waterAlkMeq, grains, acidMeq, baseMeq);

    if (Math.abs(fMid) < BISECT_TOL || (hi - lo) / 2 < BISECT_TOL) {
      return mid;
    }

    if (fMid * fLo < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  // Max iterations exceeded without convergence
  // This should be rare given the tolerance and max iterations
  const midpoint = (lo + hi) / 2;
  devWarn(
    '[MashPh] Bisection solver: max iterations exceeded. ' +
      'Returning midpoint pH',
    midpoint.toFixed(2),
    `(bracket narrowed to [${lo.toFixed(3)}, ${hi.toFixed(3)}]).`,
  );
  return midpoint;
}

/* ------------------------------------------------------------------ */
/*  Acid / base extraction from Other Ingredients                      */
/* ------------------------------------------------------------------ */

/**
 * Convert an OtherIngredient amount to mL based on its unit.
 * Supports ml, l, tsp (~5 mL), tbsp (~15 mL), drops (~0.05 mL).
 */
function toMl(amount: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'ml': return amount;
    case 'l':  return amount * 1000;
    case 'tsp': return amount * 4.93;
    case 'tbsp': return amount * 14.79;
    case 'drops': return amount * 0.05;
    default: return 0; // g, tablet, etc. — not a volume unit for liquids
  }
}

/**
 * Convert an OtherIngredient amount to grams based on its unit.
 * Supports g, kg, oz, lb, tsp (~5 g approx), tbsp (~15 g approx).
 */
function toGrams(amount: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'g': return amount;
    case 'kg': return amount * 1000;
    case 'oz': return amount * 28.3495;
    case 'lb': return amount * 453.592;
    case 'tsp': return amount * 4.6; // baking soda density ~0.92 g/mL × 5 mL
    case 'tbsp': return amount * 13.8;
    default: return 0;
  }
}

/**
 * Extract effective lactic acid (mL of 88%) and baking soda (g) from
 * the recipe's otherIngredients, considering only mash-timed additions.
 *
 * Recognizes common names for lactic acid and baking soda.
 * Phosphoric acid / other acids are not yet modeled.
 */
function extractAcidBaseFromIngredients(
  ingredients: OtherIngredient[]
): { lacticAcid88Ml: number; bakingSodaG: number } {
  let lacticMl = 0;
  let sodaG = 0;

  for (const ing of ingredients) {
    // Only count mash additions for pH impact
    if (ing.timing !== 'mash') continue;

    const n = ing.name.toLowerCase();

    if (n.includes('lactic acid') || n.includes('lactic')) {
      lacticMl += toMl(ing.amount, ing.unit);
    } else if (
      n.includes('baking soda') ||
      n.includes('sodium bicarbonate') ||
      n.includes('nahco3')
    ) {
      sodaG += toGrams(ing.amount, ing.unit);
    }
  }

  return { lacticAcid88Ml: lacticMl, bakingSodaG: sodaG };
}

/**
 * Mash pH adjustment recommendation.
 * Only one of lacticAcid88Ml / bakingSodaG will be > 0.
 */
export type MashPhAdjustment = {
  /** Target pH for the adjustment */
  targetPh: number;
  /** mL of 88% lactic acid to add to lower pH (0 if pH needs raising) */
  lacticAcid88Ml: number;
  /** grams of baking soda (NaHCO3) to add to raise pH (0 if pH needs lowering) */
  bakingSodaG: number;
};

export class MashPhCalculationService {
  /**
   * Predict mash pH using the proton deficit model.
   *
   * Finds the pH where:
   *   water_alkalinity(mEq) + Σ malt_deficit_i(pH) + acid − base = 0
   *
   * @param recipe The recipe with fermentables and optional water chemistry
   * @param mashWaterL Mash water volume in liters
   * @returns Estimated mash pH, or null if insufficient data
   */
  calculateMashPh(recipe: Recipe, mashWaterL: number): number | null {
    // Build grain list with pHdi values
    const grains = this.buildGrainList(recipe.fermentables);
    if (grains.length === 0) return null;

    // Water effective alkalinity (mEq)
    let waterAlkMeq = 0;
    if (recipe.waterChemistry && mashWaterL > 0) {
      const mashProfile = this.getMashWaterProfile(
        recipe.waterChemistry.sourceProfile,
        recipe.waterChemistry.saltAdditions,
        mashWaterL,
        recipe,
      );
      waterAlkMeq = effectiveAlkalinityMeqPerL(mashProfile) * mashWaterL;
    }

    // Acid / base from Other Ingredients
    let acidMeq = 0;
    let baseMeq = 0;
    if (recipe.otherIngredients && recipe.otherIngredients.length > 0) {
      const { lacticAcid88Ml, bakingSodaG } = extractAcidBaseFromIngredients(recipe.otherIngredients);
      acidMeq = lacticAcid88Ml * LACTIC_88_MEQ_PER_ML;
      baseMeq = bakingSodaG * NAHCO3_MEQ_PER_G;
    }

    return solvePhBisection(waterAlkMeq, grains, acidMeq, baseMeq);
  }

  /**
   * Calculate the grain-only mash pH (distilled water, no additions).
   * With zero alkalinity the equilibrium is the weight-weighted pHdi average.
   */
  calculateGrainOnlyPh(fermentables: Fermentable[]): number | null {
    const grains = this.buildGrainList(fermentables);
    if (grains.length === 0) return null;
    return solvePhBisection(0, grains, 0, 0);
  }

  /**
   * Calculate the acid or base addition needed to reach the target mash pH.
   *
   * Uses the proton deficit model: mEq needed = |buffering| × grainKg × |ΔpH|,
   * then converts to mL of 88% lactic acid or grams of NaHCO3.
   *
   * @param currentPh Current estimated mash pH
   * @param targetPh Target mash pH (default: 5.4)
   * @param totalGrainKg Total weight of mashable grains in kg
   * @param mashWaterL Mash water volume in liters
   * @returns Adjustment recommendation, or null if pH is already in range
   */
  calculatePhAdjustment(
    currentPh: number,
    targetPh: number,
    totalGrainKg: number,
  ): MashPhAdjustment | null {
    const delta = currentPh - targetPh;

    // If already at target (within 0.02 tolerance), no adjustment needed
    if (Math.abs(delta) < 0.02) return null;

    // mEq needed to shift the malt buffer by |delta| pH
    const meqNeeded = totalGrainKg * Math.abs(MALT_BUFFERING_MEQ_KG_PH) * Math.abs(delta);

    if (delta > 0) {
      // pH too high → need acid
      const lacticMl = meqNeeded / LACTIC_88_MEQ_PER_ML;
      return {
        targetPh,
        lacticAcid88Ml: Math.round(lacticMl * 10) / 10,
        bakingSodaG: 0,
      };
    } else {
      // pH too low → need base
      const sodaG = meqNeeded / NAHCO3_MEQ_PER_G;
      return {
        targetPh,
        lacticAcid88Ml: 0,
        bakingSodaG: Math.round(sodaG * 10) / 10,
      };
    }
  }

  /** Build a grain list with pHdi for the solver. */
  private buildGrainList(
    fermentables: Fermentable[],
  ): Array<{ weightKg: number; pHdi: number }> {
    const mashGrains = fermentables.filter((f) => this.isMashable(f));
    const totalWeight = mashGrains.reduce((s, f) => s + f.weightKg, 0);
    if (totalWeight <= 0) return [];

    return mashGrains.map((f) => {
      const cat = classifyGrainForPh(f.name, f.colorLovibond);
      return { weightKg: f.weightKg, pHdi: getGrainDiPh(cat, f.colorLovibond) };
    });
  }

  /**
   * Determine if a fermentable participates in the mash.
   * Extracts and sugars are excluded since they're not present during mashing.
   */
  private isMashable(f: Fermentable): boolean {
    const n = f.name.toLowerCase();
    // Heuristic: exclude extracts and sugars
    if (
      n.includes('extract') ||
      n.includes('dme') ||
      n.includes('lme') ||
      n.includes('dry malt') ||
      n.includes('liquid malt') ||
      n.includes('cane sugar') ||
      n.includes('corn sugar') ||
      n.includes('dextrose') ||
      n.includes('sucrose') ||
      n.includes('table sugar') ||
      n.includes('honey') ||
      n.includes('maple syrup') ||
      n.includes('molasses') ||
      n.includes('brown sugar') ||
      n.includes('candy sugar') ||
      n.includes('candi sugar') ||
      n.includes('invert sugar') ||
      n.includes('lactose') ||
      n.includes('maltodextrin')
    ) {
      return false;
    }
    return true;
  }

  /**
   * Get the mash water ion profile after salt additions.
   * Uses proportional salt splitting between mash and sparge.
   */
  private getMashWaterProfile(
    sourceProfile: WaterProfile,
    saltAdditions: SaltAdditions,
    mashWaterL: number,
    recipe: Recipe,
  ): WaterProfile {
    // We need sparge water to split salts proportionally
    // Use a simple estimate: total water - mash water
    const totalGrainKg = recipe.fermentables.reduce(
      (sum, f) => sum + f.weightKg,
      0,
    );
    const grainAbsorption = totalGrainKg * recipe.equipment.grainAbsorptionLPerKg;
    const mashRunoff = Math.max(0, mashWaterL - grainAbsorption);

    // Pre-boil volume estimate for sparge calculation
    const boilOff = (recipe.equipment.boilTimeMin / 60) * recipe.equipment.boilOffRateLPerHour;
    const preBoilL = recipe.batchVolumeL + boilOff + recipe.equipment.kettleLossLiters;
    const spargeWaterL = Math.max(0, preBoilL - mashRunoff);

    const { mashSalts } = waterChemistryService.splitSaltsProportionally(
      saltAdditions,
      mashWaterL,
      spargeWaterL,
    );

    // Calculate ion contribution from mash salts at mash water volume
    const saltDelta = waterChemistryService.ionDeltaFromSalts(mashSalts, mashWaterL);
    return waterChemistryService.clampProfile(
      waterChemistryService.addProfiles(sourceProfile, saltDelta),
    );
  }
}

// Export singleton instance
export const mashPhCalculationService = new MashPhCalculationService();
