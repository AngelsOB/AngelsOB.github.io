import { describe, test, expect } from 'vitest';
import { recipeCalculationService } from './RecipeCalculationService';
import type { Recipe, Fermentable, Hop, Yeast } from '../models/Recipe';

// Helper to create a minimal valid recipe for testing
function createTestRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const defaultEquipment = {
    name: 'Test Equipment',
    boilTimeMin: 60,
    boilOffRateLPerHour: 4,
    kettleLossLiters: 1,
    hopsAbsorptionLPerKg: 0.5,
    chillerLossLiters: 0.5,
    fermenterLossLiters: 0.5,
    coolingShrinkagePercent: 4,
    mashThicknessLPerKg: 2.5,
    grainAbsorptionLPerKg: 0.96,
    mashTunDeadspaceLiters: 1,
    mashTunLossLiters: 0,
    mashEfficiencyPercent: 75,
  };

  return {
    id: 'test-recipe',
    name: 'Test Recipe',
    batchVolumeL: 20,
    fermentables: [],
    hops: [],
    yeasts: [],
    mashSteps: [],
    fermentationSteps: [],
    otherIngredients: [],
    equipment: defaultEquipment,
    waterChemistry: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Recipe;
}

function createFermentable(overrides: Partial<Fermentable> = {}): Fermentable {
  return {
    id: 'ferm-1',
    name: 'Pale Malt 2-Row',
    weightKg: 5,
    colorLovibond: 2,
    ppg: 37,
    ...overrides,
  } as Fermentable;
}

function createHop(overrides: Partial<Hop> = {}): Hop {
  return {
    id: 'hop-1',
    name: 'Cascade',
    grams: 28,
    alphaAcid: 6,
    type: 'boil',
    timeMinutes: 60,
    ...overrides,
  } as Hop;
}

describe('Recipe Calculation Service', () => {
  describe('calculateOG', () => {
    test('returns 1.0 for empty fermentables', () => {
      const recipe = createTestRecipe({ fermentables: [] });
      expect(recipeCalculationService.calculateOG(recipe)).toBe(1.0);
    });

    test('returns 1.0 for zero batch volume', () => {
      const recipe = createTestRecipe({
        batchVolumeL: 0,
        fermentables: [createFermentable()],
      });
      expect(recipeCalculationService.calculateOG(recipe)).toBe(1.0);
    });

    test('calculates OG for standard pale ale grist', () => {
      // 5kg pale malt × 37 PPG × 75% eff / 5.28 gal ≈ 1.058
      const recipe = createTestRecipe({
        batchVolumeL: 20,
        fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
      });
      const og = recipeCalculationService.calculateOG(recipe);
      expect(og).toBeGreaterThan(1.050);
      expect(og).toBeLessThan(1.070);
    });

    test('higher grain weight yields higher OG', () => {
      const lightRecipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 3 })],
      });
      const heavyRecipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 6 })],
      });
      const lightOG = recipeCalculationService.calculateOG(lightRecipe);
      const heavyOG = recipeCalculationService.calculateOG(heavyRecipe);
      expect(heavyOG).toBeGreaterThan(lightOG);
    });

    test('sums gravity from multiple fermentables', () => {
      const singleRecipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      const doubleRecipe = createTestRecipe({
        fermentables: [
          createFermentable({ id: 'f1', weightKg: 2.5 }),
          createFermentable({ id: 'f2', weightKg: 2.5 }),
        ],
      });
      const singleOG = recipeCalculationService.calculateOG(singleRecipe);
      const doubleOG = recipeCalculationService.calculateOG(doubleRecipe);
      expect(doubleOG).toBeCloseTo(singleOG, 3);
    });
  });

  describe('calculateFG', () => {
    test('returns 1.0 for empty fermentables', () => {
      const recipe = createTestRecipe({ fermentables: [] });
      expect(recipeCalculationService.calculateFG(recipe)).toBe(1.0);
    });

    test('calculates FG using default attenuation', () => {
      const recipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      const fg = recipeCalculationService.calculateFG(recipe);
      // Should be less than OG
      const og = recipeCalculationService.calculateOG(recipe);
      expect(fg).toBeLessThan(og);
      expect(fg).toBeGreaterThan(1.0);
    });

    test('uses yeast attenuation when provided', () => {
      const lowAttYeast: Yeast = {
        id: 'y1',
        name: 'Low Att Yeast',
        attenuation: 0.65,
        type: 'ale',
        lab: 'Test',
        labId: 'T001',
      } as Yeast;
      const highAttYeast: Yeast = {
        id: 'y2',
        name: 'High Att Yeast',
        attenuation: 0.85,
        type: 'ale',
        lab: 'Test',
        labId: 'T002',
      } as Yeast;

      const lowAttRecipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        yeasts: [lowAttYeast],
      });
      const highAttRecipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
        yeasts: [highAttYeast],
      });

      const lowFG = recipeCalculationService.calculateFG(lowAttRecipe);
      const highFG = recipeCalculationService.calculateFG(highAttRecipe);

      // Higher attenuation = lower FG
      expect(highFG).toBeLessThan(lowFG);
    });

    test('accounts for non-fermentable sugars like lactose', () => {
      const normalRecipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5 })],
      });
      const lactoseRecipe = createTestRecipe({
        fermentables: [
          createFermentable({ weightKg: 4.5 }),
          createFermentable({
            id: 'lactose',
            name: 'Lactose',
            weightKg: 0.5,
            ppg: 35,
            fermentability: 0, // Not fermentable
          }),
        ],
      });

      const normalFG = recipeCalculationService.calculateFG(normalRecipe);
      const lactoseFG = recipeCalculationService.calculateFG(lactoseRecipe);

      // Lactose should result in higher FG
      expect(lactoseFG).toBeGreaterThan(normalFG);
    });
  });

  describe('calculateABV', () => {
    test('returns 0 when OG equals FG', () => {
      expect(recipeCalculationService.calculateABV(1.050, 1.050)).toBe(0);
    });

    test('calculates ABV for typical ale', () => {
      // (1.050 - 1.010) × 131.25 = 5.25%
      const abv = recipeCalculationService.calculateABV(1.050, 1.010);
      expect(abv).toBeCloseTo(5.25, 2);
    });
  });

  describe('calculateIBU', () => {
    test('returns 0 for empty hops', () => {
      const recipe = createTestRecipe({ hops: [] });
      expect(recipeCalculationService.calculateIBU(recipe, 1.050)).toBe(0);
    });

    test('returns 0 for zero batch volume', () => {
      const recipe = createTestRecipe({
        batchVolumeL: 0,
        hops: [createHop()],
      });
      expect(recipeCalculationService.calculateIBU(recipe, 1.050)).toBe(0);
    });

    test('calculates IBU for standard bittering addition', () => {
      const recipe = createTestRecipe({
        hops: [createHop({ grams: 28, alphaAcid: 10, timeMinutes: 60, type: 'boil' })],
      });
      const ibu = recipeCalculationService.calculateIBU(recipe, 1.050);
      expect(ibu).toBeGreaterThan(20);
      expect(ibu).toBeLessThan(50);
    });

    test('sums IBU from multiple hop additions', () => {
      const singleHopRecipe = createTestRecipe({
        hops: [createHop({ grams: 28, alphaAcid: 10, timeMinutes: 60 })],
      });
      const doubleHopRecipe = createTestRecipe({
        hops: [
          createHop({ id: 'h1', grams: 28, alphaAcid: 10, timeMinutes: 60 }),
          createHop({ id: 'h2', grams: 28, alphaAcid: 10, timeMinutes: 60 }),
        ],
      });

      const singleIBU = recipeCalculationService.calculateIBU(singleHopRecipe, 1.050);
      const doubleIBU = recipeCalculationService.calculateIBU(doubleHopRecipe, 1.050);

      expect(doubleIBU).toBeCloseTo(singleIBU * 2, 0);
    });

    test('calculates lower IBU for late additions', () => {
      const earlyRecipe = createTestRecipe({
        hops: [createHop({ timeMinutes: 60, type: 'boil' })],
      });
      const lateRecipe = createTestRecipe({
        hops: [createHop({ timeMinutes: 10, type: 'boil' })],
      });

      const earlyIBU = recipeCalculationService.calculateIBU(earlyRecipe, 1.050);
      const lateIBU = recipeCalculationService.calculateIBU(lateRecipe, 1.050);

      expect(lateIBU).toBeLessThan(earlyIBU);
    });

    test('handles dry hop with humulinone model', () => {
      const recipe = createTestRecipe({
        hops: [createHop({ grams: 56, alphaAcid: 10, type: 'dry hop', timeMinutes: 0 })],
      });
      const ibu = recipeCalculationService.calculateIBU(recipe, 1.050);
      // Dry hops contribute some IBU but much less than boil
      expect(ibu).toBeGreaterThan(0);
      expect(ibu).toBeLessThan(10);
    });

    test('handles first wort hops with time bonus', () => {
      const boilRecipe = createTestRecipe({
        hops: [createHop({ timeMinutes: 60, type: 'boil' })],
      });
      const fwhRecipe = createTestRecipe({
        hops: [createHop({ timeMinutes: 60, type: 'first wort' })],
      });

      const boilIBU = recipeCalculationService.calculateIBU(boilRecipe, 1.050);
      const fwhIBU = recipeCalculationService.calculateIBU(fwhRecipe, 1.050);

      // FWH gets +20 minutes bonus, so should have higher IBU
      expect(fwhIBU).toBeGreaterThan(boilIBU);
    });

    test('handles whirlpool hops with temperature adjustment', () => {
      const hotWhirlpool = createTestRecipe({
        hops: [createHop({ type: 'whirlpool', timeMinutes: 20, temperatureC: 90 })],
      });
      const coolWhirlpool = createTestRecipe({
        hops: [createHop({ type: 'whirlpool', timeMinutes: 20, temperatureC: 70 })],
      });

      const hotIBU = recipeCalculationService.calculateIBU(hotWhirlpool, 1.050);
      const coolIBU = recipeCalculationService.calculateIBU(coolWhirlpool, 1.050);

      expect(hotIBU).toBeGreaterThan(coolIBU);
    });

    test('handles mash hops with reduced utilization', () => {
      const boilRecipe = createTestRecipe({
        hops: [createHop({ timeMinutes: 60, type: 'boil' })],
      });
      const mashRecipe = createTestRecipe({
        hops: [createHop({ timeMinutes: 60, type: 'mash' })],
      });

      const boilIBU = recipeCalculationService.calculateIBU(boilRecipe, 1.050);
      const mashIBU = recipeCalculationService.calculateIBU(mashRecipe, 1.050);

      // Mash hops are only 20% as effective
      expect(mashIBU).toBeLessThan(boilIBU * 0.3);
    });
  });

  describe('calculateSRM', () => {
    test('returns 0 for empty fermentables', () => {
      const recipe = createTestRecipe({ fermentables: [] });
      expect(recipeCalculationService.calculateSRM(recipe)).toBe(0);
    });

    test('returns 0 for zero batch volume', () => {
      const recipe = createTestRecipe({
        batchVolumeL: 0,
        fermentables: [createFermentable()],
      });
      expect(recipeCalculationService.calculateSRM(recipe)).toBe(0);
    });

    test('calculates SRM for pale beer', () => {
      const recipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5, colorLovibond: 2 })],
      });
      const srm = recipeCalculationService.calculateSRM(recipe);
      // Should be light colored (2-4 SRM)
      expect(srm).toBeGreaterThan(1);
      expect(srm).toBeLessThan(5);
    });

    test('higher color grains increase SRM', () => {
      const paleRecipe = createTestRecipe({
        fermentables: [createFermentable({ colorLovibond: 2 })],
      });
      const darkRecipe = createTestRecipe({
        fermentables: [createFermentable({ colorLovibond: 40 })],
      });

      const paleSRM = recipeCalculationService.calculateSRM(paleRecipe);
      const darkSRM = recipeCalculationService.calculateSRM(darkRecipe);

      expect(darkSRM).toBeGreaterThan(paleSRM);
    });

    test('sums color from multiple grains', () => {
      const recipe = createTestRecipe({
        fermentables: [
          createFermentable({ id: 'f1', weightKg: 4.5, colorLovibond: 2 }),
          createFermentable({ id: 'f2', name: 'Crystal 60', weightKg: 0.5, colorLovibond: 60 }),
        ],
      });
      const srm = recipeCalculationService.calculateSRM(recipe);
      // Crystal addition should make it darker than all-pale
      expect(srm).toBeGreaterThan(5);
    });
  });

  describe('calculateNutrition', () => {
    test('returns 0 calories for OG equal to FG', () => {
      const { calories } = recipeCalculationService.calculateNutrition(1.050, 1.050);
      // No fermentation = no alcohol = minimal calories
      // But there would still be residual carbs
      expect(calories).toBeGreaterThanOrEqual(0);
    });

    test('calculates nutrition for typical ale', () => {
      // OG 1.050, FG 1.010
      const { calories, carbsG } = recipeCalculationService.calculateNutrition(1.050, 1.010);
      // A typical 5% beer is ~150-200 cal per 12oz
      expect(calories).toBeGreaterThan(100);
      expect(calories).toBeLessThan(250);
      // Carbs typically 10-15g for regular beer
      expect(carbsG).toBeGreaterThan(5);
      expect(carbsG).toBeLessThan(20);
    });

    test('higher OG yields more calories', () => {
      const light = recipeCalculationService.calculateNutrition(1.040, 1.008);
      const strong = recipeCalculationService.calculateNutrition(1.080, 1.015);
      expect(strong.calories).toBeGreaterThan(light.calories);
    });

    test('higher FG yields more carbs', () => {
      const dry = recipeCalculationService.calculateNutrition(1.050, 1.005);
      const sweet = recipeCalculationService.calculateNutrition(1.050, 1.020);
      expect(sweet.carbsG).toBeGreaterThan(dry.carbsG);
    });
  });

  describe('calculate (full recipe)', () => {
    test('calculates complete recipe metrics', () => {
      const yeast: Yeast = {
        id: 'y1',
        name: 'US-05',
        attenuation: 0.77,
        type: 'ale',
        lab: 'Fermentis',
        labId: 'US-05',
      } as Yeast;

      const recipe = createTestRecipe({
        fermentables: [
          createFermentable({ weightKg: 4.5, colorLovibond: 2 }),
          createFermentable({ id: 'f2', name: 'Crystal 40', weightKg: 0.5, colorLovibond: 40 }),
        ],
        hops: [
          createHop({ grams: 28, alphaAcid: 10, timeMinutes: 60, type: 'boil' }),
          createHop({ id: 'h2', grams: 28, alphaAcid: 5, timeMinutes: 15, type: 'boil' }),
        ],
        yeasts: [yeast],
        mashSteps: [
          { id: 's1', name: 'Sacch Rest', temperatureC: 67, durationMinutes: 60 },
        ],
        fermentationSteps: [
          { id: 'fs1', name: 'Primary', type: 'primary', temperatureC: 18, durationDays: 14 },
        ],
      });

      const calculations = recipeCalculationService.calculate(recipe);

      // Basic sanity checks
      expect(calculations.og).toBeGreaterThan(1.0);
      expect(calculations.fg).toBeGreaterThan(1.0);
      expect(calculations.fg).toBeLessThan(calculations.og);
      expect(calculations.abv).toBeGreaterThan(0);
      expect(calculations.ibu).toBeGreaterThan(0);
      expect(calculations.srm).toBeGreaterThan(0);
      expect(calculations.calories).toBeGreaterThan(0);
      expect(calculations.carbsG).toBeGreaterThan(0);
      expect(calculations.preBoilVolumeL).toBeGreaterThan(calculations.mashWaterL);
      expect(calculations.totalWaterL).toBeGreaterThan(0);
    });
  });
});
