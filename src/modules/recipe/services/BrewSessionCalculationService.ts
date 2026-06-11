/**
 * BrewSessionCalculationService
 *
 * Calculates brew session metrics from actual measurements taken during brew day.
 * NO React dependencies, NO hooks, NO localStorage - pure logic only.
 */

import type { Recipe } from '../models/Recipe';
import type { SessionActuals, SessionCalculated } from '../models/BrewSession';

/** Conversion factor: liters to US gallons */
const LITERS_TO_GALLONS = 0.264172;

/** Conversion factor: kilograms to pounds */
const KG_TO_LBS = 2.20462;

export class BrewSessionCalculationService {
  /**
   * Calculate all session metrics from actual measurements.
   *
   * @param originalRecipe - The recipe as originally planned (unused currently, reserved for future comparisons)
   * @param brewDayRecipe - The recipe as modified on brew day
   * @param actuals - Actual measurements taken during brew day
   * @returns Calculated session metrics
   */
  calculateSessionMetrics(
    _originalRecipe: Recipe,
    brewDayRecipe: Recipe,
    actuals: SessionActuals
  ): SessionCalculated {
    const calculated: SessionCalculated = {};

    // Calculate actual ABV from measured OG/FG
    if (actuals.originalGravity && actuals.finalGravity) {
      calculated.actualABV = this.calculateABV(
        actuals.originalGravity,
        actuals.finalGravity
      );
      calculated.apparentAttenuation = this.calculateApparentAttenuation(
        actuals.originalGravity,
        actuals.finalGravity
      );
    }

    // Calculate mash efficiency from pre-boil measurements
    if (actuals.preBoilGravity && actuals.preBoilVolumeL) {
      calculated.mashEfficiency = this.calculateMashEfficiency(
        brewDayRecipe,
        actuals.preBoilGravity,
        actuals.preBoilVolumeL
      );
    }

    // Calculate brewhouse efficiency from OG
    if (actuals.originalGravity) {
      const volumeL = this.getEffectiveVolume(actuals, brewDayRecipe);
      calculated.brewhouseEfficiency = this.calculateBrewhouseEfficiency(
        brewDayRecipe,
        actuals.originalGravity,
        volumeL
      );
    }

    return calculated;
  }

  /**
   * Calculate Alcohol By Volume from measured OG and FG.
   *
   * Formula: ABV = (OG - FG) × 131.25
   *
   * @param og - Original gravity (e.g., 1.050)
   * @param fg - Final gravity (e.g., 1.010)
   * @returns ABV percentage (e.g., 5.25)
   */
  calculateABV(og: number, fg: number): number {
    return (og - fg) * 131.25;
  }

  /**
   * Calculate apparent attenuation from measured OG and FG.
   *
   * Formula: AA% = ((OG - FG) / (OG - 1.0)) × 100
   *
   * @param og - Original gravity (e.g., 1.050)
   * @param fg - Final gravity (e.g., 1.010)
   * @returns Apparent attenuation percentage (e.g., 80.0)
   */
  calculateApparentAttenuation(og: number, fg: number): number | undefined {
    if (og <= 1.0) return undefined;
    return ((og - fg) / (og - 1.0)) * 100;
  }

  /**
   * Calculate mash efficiency from pre-boil gravity and volume.
   *
   * Mash efficiency measures how effectively sugars were extracted from the grain
   * before the boil. It compares actual gravity points collected to the theoretical
   * maximum based on fermentable PPG values.
   *
   * Formula:
   *   Actual Points = (PreBoilSG - 1) × 1000 × PreBoilVolumeGal
   *   Potential Points = Σ(PPG × WeightLbs) for all fermentables
   *   Mash Efficiency = (Actual Points / Potential Points) × 100
   *
   * @param recipe - Recipe with fermentables to calculate potential points
   * @param preBoilGravity - Measured pre-boil specific gravity (e.g., 1.040)
   * @param preBoilVolumeL - Measured pre-boil volume in liters
   * @returns Mash efficiency percentage (e.g., 72.5)
   */
  calculateMashEfficiency(
    recipe: Recipe,
    preBoilGravity: number,
    preBoilVolumeL: number
  ): number | undefined {
    const potentialPoints = this.calculatePotentialPoints(recipe);
    if (potentialPoints <= 0) return undefined;

    const preBoilPoints = this.sgToPoints(preBoilGravity);
    const preBoilVolumeGal = preBoilVolumeL * LITERS_TO_GALLONS;
    const actualPoints = preBoilPoints * preBoilVolumeGal;

    return (actualPoints / potentialPoints) * 100;
  }

  /**
   * Calculate brewhouse efficiency from original gravity and final volume.
   *
   * Brewhouse efficiency measures overall system efficiency - from grain to fermenter.
   * It accounts for all losses: grain absorption, boil-off, trub loss, etc.
   *
   * Formula:
   *   Actual Points = (OG - 1) × 1000 × FinalVolumeGal
   *   Potential Points = Σ(PPG × WeightLbs) for all fermentables
   *   Brewhouse Efficiency = (Actual Points / Potential Points) × 100
   *
   * @param recipe - Recipe with fermentables to calculate potential points
   * @param originalGravity - Measured original gravity (e.g., 1.050)
   * @param volumeL - Final volume in liters (into fermenter)
   * @returns Brewhouse efficiency percentage (e.g., 68.0)
   */
  calculateBrewhouseEfficiency(
    recipe: Recipe,
    originalGravity: number,
    volumeL: number
  ): number | undefined {
    const potentialPoints = this.calculatePotentialPoints(recipe);
    if (potentialPoints <= 0) return undefined;

    const ogPoints = this.sgToPoints(originalGravity);
    const volumeGal = volumeL * LITERS_TO_GALLONS;
    const actualPoints = ogPoints * volumeGal;

    return (actualPoints / potentialPoints) * 100;
  }

  /**
   * Calculate total potential gravity points from fermentables.
   *
   * Potential points represent the maximum gravity contribution possible
   * from all fermentables if extraction were 100% efficient.
   *
   * Formula: Σ(PPG × WeightLbs) for all fermentables
   *
   * @param recipe - Recipe with fermentables
   * @returns Total potential gravity points
   */
  private calculatePotentialPoints(recipe: Recipe): number {
    if (recipe.fermentables.length === 0) return 0;

    return recipe.fermentables.reduce((sum, fermentable) => {
      const weightLbs = fermentable.weightKg * KG_TO_LBS;
      return sum + fermentable.ppg * weightLbs;
    }, 0);
  }

  /**
   * Convert specific gravity to gravity points.
   *
   * Formula: Points = (SG - 1) × 1000
   *
   * @param sg - Specific gravity (e.g., 1.050)
   * @returns Gravity points (e.g., 50)
   */
  private sgToPoints(sg: number): number {
    return (sg - 1) * 1000;
  }

  /**
   * Determine the effective volume for brewhouse efficiency calculation.
   *
   * Priority: into fermenter > post-boil > batch volume (from recipe)
   *
   * @param actuals - Actual measurements
   * @param recipe - Recipe for fallback batch volume
   * @returns Volume in liters to use for calculation
   */
  private getEffectiveVolume(actuals: SessionActuals, recipe: Recipe): number {
    return (
      actuals.intoFermenterL ??
      actuals.postBoilVolumeL ??
      recipe.batchVolumeL
    );
  }
}

// Export singleton instance for convenience
export const brewSessionCalculationService = new BrewSessionCalculationService();
