/**
 * Volume Calculation Service
 *
 * Handles all water volume calculations for brewing:
 * - Pre-boil volume
 * - Mash water
 * - Sparge water
 * - All losses (grain absorption, kettle, chiller, fermenter, hop absorption)
 *
 * This is pure business logic with NO React dependencies.
 * Can be tested in isolation.
 */

import type { Recipe } from '../models/Recipe';

export class VolumeCalculationService {
  /**
   * Calculate pre-boil volume (volume needed before boiling starts)
   *
   * Formula: batchVolumeL + boilOff + losses
   */
  calculatePreBoilVolume(recipe: Recipe): number {
    const { batchVolumeL, equipment, hops } = recipe;

    // Calculate boil-off
    const boilOffL = (equipment.boilOffRateLPerHour * equipment.boilTimeMin) / 60;

    // Calculate hop absorption (only kettle hops: boil + whirlpool + first wort)
    const kettleHopsKg = hops
      .filter((h) => h.type === 'boil' || h.type === 'whirlpool' || h.type === 'first wort')
      .reduce((sum, h) => sum + h.grams / 1000, 0);
    const hopAbsorptionL = kettleHopsKg * equipment.hopsAbsorptionLPerKg;

    // Calculate total losses
    const totalLossesL =
      equipment.kettleLossLiters +
      hopAbsorptionL +
      equipment.chillerLossLiters +
      equipment.fermenterLossLiters;

    // Account for cooling shrinkage (wort contracts as it cools)
    const shrinkageFactor = 1 + equipment.coolingShrinkagePercent / 100;

    // Pre-boil = (batch + losses) * shrinkage + boilOff
    const preBoilL = (batchVolumeL + totalLossesL) * shrinkageFactor + boilOffL;

    return Math.round(preBoilL * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate the cold post-boil volume — the total wort in the kettle at the end
   * of the boil (after boil-off and cooling shrinkage, before any losses are drawn
   * off). Equals batchVolume + ALL losses.
   *
   * Use this for WATER/VOLUME planning (pre-boil volume, strike, sparge) — you must
   * brew enough wort to cover every downstream loss. Do NOT use it as the OG/FG
   * denominator: gravity is referenced to the into-fermenter volume (see
   * calculateIntoFermenterVolume), paired with brewhouse efficiency.
   *
   * Formula: (preBoilVolume − boilOff) / shrinkageFactor  (= batchVolume + losses)
   */
  calculatePostBoilVolume(recipe: Recipe): number {
    const { equipment } = recipe;
    const preBoilL = this.calculatePreBoilVolume(recipe);
    const boilOffL = (equipment.boilOffRateLPerHour * equipment.boilTimeMin) / 60;
    const shrinkageFactor = 1 + equipment.coolingShrinkagePercent / 100;
    return Math.max(0, (preBoilL - boilOffL) / shrinkageFactor);
  }

  /**
   * Volume of wort that goes INTO the fermenter — where OG is physically measured.
   *
   * In this app batchVolumeL is the FINISHED (packaged) volume, so the fermenter
   * holds the finished beer plus the fermenter/packaging loss that gets left behind
   * (trub + yeast). Kettle/chiller/hop losses are NOT here — they stay in the kettle
   * and are already accounted for by brewhouse efficiency. This is the correct OG/FG
   * gravity denominator (pairs with brewhouse efficiency; matches Brewfather).
   *
   * Formula: batchVolume + fermenterLoss
   */
  calculateIntoFermenterVolume(recipe: Recipe): number {
    const { batchVolumeL, equipment } = recipe;
    return Math.max(0, batchVolumeL + (equipment.fermenterLossLiters ?? 0));
  }

  /**
   * Calculate mash water volume (strike water)
   *
   * Formula: totalGrainKg × mashThickness + deadspace
   */
  calculateMashWater(recipe: Recipe): number {
    const { fermentables, equipment } = recipe;

    // Calculate total grain weight
    const totalGrainKg = fermentables.reduce((sum, f) => sum + f.weightKg, 0);

    // Mash water = grain × thickness + deadspace
    const mashWaterL =
      totalGrainKg * equipment.mashThicknessLPerKg + equipment.mashTunDeadspaceLiters;

    return Math.round(mashWaterL * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate sparge water volume
   *
   * Formula: preBoilVolume - mashRunoff
   * Where mashRunoff = mashWater - grainAbsorption - mashTunLoss
   *
   * Note: Deadspace (water below false bottom) IS recovered during drain,
   * so it affects the strike/sparge split but NOT total water.
   * Only mashTunLoss (water that doesn't reach the kettle) is subtracted.
   */
  calculateSpargeWater(recipe: Recipe): number {
    const { fermentables, equipment } = recipe;

    const preBoilL = this.calculatePreBoilVolume(recipe);
    const mashWaterL = this.calculateMashWater(recipe);

    // Calculate total grain weight
    const totalGrainKg = fermentables.reduce((sum, f) => sum + f.weightKg, 0);

    // Grain absorbs water
    const grainAbsorptionL = totalGrainKg * equipment.grainAbsorptionLPerKg;

    // Mash tun loss = water that doesn't make it out of the mash tun (default 0)
    const mashTunLossL = equipment.mashTunLossLiters ?? 0;

    // Mash runoff = what we get out of the mash tun
    // Deadspace is recovered during drain (not subtracted), only grain absorption and tun loss reduce runoff
    const mashRunoffL = mashWaterL - grainAbsorptionL - mashTunLossL;

    // Sparge = what we need to reach pre-boil volume
    const spargeWaterL = preBoilL - mashRunoffL;

    return Math.max(0, Math.round(spargeWaterL * 10) / 10); // Round to 1 decimal, min 0
  }

  /**
   * Calculate total water needed
   */
  calculateTotalWater(recipe: Recipe): number {
    const mashWaterL = this.calculateMashWater(recipe);
    const spargeWaterL = this.calculateSpargeWater(recipe);

    return Math.round((mashWaterL + spargeWaterL) * 10) / 10;
  }

  /**
   * Calculate strike water temperature
   *
   * Formula: (targetTemp - grainTemp) × (0.41 / thickness) + targetTemp
   * This is a simplified formula assuming grain temp of 20°C
   */
  calculateStrikeTemp(
    targetMashTempC: number,
    mashThicknessLPerKg: number,
    grainTempC: number = 20
  ): number {
    const tempDiff = targetMashTempC - grainTempC;
    const strikeTemp = (tempDiff * (0.41 / mashThicknessLPerKg)) + targetMashTempC;

    return Math.round(strikeTemp * 10) / 10;
  }
}

// Export singleton instance
export const volumeCalculationService = new VolumeCalculationService();
