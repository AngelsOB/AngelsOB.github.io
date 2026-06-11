/**
 * Fermentable Calculation Service
 *
 * Handles calculations for fermentables including:
 * - Converting between weight amounts and percentages
 * - Calculating grain weights from target ABV and percentages
 */

import type { Fermentable } from "../models/Recipe";

export class FermentableCalculationService {
  /**
   * Calculate fermentable percentages from weights
   */
  calculatePercentsFromWeights(fermentables: Fermentable[]): Record<string, number> {
    const totalKg = fermentables.reduce((sum, f) => sum + f.weightKg, 0);
    const percentById: Record<string, number> = {};

    for (const f of fermentables) {
      const pct = totalKg > 0 ? (f.weightKg / totalKg) * 100 : 0;
      percentById[f.id] = Number.isFinite(pct) ? Number(pct.toFixed(1)) : 0;
    }

    return percentById;
  }

  /**
   * Calculate fermentable weights from percentages and target ABV
   *
   * @param fermentables Current fermentables
   * @param percentById Percentage for each fermentable by ID
   * @param targetABV Target ABV percentage
   * @param batchVolumeL Batch volume in liters
   * @param mashEfficiencyPercent Mash efficiency percentage
   * @param yeastAttenuation Yeast attenuation (0-1, e.g., 0.75 for 75%)
   * @returns Updated fermentables with new weights
   */
  calculateWeightsFromPercentsAndABV(
    fermentables: Fermentable[],
    percentById: Record<string, number>,
    targetABV: number,
    batchVolumeL: number,
    mashEfficiencyPercent: number,
    effectiveAttenuation: number
  ): Fermentable[] {
    const galPerL = 0.264172;
    const lbsPerKg = 2.20462;
    const efficiency = Math.max(0, Math.min(1, mashEfficiencyPercent / 100));
    const volumeGal = Math.max(0, batchVolumeL * galPerL);
    const attenuation = Math.max(0.4, Math.min(0.98, effectiveAttenuation));

    if (!(volumeGal > 0) || !(efficiency > 0) || !(attenuation > 0)) {
      return fermentables;
    }

    // Invert ABV formula to get target OG
    // ABV ≈ (OG - 1) * 131.25 * attenuation
    // Therefore: OG = 1 + ABV / (131.25 * attenuation)
    const ogTarget = 1 + Math.max(0, targetABV) / (131.25 * attenuation);
    const pointsPerGal = (ogTarget - 1) * 1000; // Gravity units
    const totalGuNeeded = pointsPerGal * volumeGal;

    // Calculate effective GU per lb based on percentages and PPG
    let effectiveGuPerLb = 0;
    for (const f of fermentables) {
      const pct = Math.max(0, percentById[f.id] ?? 0) / 100;
      const eff = (f.efficiencyPercent || 75) / 100;
      effectiveGuPerLb += pct * f.ppg * eff;
    }

    if (!(effectiveGuPerLb > 0)) {
      return fermentables;
    }

    const totalLb = totalGuNeeded / effectiveGuPerLb;
    const totalKg = totalLb / lbsPerKg;

    // Calculate new weights for each fermentable
    return fermentables.map(f => {
      const pct = Math.max(0, percentById[f.id] ?? 0) / 100;
      const nextKg = totalKg * pct;
      return { ...f, weightKg: Number.isFinite(nextKg) ? nextKg : 0 };
    });
  }

  /**
   * Calculate total percentage sum
   */
  calculateTotalPercent(
    fermentables: Fermentable[],
    percentById: Record<string, number>
  ): number {
    return fermentables.reduce((acc, f) => acc + (percentById[f.id] ?? 0), 0);
  }
}

// Export singleton instance
export const fermentableCalculationService = new FermentableCalculationService();
