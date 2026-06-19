/**
 * Mash Schedule Calculation Service
 *
 * Handles calculations related to mash schedules:
 * - Strike water temperature
 * - Default schedule generation
 *
 * This is pure business logic with NO React dependencies.
 * Can be tested in isolation.
 */

import type { MashStep } from '../models/Recipe';
import { uid } from "@/utils/uid";

export class MashScheduleService {
  /**
   * Calculate strike water temperature for initial infusion
   *
   * Formula: (targetTemp - grainTemp) × (0.41 / thickness) + targetTemp
   * This assumes grain temp of 20°C by default
   *
   * @param targetMashTempC - Target mash temperature in Celsius
   * @param mashThicknessLPerKg - Mash thickness in L/kg
   * @param grainTempC - Grain temperature in Celsius (default: 20)
   * @param totalGrainKg - Total grain weight in kg (for heat capacity adjustments)
   * @returns Strike water temperature in Celsius
   */
  calculateStrikeTemp(
    targetMashTempC: number,
    mashThicknessLPerKg: number,
    grainTempC: number = 20,
    totalGrainKg: number = 0
  ): number {
    // Grain-to-water heat capacity ratio: 0.41
    // Source: Palmer's "How to Brew" (c_grain/c_water ≈ 1.71/4.18 ≈ 0.41)
    // Also used by Brewfather and Brewer's Friend.
    const grainHeatRatio = 0.41;

    // Calculate water volume for this infusion
    const waterVolumeLiters = totalGrainKg * mashThicknessLPerKg;

    // If no grain weight provided, use simplified Palmer formula
    if (totalGrainKg === 0 || waterVolumeLiters === 0) {
      const tempDiff = targetMashTempC - grainTempC;
      const strikeTemp = tempDiff * (grainHeatRatio / mashThicknessLPerKg) + targetMashTempC;
      return Math.round(strikeTemp * 10) / 10;
    }

    // Full heat balance equation:
    // strikeTemp = targetTemp + (grainMass × grainHeatRatio × (targetTemp − grainTemp)) / waterMass
    const strikeTemp =
      targetMashTempC +
      (totalGrainKg * grainHeatRatio * (targetMashTempC - grainTempC)) /
        waterVolumeLiters;

    return Math.round(strikeTemp * 10) / 10;
  }

  /**
   * Calculate total mash time across all steps
   *
   * @param steps - All mash steps
   * @returns Total time in minutes
   */
  calculateTotalMashTime(steps: MashStep[]): number {
    return steps.reduce((sum, step) => sum + step.durationMinutes, 0);
  }

  /**
   * Generate a default single infusion mash schedule
   *
   * @returns Default mash step for single infusion mash
   */
  generateDefaultSingleInfusion(): MashStep {
    return {
      id: uid(),
      name: 'Saccharification',
      temperatureC: 67,
      durationMinutes: 60,
    };
  }

  /**
   * Generate a step mash schedule
   *
   * @returns Array of mash steps for a typical step mash
   */
  generateStepMash(): MashStep[] {
    return [
      { id: uid(), name: 'Protein Rest', temperatureC: 52, durationMinutes: 15 },
      { id: uid(), name: 'Beta Rest', temperatureC: 63, durationMinutes: 30 },
      { id: uid(), name: 'Alpha Rest', temperatureC: 70, durationMinutes: 15 },
      { id: uid(), name: 'Mash Out', temperatureC: 76, durationMinutes: 10 },
    ];
  }

  /**
   * Generate a decoction mash schedule
   *
   * @returns Array of mash steps for a typical decoction mash
   */
  generateDecoction(): MashStep[] {
    return [
      { id: uid(), name: 'Acid Rest', temperatureC: 40, durationMinutes: 15 },
      { id: uid(), name: 'Protein Rest', temperatureC: 52, durationMinutes: 15 },
      { id: uid(), name: 'Saccharification', temperatureC: 67, durationMinutes: 60 },
      { id: uid(), name: 'Mash Out', temperatureC: 76, durationMinutes: 10 },
    ];
  }

  /**
   * Validate a mash step
   *
   * @param step - Mash step to validate
   * @returns Array of error messages (empty if valid)
   */
  validateMashStep(step: MashStep): string[] {
    const errors: string[] = [];

    if (!step.name || step.name.trim() === '') {
      errors.push('Step name is required');
    }

    if (
      Number.isNaN(step.temperatureC) ||
      step.temperatureC < 0 ||
      step.temperatureC > 100
    ) {
      errors.push('Temperature must be between 0°C and 100°C');
    }

    if (Number.isNaN(step.durationMinutes) || step.durationMinutes <= 0) {
      errors.push('Duration must be greater than 0 minutes');
    }

    return errors;
  }
}

// Export singleton instance
export const mashScheduleService = new MashScheduleService();
