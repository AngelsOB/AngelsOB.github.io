import { describe, test, expect } from 'vitest';
import { brewSessionCalculationService } from './BrewSessionCalculationService';
import type { Recipe } from '../models/Recipe';
import type { SessionActuals } from '../models/BrewSession';

/**
 * Create a minimal recipe with fermentables for testing.
 * Uses typical values for a 5-gallon (19L) batch of pale ale.
 */
function createTestRecipe(
  fermentables: Array<{ weightKg: number; ppg: number }> = [
    { weightKg: 4.5, ppg: 37 }, // ~10 lbs 2-row
  ],
  batchVolumeL: number = 19
): Recipe {
  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    batchVolumeL,
    currentVersion: 1,
    fermentables: fermentables.map((f, i) => ({
      id: `ferm-${i}`,
      name: 'Test Grain',
      weightKg: f.weightKg,
      ppg: f.ppg,
      colorLovibond: 2,
      efficiencyPercent: 80,
    })),
    hops: [],
    yeasts: [],
    otherIngredients: [],
    mashSteps: [],
    fermentationSteps: [],
    equipment: {
      boilTimeMin: 60,
      boilOffRateLPerHour: 4,
      mashEfficiencyPercent: 75,
      mashThicknessLPerKg: 3.0,
      grainAbsorptionLPerKg: 1.04,
      mashTunDeadspaceLiters: 2.0,
      mashTunLossLiters: 0,
      kettleLossLiters: 1.0,
      hopsAbsorptionLPerKg: 0.7,
      chillerLossLiters: 0.5,
      fermenterLossLiters: 0.5,
      coolingShrinkagePercent: 4.0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('BrewSessionCalculationService', () => {
  describe('calculateABV', () => {
    test('calculates ABV for typical beer', () => {
      // OG 1.050, FG 1.010 → ABV ≈ 5.25%
      const abv = brewSessionCalculationService.calculateABV(1.05, 1.01);
      expect(abv).toBeCloseTo(5.25, 1);
    });

    test('calculates ABV for high gravity beer', () => {
      // OG 1.080, FG 1.015 → ABV ≈ 8.5%
      const abv = brewSessionCalculationService.calculateABV(1.08, 1.015);
      expect(abv).toBeCloseTo(8.53, 1);
    });

    test('calculates ABV for session beer', () => {
      // OG 1.040, FG 1.008 → ABV ≈ 4.2%
      const abv = brewSessionCalculationService.calculateABV(1.04, 1.008);
      expect(abv).toBeCloseTo(4.2, 1);
    });

    test('returns 0 when OG equals FG', () => {
      const abv = brewSessionCalculationService.calculateABV(1.05, 1.05);
      expect(abv).toBe(0);
    });

    test('returns negative when FG > OG (indicates measurement error)', () => {
      const abv = brewSessionCalculationService.calculateABV(1.05, 1.06);
      expect(abv).toBeLessThan(0);
    });
  });

  describe('calculateApparentAttenuation', () => {
    test('calculates typical attenuation', () => {
      // OG 1.050, FG 1.010 → AA ≈ 80%
      const aa = brewSessionCalculationService.calculateApparentAttenuation(
        1.05,
        1.01
      );
      expect(aa).toBeCloseTo(80, 0);
    });

    test('calculates high attenuation', () => {
      // OG 1.050, FG 1.005 → AA ≈ 90%
      const aa = brewSessionCalculationService.calculateApparentAttenuation(
        1.05,
        1.005
      );
      expect(aa).toBeCloseTo(90, 0);
    });

    test('calculates low attenuation', () => {
      // OG 1.060, FG 1.020 → AA ≈ 66.7%
      const aa = brewSessionCalculationService.calculateApparentAttenuation(
        1.06,
        1.02
      );
      expect(aa).toBeCloseTo(66.7, 0);
    });

    test('returns undefined when OG is 1.000', () => {
      const aa = brewSessionCalculationService.calculateApparentAttenuation(
        1.0,
        1.0
      );
      expect(aa).toBeUndefined();
    });

    test('returns undefined when OG is less than 1.000', () => {
      const aa = brewSessionCalculationService.calculateApparentAttenuation(
        0.998,
        0.998
      );
      expect(aa).toBeUndefined();
    });
  });

  describe('calculateMashEfficiency', () => {
    test('calculates typical mash efficiency', () => {
      const recipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }]);
      // 4.5 kg = 9.92 lbs × 37 ppg = 367 potential points
      // Pre-boil: 1.040 at 25L → 40 points/gal × 6.6 gal = 264 actual points
      // Efficiency = 264 / 367 ≈ 72%
      const efficiency = brewSessionCalculationService.calculateMashEfficiency(
        recipe,
        1.04,
        25
      );
      expect(efficiency).toBeGreaterThan(65);
      expect(efficiency).toBeLessThan(80);
    });

    test('calculates high mash efficiency', () => {
      const recipe = createTestRecipe([{ weightKg: 4.0, ppg: 37 }]);
      // Higher gravity at same volume = higher efficiency
      const efficiency = brewSessionCalculationService.calculateMashEfficiency(
        recipe,
        1.05,
        25
      );
      expect(efficiency).toBeGreaterThan(80);
    });

    test('calculates low mash efficiency', () => {
      const recipe = createTestRecipe([{ weightKg: 5.0, ppg: 37 }]);
      // Lower gravity relative to grain = lower efficiency
      const efficiency = brewSessionCalculationService.calculateMashEfficiency(
        recipe,
        1.03,
        20
      );
      expect(efficiency).toBeLessThan(60);
    });

    test('returns undefined for recipe with no fermentables', () => {
      const recipe = createTestRecipe([]);
      const efficiency = brewSessionCalculationService.calculateMashEfficiency(
        recipe,
        1.04,
        25
      );
      expect(efficiency).toBeUndefined();
    });

    test('handles multiple fermentables', () => {
      const recipe = createTestRecipe([
        { weightKg: 4.0, ppg: 37 }, // 2-row
        { weightKg: 0.5, ppg: 33 }, // Crystal
      ]);
      const efficiency = brewSessionCalculationService.calculateMashEfficiency(
        recipe,
        1.04,
        25
      );
      expect(efficiency).toBeDefined();
      expect(efficiency).toBeGreaterThan(0);
    });
  });

  describe('calculateBrewhouseEfficiency', () => {
    test('calculates typical brewhouse efficiency', () => {
      const recipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }], 19);
      // Into fermenter at OG 1.050, 19L
      const efficiency =
        brewSessionCalculationService.calculateBrewhouseEfficiency(
          recipe,
          1.05,
          19
        );
      expect(efficiency).toBeGreaterThan(60);
      expect(efficiency).toBeLessThan(80);
    });

    test('brewhouse efficiency is lower than mash efficiency', () => {
      const recipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }]);
      // Same recipe, same gravity, but less volume at end
      const mashEff = brewSessionCalculationService.calculateMashEfficiency(
        recipe,
        1.05,
        25
      );
      const brewhouseEff =
        brewSessionCalculationService.calculateBrewhouseEfficiency(
          recipe,
          1.05,
          19
        );
      // Brewhouse should be lower due to losses during boil
      expect(brewhouseEff).toBeLessThan(mashEff!);
    });

    test('returns undefined for recipe with no fermentables', () => {
      const recipe = createTestRecipe([]);
      const efficiency =
        brewSessionCalculationService.calculateBrewhouseEfficiency(
          recipe,
          1.05,
          19
        );
      expect(efficiency).toBeUndefined();
    });
  });

  describe('calculateSessionMetrics', () => {
    test('calculates all metrics when all actuals provided', () => {
      const recipe = createTestRecipe();
      const actuals: SessionActuals = {
        originalGravity: 1.05,
        finalGravity: 1.01,
        preBoilGravity: 1.04,
        preBoilVolumeL: 25,
        intoFermenterL: 19,
      };

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals
      );

      expect(metrics.actualABV).toBeCloseTo(5.25, 1);
      expect(metrics.apparentAttenuation).toBeCloseTo(80, 0);
      expect(metrics.mashEfficiency).toBeDefined();
      expect(metrics.brewhouseEfficiency).toBeDefined();
    });

    test('calculates only ABV when only OG/FG provided', () => {
      const recipe = createTestRecipe();
      const actuals: SessionActuals = {
        originalGravity: 1.05,
        finalGravity: 1.01,
      };

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals
      );

      expect(metrics.actualABV).toBeCloseTo(5.25, 1);
      expect(metrics.apparentAttenuation).toBeCloseTo(80, 0);
      expect(metrics.mashEfficiency).toBeUndefined();
      // Brewhouse efficiency needs volume, falls back to recipe batch volume
      expect(metrics.brewhouseEfficiency).toBeDefined();
    });

    test('returns empty metrics when no actuals provided', () => {
      const recipe = createTestRecipe();
      const actuals: SessionActuals = {};

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals
      );

      expect(metrics.actualABV).toBeUndefined();
      expect(metrics.apparentAttenuation).toBeUndefined();
      expect(metrics.mashEfficiency).toBeUndefined();
      expect(metrics.brewhouseEfficiency).toBeUndefined();
    });

    test('uses intoFermenterL for brewhouse efficiency when available', () => {
      const recipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }], 19);
      const actuals1: SessionActuals = {
        originalGravity: 1.05,
        intoFermenterL: 17, // Lower volume
      };
      const actuals2: SessionActuals = {
        originalGravity: 1.05,
        intoFermenterL: 20, // Higher volume
      };

      const metrics1 = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals1
      );
      const metrics2 = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals2
      );

      // Same OG but more volume = higher efficiency
      expect(metrics2.brewhouseEfficiency).toBeGreaterThan(
        metrics1.brewhouseEfficiency!
      );
    });

    test('falls back to postBoilVolumeL when intoFermenterL not provided', () => {
      const recipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }], 19);
      const actuals: SessionActuals = {
        originalGravity: 1.05,
        postBoilVolumeL: 20,
      };

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals
      );

      expect(metrics.brewhouseEfficiency).toBeDefined();
    });

    test('falls back to recipe batchVolumeL when no volume actuals provided', () => {
      const recipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }], 19);
      const actuals: SessionActuals = {
        originalGravity: 1.05,
      };

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals
      );

      expect(metrics.brewhouseEfficiency).toBeDefined();
    });

    test('handles partial OG/FG (only OG provided)', () => {
      const recipe = createTestRecipe();
      const actuals: SessionActuals = {
        originalGravity: 1.05,
        // No FG yet (still fermenting)
      };

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        recipe,
        recipe,
        actuals
      );

      expect(metrics.actualABV).toBeUndefined();
      expect(metrics.apparentAttenuation).toBeUndefined();
      // But brewhouse efficiency should still work
      expect(metrics.brewhouseEfficiency).toBeDefined();
    });

    test('uses brew day recipe for calculations, not original', () => {
      const originalRecipe = createTestRecipe([{ weightKg: 4.5, ppg: 37 }]);
      const brewDayRecipe = createTestRecipe([{ weightKg: 5.0, ppg: 37 }]); // Added more grain
      const actuals: SessionActuals = {
        originalGravity: 1.055,
        preBoilGravity: 1.045,
        preBoilVolumeL: 25,
        intoFermenterL: 19,
      };

      const metrics = brewSessionCalculationService.calculateSessionMetrics(
        originalRecipe,
        brewDayRecipe,
        actuals
      );

      // Efficiency should be calculated against brew day recipe's grain bill
      expect(metrics.mashEfficiency).toBeDefined();
      expect(metrics.brewhouseEfficiency).toBeDefined();
    });
  });
});
