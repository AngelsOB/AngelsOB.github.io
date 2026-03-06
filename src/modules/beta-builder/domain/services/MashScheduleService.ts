/**
 * Mash Schedule Calculation Service
 *
 * Handles all calculations related to mash schedules:
 * - Strike water temperature
 * - Infusion water temperature (step mashes)
 * - Infusion volume calculations
 * - Total mash volume tracking
 *
 * This is pure business logic with NO React dependencies.
 * Can be tested in isolation.
 */

import type { MashStep, Recipe } from '../models/Recipe';
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
    // Heat capacity: grain = 0.38, water = 1.0
    const grainHeatCapacity = 0.38;
    const waterHeatCapacity = 1.0;

    // Calculate water volume for this infusion
    const waterVolumeLiters = totalGrainKg * mashThicknessLPerKg;

    // If no grain weight provided, use simplified formula
    if (totalGrainKg === 0 || waterVolumeLiters === 0) {
      const tempDiff = targetMashTempC - grainTempC;
      const strikeTemp = tempDiff * (0.41 / mashThicknessLPerKg) + targetMashTempC;
      return Math.round(strikeTemp * 10) / 10;
    }

    // Full heat balance equation:
    // (water mass × water heat capacity × (strike temp - target temp)) =
    // (grain mass × grain heat capacity × (target temp - grain temp))
    //
    // Solving for strike temp:
    // strike temp = target temp + (grain mass × grain HC × (target - grain temp)) / (water mass × water HC)

    const grainMassKg = totalGrainKg;
    const waterMassKg = waterVolumeLiters; // 1 L water ≈ 1 kg

    const strikeTemp =
      targetMashTempC +
      (grainMassKg * grainHeatCapacity * (targetMashTempC - grainTempC)) /
        (waterMassKg * waterHeatCapacity);

    return Math.round(strikeTemp * 10) / 10;
  }

  /**
   * Calculate infusion water temperature for a step mash
   *
   * Used when adding hot water to raise mash temperature to next step.
   *
   * Formula: ((targetTemp - currentTemp) × (grainWeight × 0.41 + currentMashVolume)) / infusionVolume + targetTemp
   *
   * @param currentMashTempC - Current mash temperature in Celsius
   * @param targetMashTempC - Target mash temperature in Celsius
   * @param currentMashVolumeLiters - Current mash volume in liters
   * @param infusionVolumeLiters - Volume of infusion water to add in liters
   * @param totalGrainKg - Total grain weight in kg
   * @returns Infusion water temperature in Celsius
   */
  calculateInfusionTemp(
    currentMashTempC: number,
    targetMashTempC: number,
    currentMashVolumeLiters: number,
    infusionVolumeLiters: number,
    totalGrainKg: number
  ): number {
    if (infusionVolumeLiters === 0) return targetMashTempC;

    // Heat capacity of grain
    const grainHeatCapacity = 0.41;

    // Total heat capacity of current mash (grain + water)
    const mashHeatCapacity = totalGrainKg * grainHeatCapacity + currentMashVolumeLiters;

    // Calculate infusion temp using heat balance
    const tempRise = targetMashTempC - currentMashTempC;
    const infusionTemp = (tempRise * mashHeatCapacity) / infusionVolumeLiters + targetMashTempC;

    return Math.round(infusionTemp * 10) / 10;
  }

  /**
   * Calculate the total mash volume after a step
   *
   * @param steps - All mash steps up to and including the current step
   * @param totalGrainKg - Total grain weight in kg
   * @param grainAbsorptionLPerKg - Grain absorption rate in L/kg
   * @returns Total mash volume in liters
   */
  calculateMashVolumeAtStep(
    steps: MashStep[],
    totalGrainKg: number,
    grainAbsorptionLPerKg: number
  ): number {
    // Start with 0 volume
    let totalVolume = 0;

    // Add infusion volumes from all infusion steps
    for (const step of steps) {
      if (step.type === 'infusion' && step.infusionVolumeLiters) {
        totalVolume += step.infusionVolumeLiters;
      }
    }

    // Subtract grain absorption (grain soaks up water)
    // This is a loss that happens continuously but we account for it at the end
    const grainAbsorption = totalGrainKg * grainAbsorptionLPerKg;
    const availableVolume = totalVolume - grainAbsorption;

    return Math.max(0, Math.round(availableVolume * 10) / 10);
  }

  /**
   * Calculate total infusion water needed across all steps
   *
   * @param steps - All mash steps
   * @returns Total infusion water in liters
   */
  calculateTotalInfusionWater(steps: MashStep[]): number {
    const total = steps.reduce((sum, step) => {
      if (step.type === 'infusion' && step.infusionVolumeLiters) {
        return sum + step.infusionVolumeLiters;
      }
      return sum;
    }, 0);

    return Math.round(total * 10) / 10;
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
   * @param recipe - The recipe to generate a mash schedule for
   * @returns Default mash step for single infusion mash
   */
  generateDefaultSingleInfusion(recipe: Recipe): MashStep {
    const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.weightKg, 0);
    const mashThickness = recipe.equipment.mashThicknessLPerKg;
    const infusionVolume = totalGrainKg * mashThickness;
    const targetTemp = 66; // Standard saccharification temp
    const strikeTemp = this.calculateStrikeTemp(targetTemp, mashThickness, 20, totalGrainKg);

    return {
      id: uid(),
      name: 'Saccharification',
      type: 'infusion',
      temperatureC: targetTemp,
      durationMinutes: 60,
      infusionVolumeLiters: Math.round(infusionVolume * 10) / 10,
      infusionTempC: strikeTemp,
    };
  }

  /**
   * Generate a common 3-step mash schedule (Protein Rest, Saccharification, Mash Out)
   *
   * @param recipe - The recipe to generate a mash schedule for
   * @returns Array of 3 mash steps
   */
  generateDefaultMultiStep(recipe: Recipe): MashStep[] {
    const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.weightKg, 0);
    const mashThickness = recipe.equipment.mashThicknessLPerKg;
    const grainTemp = 20;

    // Step 1: Protein Rest (50°C)
    const step1Volume = totalGrainKg * mashThickness;
    const step1Temp = 50;
    const step1StrikeTemp = this.calculateStrikeTemp(step1Temp, mashThickness, grainTemp, totalGrainKg);

    const step1: MashStep = {
      id: uid(),
      name: 'Protein Rest',
      type: 'infusion',
      temperatureC: step1Temp,
      durationMinutes: 15,
      infusionVolumeLiters: Math.round(step1Volume * 10) / 10,
      infusionTempC: step1StrikeTemp,
    };

    // Step 2: Saccharification (66°C) - temperature rest, no infusion
    const step2: MashStep = {
      id: uid(),
      name: 'Saccharification',
      type: 'temperature',
      temperatureC: 66,
      durationMinutes: 45,
    };

    // Step 3: Mash Out (76°C) - temperature rest to halt enzyme activity
    const step3: MashStep = {
      id: uid(),
      name: 'Mash Out',
      type: 'temperature',
      temperatureC: 76,
      durationMinutes: 10,
    };

    return [step1, step2, step3];
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

    if (step.temperatureC < 0 || step.temperatureC > 100) {
      errors.push('Temperature must be between 0°C and 100°C');
    }

    if (step.durationMinutes <= 0) {
      errors.push('Duration must be greater than 0 minutes');
    }

    // Note: infusion volume and temp are optional - they'll be auto-calculated if not provided

    if (step.type === 'decoction') {
      if (!step.decoctionVolumeLiters || step.decoctionVolumeLiters <= 0) {
        errors.push('Decoction volume is required and must be greater than 0');
      }
    }

    return errors;
  }
}

// Export singleton instance
export const mashScheduleService = new MashScheduleService();
