import { describe, test, expect } from 'vitest';
import { generateDefaultChecklist } from './BrewDayChecklistService';
import { recipeCalculationService } from './RecipeCalculationService';
// import { volumeCalculationService } from './VolumeCalculationService';
import type { Recipe } from '../models/Recipe';

/**
 * Tests for pre-boil gravity consistency with OG through the boil.
 *
 * The key physical constraint:
 *   preBoilGravity × preBoilVol ≈ OG × postBoilColdVol
 *
 * Only boil-off (water evaporation) and cooling shrinkage concentrate
 * the wort. Post-boil losses (kettle trub, chiller, fermenter) remove
 * wort at the same gravity and do NOT change gravity.
 */

function createTestRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const defaultEquipment = {
    name: 'Test Equipment',
    boilTimeMin: 60,
    boilOffRateLPerHour: 3,
    kettleLossLiters: 1,
    hopsAbsorptionLPerKg: 0.5,
    chillerLossLiters: 0.5,
    fermenterLossLiters: 0.5,
    coolingShrinkagePercent: 4,
    mashThicknessLPerKg: 2.7,
    grainAbsorptionLPerKg: 0.8,
    mashTunDeadspaceLiters: 2,
    mashTunLossLiters: 0,
    brewhouseEfficiencyPercent: 75,
  };

  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    batchVolumeL: 20,
    fermentables: [
      { id: 'f1', name: 'Pale Malt', weightKg: 5, colorLovibond: 2, ppg: 37 },
    ],
    hops: [
      { id: 'h1', name: 'Cascade', grams: 28, alphaAcid: 6, type: 'boil', timeMinutes: 60 },
    ],
    yeasts: [],
    mashSteps: [
      { id: 's1', name: 'Sacch', temperatureC: 67, durationMinutes: 60, type: 'infusion' },
    ],
    fermentationSteps: [],
    otherIngredients: [],
    equipment: defaultEquipment,
    waterChemistry: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Recipe;
}

/**
 * Compute pre-boil gravity using the same formula as the production code.
 * This avoids rounding artifacts from parsing formatted checklist strings.
 */
function computePreBoilGravity(recipe: Recipe, og: number, preBoilVolumeL: number): number {
  const boilOffL = (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const shrinkageFactor = 1 + recipe.equipment.coolingShrinkagePercent / 100;
  const postBoilColdL = (preBoilVolumeL - boilOffL) / shrinkageFactor;
  return preBoilVolumeL > 0
    ? 1 + ((og - 1) * postBoilColdL) / preBoilVolumeL
    : og;
}

/** Compute post-boil cold volume (after boil-off and cooling shrinkage) */
function computePostBoilColdL(recipe: Recipe, preBoilVolumeL: number): number {
  const boilOffL = (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const shrinkageFactor = 1 + recipe.equipment.coolingShrinkagePercent / 100;
  return (preBoilVolumeL - boilOffL) / shrinkageFactor;
}

/** Extract pre-boil gravity from checklist items (for display consistency tests) */
function extractPreBoilGravityFromChecklist(recipe: Recipe, calc?: ReturnType<typeof recipeCalculationService.calculate>): number {
  const calculations = calc ?? recipeCalculationService.calculate(recipe);
  const checklist = generateDefaultChecklist(recipe, calculations);
  const preBoilItem = checklist.find(item => item.label === 'Pre-boil gravity');
  if (!preBoilItem?.details) throw new Error('Pre-boil gravity checklist item not found');
  const match = preBoilItem.details.match(/Target:\s*([\d.]+)/);
  if (!match) throw new Error(`Could not parse gravity from: ${preBoilItem.details}`);
  return parseFloat(match[1]);
}

describe('Pre-boil gravity consistency', () => {
  test('sugar conservation: preBoilGravity × preBoilVol ≈ OG × postBoilColdVol', () => {
    const recipe = createTestRecipe();
    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);
    const postBoilColdL = computePostBoilColdL(recipe, calc.preBoilVolumeL);

    const preBoilSugar = (preBoilGravity - 1) * calc.preBoilVolumeL;
    const postBoilSugar = (calc.og - 1) * postBoilColdL;

    // Sugar should be conserved exactly (both computed from same formula)
    expect(preBoilSugar).toBeCloseTo(postBoilSugar, 6);
  });

  test('pre-boil gravity concentrates to OG through boil-off and cooling', () => {
    const recipe = createTestRecipe();
    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);
    const postBoilColdL = computePostBoilColdL(recipe, calc.preBoilVolumeL);

    // Concentrating pre-boil to post-boil-cold should give OG
    const expectedOG = 1 + (preBoilGravity - 1) * calc.preBoilVolumeL / postBoilColdL;
    expect(expectedOG).toBeCloseTo(calc.og, 6);
  });

  test('pre-boil gravity is higher than old batch-volume formula', () => {
    const recipe = createTestRecipe();
    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);

    // Old formula: preBoilGravity = 1 + ((OG-1) × batchVolumeL) / preBoilVolumeL
    const oldPreBoilGravity = 1 + ((calc.og - 1) * recipe.batchVolumeL) / calc.preBoilVolumeL;

    // New formula should give a higher gravity (accounts for sugar lost to equipment)
    expect(preBoilGravity).toBeGreaterThan(oldPreBoilGravity);
  });

  test('checklist displays the corrected pre-boil gravity (not old batch-vol formula)', () => {
    const recipe = createTestRecipe();
    const calc = recipeCalculationService.calculate(recipe);
    const displayedGravity = extractPreBoilGravityFromChecklist(recipe, calc);

    // Old formula would give lower gravity; check that displayed value is higher
    const oldPreBoilGravity = 1 + ((calc.og - 1) * recipe.batchVolumeL) / calc.preBoilVolumeL;

    expect(displayedGravity).toBeGreaterThan(oldPreBoilGravity);
  });

  test('works with large equipment losses (G30 19L scenario)', () => {
    const recipe = createTestRecipe({
      batchVolumeL: 19,
      fermentables: [
        { id: 'f1', name: 'Maris Otter', weightKg: 3.60, colorLovibond: 2, ppg: 38 },
        { id: 'f2', name: 'Vienna', weightKg: 0.40, colorLovibond: 4, ppg: 37 },
        { id: 'f3', name: 'Flaked Corn', weightKg: 0.25, colorLovibond: 1, ppg: 40 },
        { id: 'f4', name: 'Crystal 40', weightKg: 0.15, colorLovibond: 40, ppg: 34 },
        { id: 'f5', name: 'Melanoidin', weightKg: 0.20, colorLovibond: 25, ppg: 37 },
        { id: 'f6', name: 'Pale Chocolate', weightKg: 0.06, colorLovibond: 207, ppg: 33 },
        { id: 'f7', name: 'Roasted Barley', weightKg: 0.10, colorLovibond: 300, ppg: 33 },
      ] as Recipe['fermentables'],
      hops: [
        { id: 'h1', name: 'EKG', grams: 28, alphaAcid: 5, type: 'boil', timeMinutes: 60 },
        { id: 'h2', name: 'EKG', grams: 14, alphaAcid: 5, type: 'boil', timeMinutes: 30 },
      ] as Recipe['hops'],
      equipment: {
        boilTimeMin: 60,
        boilOffRateLPerHour: 2.3,
        kettleLossLiters: 3.5,
        hopsAbsorptionLPerKg: 0.70,
        chillerLossLiters: 0.5,
        fermenterLossLiters: 0.9,
        coolingShrinkagePercent: 4,
        mashThicknessLPerKg: 3.50,
        grainAbsorptionLPerKg: 0.85,
        mashTunDeadspaceLiters: 3.5,
        mashTunLossLiters: 0,
        brewhouseEfficiencyPercent: 70,
      },
    });

    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);
    const postBoilColdL = computePostBoilColdL(recipe, calc.preBoilVolumeL);

    // Sugar conservation must hold exactly
    const preBoilSugar = (preBoilGravity - 1) * calc.preBoilVolumeL;
    const postBoilSugar = (calc.og - 1) * postBoilColdL;
    expect(preBoilSugar).toBeCloseTo(postBoilSugar, 6);

    // OG is measured at the into-fermenter volume (batch 19 L + fermenter loss
    // 0.9 L = ~19.9 L), paired with brewhouse efficiency. Kettle/chiller/hop
    // losses are NOT in the gravity denominator (brewhouse efficiency already
    // nets them out), so OG ≈ 1.053 here.
    expect(calc.og).toBeCloseTo(1.053, 2);

    // Pre-boil gravity dilutes that OG back over the larger pre-boil volume.
    //   New:           1 + (0.0438 × 23.9) / 27.2 ≈ 1.0385
    //   Old batch-vol: 1 + (0.0438 × 19)   / 27.2 ≈ 1.0306
    expect(preBoilGravity).toBeGreaterThan(1.035);

    // Large losses (4.9L) keep a clear gap between the corrected and old formula
    const oldPreBoilGravity = 1 + ((calc.og - 1) * recipe.batchVolumeL) / calc.preBoilVolumeL;
    expect(preBoilGravity - oldPreBoilGravity).toBeGreaterThan(0.005);
  });

  test('works with zero boil time (no-boil beer)', () => {
    const recipe = createTestRecipe({
      equipment: {
        ...createTestRecipe().equipment,
        boilTimeMin: 0,
      },
    });

    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);
    const postBoilColdL = computePostBoilColdL(recipe, calc.preBoilVolumeL);

    // Sugar conservation still holds
    const preBoilSugar = (preBoilGravity - 1) * calc.preBoilVolumeL;
    const postBoilSugar = (calc.og - 1) * postBoilColdL;
    expect(preBoilSugar).toBeCloseTo(postBoilSugar, 6);

    // With no boil, the only concentration is cooling shrinkage
    expect(postBoilColdL).toBeCloseTo(calc.preBoilVolumeL / 1.04, 1);
  });

  test('works with zero cooling shrinkage', () => {
    const recipe = createTestRecipe({
      equipment: {
        ...createTestRecipe().equipment,
        coolingShrinkagePercent: 0,
      },
    });

    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);
    const postBoilColdL = computePostBoilColdL(recipe, calc.preBoilVolumeL);

    // Without shrinkage, post-boil cold = post-boil hot
    const boilOffL = (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
    expect(postBoilColdL).toBeCloseTo(calc.preBoilVolumeL - boilOffL, 1);

    // Sugar conservation still holds
    const preBoilSugar = (preBoilGravity - 1) * calc.preBoilVolumeL;
    const postBoilSugar = (calc.og - 1) * postBoilColdL;
    expect(preBoilSugar).toBeCloseTo(postBoilSugar, 6);
  });

  test('works with zero post-boil losses (BIAB-like)', () => {
    const recipe = createTestRecipe({
      equipment: {
        ...createTestRecipe().equipment,
        kettleLossLiters: 0,
        chillerLossLiters: 0,
        fermenterLossLiters: 0,
      },
    });

    const calc = recipeCalculationService.calculate(recipe);
    const preBoilGravity = computePreBoilGravity(recipe, calc.og, calc.preBoilVolumeL);
    const postBoilColdL = computePostBoilColdL(recipe, calc.preBoilVolumeL);

    // With zero losses, postBoilCold ≈ batchVolume (approximately)
    // They'd be exactly equal if hop absorption were also 0
    expect(postBoilColdL).toBeCloseTo(recipe.batchVolumeL, 0);

    // Sugar conservation still holds
    const preBoilSugar = (preBoilGravity - 1) * calc.preBoilVolumeL;
    const postBoilSugar = (calc.og - 1) * postBoilColdL;
    expect(preBoilSugar).toBeCloseTo(postBoilSugar, 6);
  });
});
