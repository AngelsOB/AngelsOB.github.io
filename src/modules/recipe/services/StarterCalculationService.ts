/**
 * Starter Calculation Service
 *
 * Calculates yeast cell counts and starter requirements.
 * Based on White and Braukaiser growth models.
 *
 * References:
 * - White Labs yeast growth model: "Yeast: The Practical Guide to Beer Fermentation" (White & Zainasheff)
 * - Braukaiser model: http://braukaiser.com/wiki/index.php/Yeast_Starter
 * - Plato conversion: ASBC Methods of Analysis
 */

import type { StarterStep, YeastType } from "../models/Recipe";

// ============================================================================
// UNIT CONVERSION CONSTANTS
// ============================================================================

/** Conversion factor: liters to US gallons (1 L = 0.264172 gal) */
const LITERS_TO_GALLONS = 0.264172;

/** Conversion factor: pounds to grams (1 lb = 453.59237 g) */
const POUNDS_TO_GRAMS = 453.59237;

/** Multiplier to convert gravity decimal to gravity points (e.g., 1.040 -> 40) */
const GRAVITY_TO_POINTS = 1000;

/** Milliseconds per day for date calculations */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// PLATO CONVERSION POLYNOMIAL COEFFICIENTS
// ============================================================================
// ASBC polynomial for converting specific gravity to degrees Plato
// Formula: Plato = A + B*SG + C*SG² + D*SG³

const PLATO_COEFF_A = -616.868;
const PLATO_COEFF_B = 1111.14;
const PLATO_COEFF_C = -630.272;
const PLATO_COEFF_D = 135.997;

// ============================================================================
// YEAST VIABILITY CONSTANTS
// ============================================================================

/**
 * Viability loss rate per day (0.7%)
 * Source: White Labs estimates ~21% loss per month, or ~0.7% per day
 */
const VIABILITY_LOSS_PER_DAY = 0.007;

// ============================================================================
// YEAST PACKAGE CONSTANTS
// ============================================================================

/** Standard dry yeast sachet weight in grams (e.g., Fermentis US-05) */
const DRY_YEAST_SACHET_GRAMS = 11;

/** Dry yeast cell density: billion cells per gram */
const DRY_YEAST_BILLION_PER_GRAM = 6;

/** Standard liquid yeast pack cell count in billions (e.g., Wyeast activator) */
const LIQUID_YEAST_STANDARD_BILLION = 100;

/** Large liquid yeast pack cell count in billions (e.g., White Labs 200ml) */
const LIQUID_YEAST_LARGE_BILLION = 200;

/** Conversion factor: liters to milliliters */
const LITERS_TO_ML = 1000;

// ============================================================================
// DME (DRY MALT EXTRACT) CONSTANTS
// ============================================================================

/** DME potential points per pound per gallon (PPG) */
const DME_PPG = 45;

/** Safe divisor guard to prevent division by zero */
const SAFE_DIVISOR_MIN = 0.0001;

// ============================================================================
// WHITE MODEL CONSTANTS
// ============================================================================
// Polynomial coefficients for White growth model
// Growth factor = A * (inoculation_rate)^B + C
// Source: Derived from White Labs yeast growth data

const WHITE_MODEL_COEFF_A = 12.54793776;
const WHITE_MODEL_COEFF_B = -0.4594858324;
const WHITE_MODEL_COEFF_C = -0.9994994906;

/** Additional growth factor when using aeration (shaking/stirring) */
const WHITE_MODEL_AERATION_BOOST = 0.5;

/** Maximum growth factor clamp (prevents unrealistic growth) */
const WHITE_MODEL_MAX_GROWTH = 6;

/** Cell saturation point: billion cells per liter at which growth slows */
const WHITE_MODEL_SATURATION_BILLION_PER_L = 200;

// ============================================================================
// BRAUKAISER MODEL CONSTANTS
// ============================================================================

/**
 * Braukaiser model growth rate: billion cells produced per gram of DME
 * Source: http://braukaiser.com/wiki/index.php/Yeast_Starter
 */
const BRAUKAISER_BILLION_PER_GRAM_DME = 1.4;

// ============================================================================

export type StarterCalculationResult = {
  /** Required cells in billions */
  requiredCellsB: number;
  /** Cells available from package in billions */
  cellsAvailableB: number;
  /** Results for each starter step */
  stepResults: Array<{
    id: string;
    dmeGrams: number;
    endBillion: number;
  }>;
  /** Final cell count after all steps in billions */
  finalEndB: number;
  /** Total starter volume in liters */
  totalStarterL: number;
  /** Total DME required in grams */
  totalDmeG: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export class StarterCalculationService {
  /**
   * Convert specific gravity to degrees Plato using ASBC polynomial
   */
  sgToPlato(sg: number): number {
    const s2 = sg * sg;
    const s3 = s2 * sg;
    return (
      PLATO_COEFF_A +
      PLATO_COEFF_B * sg +
      PLATO_COEFF_C * s2 +
      PLATO_COEFF_D * s3
    );
  }

  /**
   * Calculate DME grams needed for target gravity
   */
  dmeGramsForGravity(
    liters: number,
    gravity: number,
    dmePpg = DME_PPG
  ): number {
    const points = Math.max(0, (gravity - 1) * GRAVITY_TO_POINTS);
    const gallons = liters * LITERS_TO_GALLONS;
    const pounds = (points * gallons) / Math.max(SAFE_DIVISOR_MIN, dmePpg);
    return pounds * POUNDS_TO_GRAMS;
  }

  /**
   * Calculate yeast viability based on manufacture date
   * @param mfgDate ISO date string
   * @returns Viability factor (0-1)
   */
  calculateViability(mfgDate: string | undefined): number {
    if (!mfgDate) return 1.0;

    const made = new Date(mfgDate).getTime();
    if (Number.isNaN(made)) return 1.0;

    const days = Math.max(0, Math.floor((Date.now() - made) / MS_PER_DAY));

    return clamp(1 - VIABILITY_LOSS_PER_DAY * days, 0, 1);
  }

  /**
   * Calculate cells available from yeast package
   */
  calculateCellsAvailable(
    yeastType: YeastType,
    packs: number,
    mfgDate?: string,
    slurryLiters?: number,
    slurryBillionPerMl?: number
  ): number {
    if (yeastType === "dry") {
      const grams = Math.max(0, Math.floor(packs)) * DRY_YEAST_SACHET_GRAMS;
      return grams * DRY_YEAST_BILLION_PER_GRAM;
    }

    if (yeastType === "slurry") {
      return (
        Math.max(0, slurryLiters || 0) *
        LITERS_TO_ML *
        Math.max(0, slurryBillionPerMl || 0)
      );
    }

    const basePerPack =
      yeastType === "liquid-200"
        ? LIQUID_YEAST_LARGE_BILLION
        : LIQUID_YEAST_STANDARD_BILLION;
    const numPacks = Math.max(0, Math.floor(packs));
    const viability = this.calculateViability(mfgDate);

    return numPacks * basePerPack * viability;
  }

  /**
   * Calculate required cells for a recipe
   * @param volumeL Batch volume in liters
   * @param og Original gravity
   * @param pitchRate Pitch rate (default 0.75 for ale)
   */
  calculateRequiredCells(
    volumeL: number,
    og: number,
    pitchRate: number = 0.75
  ): number {
    const plato = this.sgToPlato(og);
    return pitchRate * Math.max(0, volumeL) * Math.max(0, plato);
  }

  /**
   * White model growth calculation
   * Uses polynomial fit to White Labs yeast growth data
   */
  private whiteModelGrowth(
    currentBillion: number,
    liters: number,
    aeration: "none" | "shaking"
  ): { growthFactor: number; endBillion: number } {
    const inoculationRateBPerL =
      currentBillion / Math.max(SAFE_DIVISOR_MIN, liters);
    const base =
      WHITE_MODEL_COEFF_A *
        Math.pow(inoculationRateBPerL, WHITE_MODEL_COEFF_B) +
      WHITE_MODEL_COEFF_C;
    const aerationBoost =
      aeration === "shaking" ? WHITE_MODEL_AERATION_BOOST : 0;
    const growthFactor = clamp(base + aerationBoost, 0, WHITE_MODEL_MAX_GROWTH);
    const saturationB = WHITE_MODEL_SATURATION_BILLION_PER_L * liters;
    const proposed = currentBillion * (1 + growthFactor);
    const endBillion = Math.min(saturationB, proposed);
    return { growthFactor, endBillion };
  }

  /**
   * Braukaiser model growth calculation
   * Linear growth based on DME consumption
   */
  private braukaiserGrowth(
    currentBillion: number,
    liters: number,
    gravity: number
  ): { growthBillion: number; endBillion: number } {
    const grams = this.dmeGramsForGravity(liters, gravity, DME_PPG);
    const growthBillion = grams * BRAUKAISER_BILLION_PER_GRAM_DME;
    const endBillion = currentBillion + growthBillion;
    return { growthBillion, endBillion };
  }

  /**
   * Calculate complete starter plan
   */
  calculateStarter(
    volumeL: number,
    og: number,
    yeastType: YeastType,
    packs: number,
    mfgDate: string | undefined,
    slurryLiters: number | undefined,
    slurryBillionPerMl: number | undefined,
    steps: StarterStep[]
  ): StarterCalculationResult {
    const requiredCellsB = this.calculateRequiredCells(volumeL, og);
    const cellsAvailableB = this.calculateCellsAvailable(
      yeastType,
      packs,
      mfgDate,
      slurryLiters,
      slurryBillionPerMl
    );

    const stepResults: Array<{
      id: string;
      dmeGrams: number;
      endBillion: number;
    }> = [];

    let current = Math.max(0, cellsAvailableB);

    for (const step of steps) {
      const dmeG = this.dmeGramsForGravity(step.liters, step.gravity, DME_PPG);

      if (step.model.kind === "white") {
        const { endBillion } = this.whiteModelGrowth(
          current,
          step.liters,
          step.model.aeration
        );
        current = endBillion;
        stepResults.push({ id: step.id, dmeGrams: dmeG, endBillion });
      } else {
        const { endBillion } = this.braukaiserGrowth(
          current,
          step.liters,
          step.gravity
        );
        current = endBillion;
        stepResults.push({ id: step.id, dmeGrams: dmeG, endBillion });
      }
    }

    const finalEndB = stepResults.length
      ? stepResults[stepResults.length - 1].endBillion
      : cellsAvailableB;

    const totalStarterL = steps.reduce(
      (sum, s) => sum + (Number(s.liters) || 0),
      0
    );

    const totalDmeG = steps.reduce(
      (sum, s) => sum + this.dmeGramsForGravity(s.liters, s.gravity, DME_PPG),
      0
    );

    return {
      requiredCellsB,
      cellsAvailableB,
      stepResults,
      finalEndB,
      totalStarterL,
      totalDmeG,
    };
  }
}

// Export singleton instance
export const starterCalculationService = new StarterCalculationService();
