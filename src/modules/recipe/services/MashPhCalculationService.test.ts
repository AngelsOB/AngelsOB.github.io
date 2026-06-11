import { describe, test, expect } from 'vitest';
import {
  classifyGrainForPh,
  getGrainDiPh,
  calculateResidualAlkalinity,
  mashPhCalculationService,
  DEFAULT_TARGET_PH,
  MASH_PH_RANGE,
} from './MashPhCalculationService';
import type { Fermentable, Recipe } from '../models/Recipe';

// Test helper to create minimal fermentable for pH calculations
function createTestFermentable(
  overrides: Partial<Fermentable> & { name: string; weightKg: number; colorLovibond: number }
): Fermentable {
  return {
    id: overrides.name,
    ppg: 36,
    efficiencyPercent: 75,
    ...overrides,
  };
}

describe('Mash pH Calculation Service', () => {
  describe('classifyGrainForPh', () => {
    test('classifies acidulated malt', () => {
      expect(classifyGrainForPh('Acidulated Malt', 3)).toBe('acidulated');
      expect(classifyGrainForPh('Acid Malt', 3)).toBe('acidulated');
      expect(classifyGrainForPh('Sauermalz', 3)).toBe('acidulated');
    });

    test('classifies roasted malts', () => {
      expect(classifyGrainForPh('Roasted Barley', 300)).toBe('roasted');
      expect(classifyGrainForPh('Black Malt', 500)).toBe('roasted');
      expect(classifyGrainForPh('Chocolate Malt', 350)).toBe('roasted');
      expect(classifyGrainForPh('Carafa II', 450)).toBe('roasted');
      expect(classifyGrainForPh('Black Patent', 500)).toBe('roasted');
    });

    test('classifies by color >= 300L as roasted', () => {
      expect(classifyGrainForPh('Unknown Dark Grain', 350)).toBe('roasted');
    });

    test('classifies crystal malts', () => {
      expect(classifyGrainForPh('Crystal 60', 60)).toBe('crystal');
      expect(classifyGrainForPh('Caramel 40', 40)).toBe('crystal');
      expect(classifyGrainForPh('CaraMunich', 60)).toBe('crystal');
      expect(classifyGrainForPh('CaraPils', 2)).toBe('crystal');
      expect(classifyGrainForPh('Caravienne', 20)).toBe('crystal');
      expect(classifyGrainForPh('Special B', 120)).toBe('crystal');
    });

    test('classifies wheat malts', () => {
      expect(classifyGrainForPh('Wheat Malt', 2)).toBe('wheat');
      expect(classifyGrainForPh('White Wheat', 2)).toBe('wheat');
      expect(classifyGrainForPh('Red Wheat', 3)).toBe('wheat');
      expect(classifyGrainForPh('Weizen Malt', 2)).toBe('wheat');
    });

    test('classifies munich/kilned specialty malts', () => {
      expect(classifyGrainForPh('Munich Malt', 10)).toBe('munich');
      expect(classifyGrainForPh('Vienna Malt', 4)).toBe('munich');
      expect(classifyGrainForPh('Biscuit Malt', 25)).toBe('munich');
      expect(classifyGrainForPh('Melanoidin Malt', 30)).toBe('munich');
      expect(classifyGrainForPh('Aromatic Malt', 20)).toBe('munich');
      expect(classifyGrainForPh('Amber Malt', 35)).toBe('munich');
      expect(classifyGrainForPh('Victory Malt', 28)).toBe('munich');
      expect(classifyGrainForPh('Honey Malt', 25)).toBe('munich');
    });

    test('classifies adjuncts', () => {
      expect(classifyGrainForPh('Flaked Oats', 2)).toBe('adjunct');
      expect(classifyGrainForPh('Flaked Barley', 2)).toBe('adjunct');
      expect(classifyGrainForPh('Rice Hulls', 0)).toBe('adjunct');
      expect(classifyGrainForPh('Corn (Maize)', 1)).toBe('adjunct');
    });

    test('classifies torrified wheat as wheat (not adjunct)', () => {
      // Wheat check comes before torrified, so this is wheat category
      expect(classifyGrainForPh('Torrified Wheat', 2)).toBe('wheat');
    });

    test('classifies extracts and sugars as adjunct when type specified', () => {
      expect(classifyGrainForPh('Light DME', 5, 'extract')).toBe('adjunct');
      expect(classifyGrainForPh('Corn Sugar', 0, 'sugar')).toBe('adjunct');
    });

    test('classifies pale base malts', () => {
      expect(classifyGrainForPh('Pale Malt 2-Row', 2)).toBe('base');
      expect(classifyGrainForPh('Maris Otter', 3)).toBe('base');
      expect(classifyGrainForPh('Pilsner Malt', 2)).toBe('base');
    });

    test('uses color fallback for unknown grains > 10L', () => {
      expect(classifyGrainForPh('Unknown Specialty', 25)).toBe('munich');
      expect(classifyGrainForPh('Unknown Light', 5)).toBe('base');
    });
  });

  describe('getGrainDiPh', () => {
    test('returns midpoint for base malt', () => {
      // Base range: 5.65-5.72, midpoint = 5.685
      const ph = getGrainDiPh('base', 2);
      expect(ph).toBeCloseTo(5.685, 2);
    });

    test('returns midpoint for wheat', () => {
      // Wheat range: 5.95-6.05, midpoint = 6.0
      const ph = getGrainDiPh('wheat', 2);
      expect(ph).toBeCloseTo(6.0, 2);
    });

    test('interpolates munich by color', () => {
      // 4L → 5.55, 200L+ → 4.70
      expect(getGrainDiPh('munich', 4)).toBeCloseTo(5.55, 2);
      expect(getGrainDiPh('munich', 200)).toBeCloseTo(4.70, 2);
      // Midpoint at ~102L should be ~5.125
      const mid = getGrainDiPh('munich', 102);
      expect(mid).toBeGreaterThan(4.70);
      expect(mid).toBeLessThan(5.55);
    });

    test('interpolates crystal by color', () => {
      // 10L → 5.20, 120L+ → 4.50
      expect(getGrainDiPh('crystal', 10)).toBeCloseTo(5.20, 2);
      expect(getGrainDiPh('crystal', 120)).toBeCloseTo(4.50, 2);
    });

    test('interpolates roasted by color', () => {
      // 300L → 4.60, 500L+ → 4.45
      expect(getGrainDiPh('roasted', 300)).toBeCloseTo(4.60, 2);
      expect(getGrainDiPh('roasted', 500)).toBeCloseTo(4.45, 2);
    });

    test('returns midpoint for acidulated', () => {
      // Acidulated: 3.35-3.45, midpoint = 3.4
      const ph = getGrainDiPh('acidulated', 3);
      expect(ph).toBeCloseTo(3.4, 2);
    });

    test('returns midpoint for adjunct', () => {
      // Adjunct: 5.70-5.80, midpoint = 5.75
      const ph = getGrainDiPh('adjunct', 2);
      expect(ph).toBeCloseTo(5.75, 2);
    });
  });

  describe('calculateResidualAlkalinity', () => {
    test('returns 0 for distilled water', () => {
      const profile = { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 };
      expect(calculateResidualAlkalinity(profile)).toBe(0);
    });

    test('returns positive RA for high alkalinity water', () => {
      // High bicarbonate, low calcium
      const profile = { Ca: 10, Mg: 5, Na: 20, Cl: 30, SO4: 20, HCO3: 200 };
      const ra = calculateResidualAlkalinity(profile);
      expect(ra).toBeGreaterThan(0);
    });

    test('returns negative RA for high calcium water', () => {
      // High calcium, low bicarbonate (like Burton)
      const profile = { Ca: 275, Mg: 40, Na: 25, Cl: 25, SO4: 450, HCO3: 75 };
      const ra = calculateResidualAlkalinity(profile);
      expect(ra).toBeLessThan(0);
    });

    test('calculates RA correctly for typical water', () => {
      // Example: HCO3 = 100, Ca = 50, Mg = 10
      // Alkalinity = 100 * 50/61.016 ≈ 81.95
      // RA = 81.95 - 50/2.5 - 10/3.33 = 81.95 - 20 - 3 ≈ 59
      const profile = { Ca: 50, Mg: 10, Na: 20, Cl: 40, SO4: 30, HCO3: 100 };
      const ra = calculateResidualAlkalinity(profile);
      expect(ra).toBeGreaterThan(50);
      expect(ra).toBeLessThan(70);
    });
  });

  describe('mashPhCalculationService', () => {
    const createBasicRecipe = (fermentables: Array<{ name: string; weightKg: number; colorLovibond: number }>): Recipe => ({
      id: 'test',
      name: 'Test Recipe',
      currentVersion: 1,
      batchVolumeL: 20,
      fermentables: fermentables.map(f => createTestFermentable(f)),
      hops: [],
      yeasts: [],
      mashSteps: [],
      fermentationSteps: [],
      otherIngredients: [],
      equipment: {
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
      },
      waterChemistry: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    describe('calculateGrainOnlyPh', () => {
      test('returns ~5.7 for 100% pale base malt', () => {
        const fermentables = [createTestFermentable({ name: 'Pale Malt 2-Row', weightKg: 5, colorLovibond: 2 })];
        const ph = mashPhCalculationService.calculateGrainOnlyPh(fermentables);
        expect(ph).toBeCloseTo(5.685, 1);
      });

      test('returns lower pH with crystal malt addition', () => {
        const baseOnly = [createTestFermentable({ name: 'Pale Malt', weightKg: 5, colorLovibond: 2 })];
        const withCrystal = [
          createTestFermentable({ name: 'Pale Malt', weightKg: 4.5, colorLovibond: 2 }),
          createTestFermentable({ name: 'Crystal 60', weightKg: 0.5, colorLovibond: 60 }),
        ];
        const phBase = mashPhCalculationService.calculateGrainOnlyPh(baseOnly);
        const phMixed = mashPhCalculationService.calculateGrainOnlyPh(withCrystal);
        expect(phMixed).toBeLessThan(phBase!);
      });

      test('returns much lower pH with roasted malt', () => {
        const withRoasted = [
          createTestFermentable({ name: 'Pale Malt', weightKg: 4.5, colorLovibond: 2 }),
          createTestFermentable({ name: 'Chocolate Malt', weightKg: 0.5, colorLovibond: 400 }),
        ];
        const baseOnly = [createTestFermentable({ name: 'Pale Malt', weightKg: 5, colorLovibond: 2 })];
        const phRoasted = mashPhCalculationService.calculateGrainOnlyPh(withRoasted);
        const phBase = mashPhCalculationService.calculateGrainOnlyPh(baseOnly);
        // Roasted malt lowers pH
        expect(phRoasted).toBeLessThan(phBase!);
        expect(phRoasted).toBeLessThan(5.6);
      });

      test('returns null for empty fermentables', () => {
        const ph = mashPhCalculationService.calculateGrainOnlyPh([]);
        expect(ph).toBeNull();
      });

      test('returns higher pH for wheat-heavy grist', () => {
        const wheatBeer = [
          createTestFermentable({ name: 'Pilsner', weightKg: 2.5, colorLovibond: 2 }),
          createTestFermentable({ name: 'Wheat Malt', weightKg: 2.5, colorLovibond: 2 }),
        ];
        const allPale = [createTestFermentable({ name: 'Pilsner', weightKg: 5, colorLovibond: 2 })];
        const phWheat = mashPhCalculationService.calculateGrainOnlyPh(wheatBeer);
        const phPale = mashPhCalculationService.calculateGrainOnlyPh(allPale);
        expect(phWheat).toBeGreaterThan(phPale!);
      });
    });

    describe('calculatePhAdjustment', () => {
      test('returns null when pH is within tolerance', () => {
        const adj = mashPhCalculationService.calculatePhAdjustment(5.41, 5.4, 5);
        expect(adj).toBeNull();
      });

      test('recommends lactic acid when pH too high', () => {
        const adj = mashPhCalculationService.calculatePhAdjustment(5.6, 5.4, 5);
        expect(adj).not.toBeNull();
        expect(adj!.lacticAcid88Ml).toBeGreaterThan(0);
        expect(adj!.bakingSodaG).toBe(0);
      });

      test('recommends baking soda when pH too low', () => {
        const adj = mashPhCalculationService.calculatePhAdjustment(5.1, 5.4, 5);
        expect(adj).not.toBeNull();
        expect(adj!.bakingSodaG).toBeGreaterThan(0);
        expect(adj!.lacticAcid88Ml).toBe(0);
      });

      test('scales adjustment with grain weight', () => {
        const lightGrist = mashPhCalculationService.calculatePhAdjustment(5.7, 5.4, 3);
        const heavyGrist = mashPhCalculationService.calculatePhAdjustment(5.7, 5.4, 6);
        expect(heavyGrist!.lacticAcid88Ml).toBeGreaterThan(lightGrist!.lacticAcid88Ml);
      });

      test('scales adjustment with pH difference', () => {
        const smallDelta = mashPhCalculationService.calculatePhAdjustment(5.5, 5.4, 5);
        const largeDelta = mashPhCalculationService.calculatePhAdjustment(5.8, 5.4, 5);
        expect(largeDelta!.lacticAcid88Ml).toBeGreaterThan(smallDelta!.lacticAcid88Ml);
      });
    });

    describe('calculateMashPh', () => {
      test('returns reasonable pH for all-pale grist with distilled water', () => {
        const recipe = createBasicRecipe([
          { name: 'Pale Malt 2-Row', weightKg: 5, colorLovibond: 2 },
        ]);
        const ph = mashPhCalculationService.calculateMashPh(recipe, 12.5);
        expect(ph).toBeGreaterThan(5.5);
        expect(ph).toBeLessThan(6.0);
      });

      test('returns null when no mashable fermentables', () => {
        const recipe = createBasicRecipe([]);
        const ph = mashPhCalculationService.calculateMashPh(recipe, 12.5);
        expect(ph).toBeNull();
      });
    });
  });

  describe('Constants', () => {
    test('DEFAULT_TARGET_PH is 5.4', () => {
      expect(DEFAULT_TARGET_PH).toBe(5.4);
    });

    test('MASH_PH_RANGE is 5.2-5.6', () => {
      expect(MASH_PH_RANGE.min).toBe(5.2);
      expect(MASH_PH_RANGE.max).toBe(5.6);
    });
  });
});
