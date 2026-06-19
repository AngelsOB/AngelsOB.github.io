/**
 * Fermentable Calculation Service
 *
 * Handles calculations for fermentables including:
 * - Converting between weight amounts and percentages
 * - Calculating grain weights from target ABV and percentages
 */

import type { Fermentable } from "../models/Recipe";
import { fermentableExtractEfficiency, inferFermentability } from "../data/fermentablePresets";
import { LITERS_TO_GALLONS, KG_TO_LBS } from "@/calculators/units";

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
   * Calculate fermentable weights from percentages and target ABV.
   *
   * This is the exact inverse of RecipeCalculationService's forward OG calc, so
   * a bill it produces will read back as the requested ABV. To stay symmetric it
   * must use the SAME efficiency selector (sugar/extract at 100%, grains at the
   * system brewhouse efficiency — via fermentableExtractEfficiency) and the SAME
   * volume basis (the into-fermenter volume the OG calc divides by).
   *
   * @param fermentables Current fermentables
   * @param percentById Percentage for each fermentable by ID
   * @param targetABV Target ABV percentage
   * @param ogReferenceVolumeL Into-fermenter volume in liters — the same reference
   *   volume the forward OG calc divides by (VolumeCalculationService.calculateIntoFermenterVolume)
   * @param brewhouseEfficiencyPercent System brewhouse efficiency percentage (applied to grains; sugar/extract at 100%)
   * @param effectiveAttenuation Effective attenuation (0-1, e.g. 0.75 for 75%)
   * @returns Updated fermentables with new weights
   */
  calculateWeightsFromPercentsAndABV(
    fermentables: Fermentable[],
    percentById: Record<string, number>,
    targetABV: number,
    ogReferenceVolumeL: number,
    brewhouseEfficiencyPercent: number,
    effectiveAttenuation: number
  ): Fermentable[] {
    const efficiency = Math.max(0, Math.min(1, brewhouseEfficiencyPercent / 100));
    const volumeGal = Math.max(0, ogReferenceVolumeL * LITERS_TO_GALLONS);
    const attenuation = Math.max(0.4, Math.min(0.98, effectiveAttenuation));

    if (!(volumeGal > 0) || !(efficiency > 0) || !(attenuation > 0)) {
      return fermentables;
    }

    // Effective GU per lb of the bill, and the fermentable-weighted share of it.
    //  - extract efficiency mirrors the forward OG calc (sugar/extract at 100%,
    //    grains/mashable adjuncts at the system mash efficiency)
    //  - fermentability mirrors the forward FG split (per-fermentable fraction)
    let effectiveGuPerLb = 0;
    let fermentableGuPerLb = 0;
    for (const f of fermentables) {
      const pct = Math.max(0, percentById[f.id] ?? 0) / 100;
      const guPerLb = pct * f.ppg * fermentableExtractEfficiency(f, efficiency);
      const ferm = f.fermentability ?? inferFermentability(f);
      effectiveGuPerLb += guPerLb;
      fermentableGuPerLb += guPerLb * ferm;
    }

    if (!(effectiveGuPerLb > 0)) {
      return fermentables;
    }

    // Only the fermentable share of the extract attenuates into alcohol, so the
    // OG must be raised to compensate for any non-fermentable extract (lactose,
    // dextrins, heavy crystal). For an all-base/sugar bill avgFermentability is
    // 1, leaving the simple inversion unchanged.
    const avgFermentability = fermentableGuPerLb / effectiveGuPerLb;
    if (!(avgFermentability > 0)) {
      // Entirely non-fermentable bill — no grain weight can produce alcohol.
      return fermentables;
    }

    // Invert the ABV formula to the target OG, symmetric with calculateABV +
    // calculateFG: ABV = (OG - 1) * 131.25 * attenuation * avgFermentability.
    const ogTarget =
      1 + Math.max(0, targetABV) / (131.25 * attenuation * avgFermentability);
    const totalGuNeeded = (ogTarget - 1) * 1000 * volumeGal;

    const totalLb = totalGuNeeded / effectiveGuPerLb;
    const totalKg = totalLb / KG_TO_LBS;

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
