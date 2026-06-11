/**
 * PackagingCalculationService
 *
 * Pure calculation service for bottling and kegging.
 * No browser or React dependencies — safe for server and client contexts.
 */

import type {
  PrimingSugarType,
  BottleSize,
  BottleEntry,
  FermentationStep,
} from "../models/Recipe";

// ── Constants ───────────────────────────────────────────────────────────────

/** Grams of sugar per liter per volume CO2 needed */
const SUGAR_FACTOR: Record<PrimingSugarType, number> = {
  "corn-sugar": 4.0,
  "table-sugar": 3.67,
  dme: 5.33,
  honey: 4.95,
};

const SUGAR_LABEL: Record<PrimingSugarType, string> = {
  "corn-sugar": "Corn Sugar (Dextrose)",
  "table-sugar": "Table Sugar (Sucrose)",
  dme: "Dry Malt Extract",
  honey: "Honey",
};

const BOTTLE_SIZE_ML: Record<BottleSize, number> = {
  "330ml": 330,
  "500ml": 500,
  "650ml": 650,
  "750ml": 750,
};

/** BJCP-based CO2 volume ranges for common styles { min, max, typical } */
const STYLE_CO2_RANGES: Record<
  string,
  { min: number; max: number; typical: number }
> = {
  // Light Lager
  "American Light Lager": { min: 2.5, max: 2.8, typical: 2.6 },
  "American Lager": { min: 2.5, max: 2.8, typical: 2.6 },
  // Pilsner
  "Czech Premium Pale Lager": { min: 2.3, max: 2.6, typical: 2.4 },
  "German Pils": { min: 2.5, max: 2.8, typical: 2.6 },
  // Amber/Dark Lager
  "Vienna Lager": { min: 2.4, max: 2.6, typical: 2.5 },
  Oktoberfest: { min: 2.3, max: 2.6, typical: 2.5 },
  "Munich Dunkel": { min: 2.3, max: 2.6, typical: 2.4 },
  Schwarzbier: { min: 2.3, max: 2.6, typical: 2.4 },
  // Bock
  "Traditional Bock": { min: 2.2, max: 2.5, typical: 2.3 },
  Doppelbock: { min: 2.2, max: 2.5, typical: 2.3 },
  Eisbock: { min: 2.0, max: 2.4, typical: 2.2 },
  // Pale Ales
  "Blonde Ale": { min: 2.4, max: 2.7, typical: 2.5 },
  "American Pale Ale": { min: 2.3, max: 2.8, typical: 2.5 },
  "English Pale Ale": { min: 1.5, max: 2.3, typical: 1.9 },
  "English Bitter": { min: 1.5, max: 2.3, typical: 1.9 },
  "English IPA": { min: 1.8, max: 2.5, typical: 2.2 },
  // IPA
  "American IPA": { min: 2.2, max: 2.7, typical: 2.4 },
  "West Coast IPA": { min: 2.3, max: 2.8, typical: 2.5 },
  "New England IPA": { min: 2.3, max: 2.7, typical: 2.5 },
  "Hazy IPA": { min: 2.3, max: 2.7, typical: 2.5 },
  "Double IPA": { min: 2.2, max: 2.7, typical: 2.4 },
  // Wheat
  "American Wheat Beer": { min: 2.5, max: 2.8, typical: 2.6 },
  Hefeweizen: { min: 3.5, max: 4.5, typical: 4.0 },
  Witbier: { min: 2.8, max: 3.5, typical: 3.1 },
  "Berliner Weisse": { min: 3.0, max: 4.5, typical: 3.5 },
  // Belgian
  "Belgian Pale Ale": { min: 2.3, max: 2.8, typical: 2.5 },
  "Belgian Blonde Ale": { min: 2.5, max: 3.0, typical: 2.8 },
  "Belgian Dubbel": { min: 2.3, max: 2.8, typical: 2.5 },
  "Belgian Tripel": { min: 2.5, max: 3.5, typical: 3.0 },
  "Belgian Golden Strong Ale": { min: 2.5, max: 3.5, typical: 3.0 },
  "Belgian Dark Strong Ale": { min: 2.3, max: 2.8, typical: 2.5 },
  Saison: { min: 3.0, max: 4.0, typical: 3.5 },
  // Stout / Porter
  "Irish Stout": { min: 1.8, max: 2.3, typical: 2.0 },
  "Sweet Stout": { min: 2.0, max: 2.4, typical: 2.2 },
  "Oatmeal Stout": { min: 2.0, max: 2.4, typical: 2.2 },
  "Imperial Stout": { min: 2.0, max: 2.5, typical: 2.2 },
  "English Porter": { min: 1.8, max: 2.5, typical: 2.1 },
  "Robust Porter": { min: 1.8, max: 2.5, typical: 2.2 },
  // Brown / Amber
  "American Brown Ale": { min: 2.2, max: 2.7, typical: 2.4 },
  "American Amber Ale": { min: 2.3, max: 2.8, typical: 2.5 },
  "English Brown Ale": { min: 1.5, max: 2.3, typical: 1.9 },
  // Scottish/Irish
  "Scottish Export": { min: 1.5, max: 2.3, typical: 1.9 },
  "Irish Red Ale": { min: 2.2, max: 2.6, typical: 2.4 },
  // German Ale
  Kölsch: { min: 2.4, max: 2.7, typical: 2.5 },
  Altbier: { min: 2.3, max: 2.7, typical: 2.5 },
  // Sour
  "Flanders Red Ale": { min: 2.3, max: 2.8, typical: 2.5 },
  "Oud Bruin": { min: 2.3, max: 2.8, typical: 2.5 },
  Lambic: { min: 1.0, max: 2.0, typical: 1.5 },
  Gueuze: { min: 3.0, max: 4.5, typical: 3.5 },
  Gose: { min: 2.8, max: 3.5, typical: 3.1 },
  // Strong
  Barleywine: { min: 1.8, max: 2.5, typical: 2.1 },
  "English Barleywine": { min: 1.8, max: 2.5, typical: 2.1 },
  "American Barleywine": { min: 2.0, max: 2.5, typical: 2.2 },
  // Cream Ale / Misc
  "Cream Ale": { min: 2.5, max: 2.8, typical: 2.6 },
  "California Common": { min: 2.4, max: 2.8, typical: 2.6 },
};

// ── Service ─────────────────────────────────────────────────────────────────

class PackagingCalculationService {
  // ── Helpers ─────────────────────────────────────────────────────────────

  private celsiusToFahrenheit(c: number): number {
    return c * 1.8 + 32;
  }

  // ── Residual CO2 ────────────────────────────────────────────────────────

  /**
   * Residual CO2 dissolved in beer after fermentation.
   * Based on the highest fermentation temperature (the warmer the ferment,
   * the more CO2 escapes).
   *
   * Formula: polynomial approximation of Henry's law at 1 atm.
   * Source: "New Brewing Lager Beer" by Greg Noonan / common homebrew formulation.
   */
  residualCo2(highestFermTempC: number): number {
    const f = this.celsiusToFahrenheit(highestFermTempC);
    return 3.0378 - 0.050062 * f + 0.00026555 * f * f;
  }

  /**
   * Extract the highest fermentation temperature from fermentation steps.
   * Falls back to 20 °C (68 °F) if no steps are defined.
   */
  highestFermTemp(steps: FermentationStep[]): number {
    if (steps.length === 0) return 20;
    return Math.max(...steps.map((s) => s.temperatureC));
  }

  // ── Priming Sugar ───────────────────────────────────────────────────────

  /**
   * Grams of priming sugar needed.
   *
   * formula: (targetVol - residualCO2) * batchLiters * sugarFactor
   */
  primingSugarGrams(
    targetCo2Vol: number,
    residualCo2: number,
    batchLiters: number,
    sugarType: PrimingSugarType
  ): number {
    const neededVol = Math.max(0, targetCo2Vol - residualCo2);
    return neededVol * batchLiters * SUGAR_FACTOR[sugarType];
  }

  /** Convert grams to ounces. */
  gramsToOz(grams: number): number {
    return grams / 28.3495;
  }

  /** Human-readable sugar type label. */
  sugarLabel(type: PrimingSugarType): string {
    return SUGAR_LABEL[type];
  }

  // ── Forced Carbonation (Kegging) ────────────────────────────────────────

  /**
   * Equilibrium PSI for force carbonation at a given temperature and
   * target CO2 volume.
   *
   * Formula: polynomial regression of CO2 solubility charts.
   * Source: common homebrew formulation (e.g., BrewersFriend, BeerSmith).
   */
  forcedCarbonationPsi(tempC: number, targetCo2Vol: number): number {
    const f = this.celsiusToFahrenheit(tempC);
    const v = targetCo2Vol;
    const psi =
      -16.6999 -
      0.0101059 * f +
      0.00116512 * f * f +
      0.173354 * f * v +
      4.24267 * v -
      0.0684226 * v * v;
    return Math.max(0, psi);
  }

  /**
   * Burst carbonation schedule: high PSI for a short time, then reduce.
   * Typical approach: 30 PSI for 24–48 hours, then drop to serving pressure.
   */
  burstCarbonationSchedule(servingPsi: number): {
    burstPsi: number;
    burstDurationHours: number;
    finalPsi: number;
  } {
    return {
      burstPsi: 30,
      burstDurationHours: 24,
      finalPsi: servingPsi,
    };
  }

  // ── Bottles ─────────────────────────────────────────────────────────────

  /** Number of bottles needed for a batch (single size). */
  numberOfBottles(batchVolumeL: number, bottleSize: BottleSize): number {
    const sizeML = BOTTLE_SIZE_ML[bottleSize];
    return Math.ceil((batchVolumeL * 1000) / sizeML);
  }

  /** Bottle size in mL. */
  bottleSizeML(size: BottleSize): number {
    return BOTTLE_SIZE_ML[size];
  }

  /** Total count across all bottle entries. */
  totalBottleCount(bottles: BottleEntry[]): number {
    return bottles.reduce((sum, b) => sum + b.count, 0);
  }

  /** Total volume in liters from bottle entries. */
  totalBottleVolumeL(bottles: BottleEntry[]): number {
    return bottles.reduce(
      (sum, b) => sum + (b.count * BOTTLE_SIZE_ML[b.size]) / 1000,
      0
    );
  }

  /** Default bottle entry filling remaining batch volume. */
  defaultBottleEntry(
    batchVolumeL: number,
    size: BottleSize,
    existingBottles: BottleEntry[]
  ): BottleEntry {
    const usedML = existingBottles.reduce(
      (sum, b) => sum + b.count * BOTTLE_SIZE_ML[b.size],
      0
    );
    const remainingML = Math.max(0, batchVolumeL * 1000 - usedML);
    const count = Math.ceil(remainingML / BOTTLE_SIZE_ML[size]);
    return { size, count };
  }

  // ── Conditioning ────────────────────────────────────────────────────────

  /**
   * Rough estimate of bottle conditioning time in days.
   * Warmer = faster carbonation.
   */
  estimatedConditioningDays(tempC: number): number {
    if (tempC >= 24) return 7;
    if (tempC >= 20) return 14;
    if (tempC >= 16) return 21;
    return 28;
  }

  // ── Style Suggestions ───────────────────────────────────────────────────

  /**
   * Get BJCP-based CO2 volume range for a style.
   * Does a case-insensitive substring match against the lookup table.
   */
  styleCo2Range(
    styleName: string
  ): { min: number; max: number; typical: number } | null {
    if (!styleName) return null;
    const lower = styleName.toLowerCase();

    // Exact match first
    for (const [key, range] of Object.entries(STYLE_CO2_RANGES)) {
      if (key.toLowerCase() === lower) return range;
    }
    // Substring match
    for (const [key, range] of Object.entries(STYLE_CO2_RANGES)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
        return range;
      }
    }
    return null;
  }

  /** All available style names (for UI display). */
  availableStyles(): string[] {
    return Object.keys(STYLE_CO2_RANGES);
  }
}

export const packagingCalculationService =
  new PackagingCalculationService();
