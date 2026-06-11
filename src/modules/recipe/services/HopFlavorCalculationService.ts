/**
 * Hop Flavor Calculation Service
 *
 * Calculates estimated hop flavor profiles based on:
 * - Hop varieties and their flavor profiles
 * - Dose (grams per liter)
 * - Timing and addition method (aroma retention factors)
 *
 * Based on the original hopsFlavor.ts implementation.
 */

import type { Hop } from "../models/Recipe";
import type { HopFlavorProfile } from "../models/Presets";

// Tunable constants
const AROMA_DECAY_PER_MINUTE = 0.05; // exp(-k*t) decay for boil additions
const OVERALL_INTENSITY_LAMBDA = 0.7; // maps g/L to 0-5 via 1-exp(-lambda*x)

const HOP_FLAVOR_KEYS: (keyof HopFlavorProfile)[] = [
  "citrus",
  "tropicalFruit",
  "stoneFruit",
  "berry",
  "floral",
  "grassy",
  "herbal",
  "spice",
  "resinPine",
];

const EMPTY_FLAVOR: HopFlavorProfile = {
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

function clamp(value: number, min = 0, max = 5): number {
  return Math.max(min, Math.min(max, value));
}

export class HopFlavorCalculationService {
  /**
   * Calculate aroma retention factor based on hop addition timing and method
   */
  private timingAromaFactor(
    type: Hop["type"],
    timeMin: number,
    tempC?: number,
    whirlpoolTimeMin?: number
  ): number {
    switch (type) {
      case "dry hop":
        // High aroma retention for dry hopping
        return 0.8;

      case "whirlpool": {
        // Model: base 0.75, boosted by cooler temps and longer steeps
        const temp = tempC || 80;
        const time = whirlpoolTimeMin ?? timeMin ?? 15;
        const tempFactor = 0.6 + 0.4 * Math.max(0, Math.min(1, (95 - temp) / 20));
        const timeFactor = 1 - Math.exp(-0.06 * Math.max(0, time));
        return Math.min(1, 0.5 + 0.5 * tempFactor * timeFactor);
      }

      case "boil":
        // Exponential decay with boil time
        return Math.max(0.03, Math.exp(-AROMA_DECAY_PER_MINUTE * Math.max(0, timeMin)));

      case "first wort":
        return 0.08;

      case "mash":
        return 0.05;

      default:
        return 0.5;
    }
  }

  /**
   * Estimate the combined hop flavor profile for a recipe
   *
   * Algorithm:
   * - Compute per-addition aroma weight w_i = (grams_i / batchL) * aromaFactor(type, time)
   * - Compute axis sums S_axis = sum_i w_i * (flavor_i_axis / 5)
   * - Let W = sum_i w_i (overall aroma intensity proxy)
   * - Map W to magnitude M in [0,5] via M = 5*(1 - exp(-lambda * W))
   * - Final axis = clamp( M * (S_axis / (W || 1)) )
   *
   * @param hops Array of hops with their properties
   * @param hopFlavors Map of hop name to flavor profile
   * @param batchVolumeL Batch volume in liters
   */
  calculateCombinedFlavor(
    hops: Hop[],
    hopFlavors: Map<string, HopFlavorProfile>,
    batchVolumeL: number
  ): HopFlavorProfile {
    let overallWeight = 0;
    const axisSum: Record<keyof HopFlavorProfile, number> = { ...EMPTY_FLAVOR };

    for (const hop of hops) {
      const flavor = hopFlavors.get(hop.name);
      if (!flavor) continue;

      const gpl = batchVolumeL > 0 ? hop.grams / batchVolumeL : 0;
      const factor = this.timingAromaFactor(
        hop.type,
        hop.timeMinutes || 0,
        hop.temperatureC,
        hop.whirlpoolTimeMinutes
      );
      const weight = gpl * factor;
      if (weight <= 0) continue;

      overallWeight += weight;
      for (const k of HOP_FLAVOR_KEYS) {
        const axis = (flavor[k] || 0) / 5; // normalize to 0..1
        axisSum[k] += weight * axis;
      }
    }

    if (overallWeight <= 0) return { ...EMPTY_FLAVOR };

    const magnitude = 5 * (1 - Math.exp(-OVERALL_INTENSITY_LAMBDA * overallWeight));

    const result: HopFlavorProfile = { ...EMPTY_FLAVOR };
    for (const k of HOP_FLAVOR_KEYS) {
      const proportion = axisSum[k] / overallWeight;
      result[k] = clamp(magnitude * proportion);
    }
    return result;
  }
}

// Export singleton instance
export const hopFlavorCalculationService = new HopFlavorCalculationService();
