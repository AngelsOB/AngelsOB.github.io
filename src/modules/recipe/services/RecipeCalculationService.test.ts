import { describe, test, expect } from 'vitest';
import { recipeCalculationService } from './RecipeCalculationService';
import { fermentableCalculationService } from './FermentableCalculationService';
import { volumeCalculationService } from './VolumeCalculationService';
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
    brewhouseEfficiencyPercent: 75,
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
      // 5kg pale malt × 37 PPG × 75% eff / post-boil volume ≈ 1.053
      const recipe = createTestRecipe({
        batchVolumeL: 20,
        fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
      });
      const og = recipeCalculationService.calculateOG(recipe);
      expect(og).toBeGreaterThan(1.050);
      expect(og).toBeLessThan(1.070);
    });

    test('OG references the into-fermenter volume — kettle loss has no effect, fermenter loss dilutes', () => {
      // Brewhouse efficiency already nets out kettle/chiller/hop losses, so adding
      // more of THEM must not change OG. Only fermenter loss (which enlarges the
      // into-fermenter volume in the finished-volume model) dilutes OG.
      const make = (kettleLossLiters: number, fermenterLossLiters: number) =>
        createTestRecipe({
          batchVolumeL: 20,
          fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
          equipment: { ...createTestRecipe().equipment, kettleLossLiters, fermenterLossLiters },
        });
      const base = make(0, 0.5);
      // More kettle loss: OG unchanged (it's not in the gravity denominator).
      expect(recipeCalculationService.calculateOG(make(4, 0.5))).toBeCloseTo(
        recipeCalculationService.calculateOG(base), 6
      );
      // More fermenter loss: bigger into-fermenter volume => lower OG.
      expect(recipeCalculationService.calculateOG(make(0, 4))).toBeLessThan(
        recipeCalculationService.calculateOG(base)
      );
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

    test('Irish Red Ale reconstruction matches Brewfather OG (1.050)', () => {
      // TheApartmentBrewer "Irish Red Ale (2023)": Brewfather reports OG 1.050 at
      // 78% brewhouse efficiency. ppg = BeerXML YIELD% × 0.46214. batchVolumeL is
      // the finished volume; ~0.87 L fermenter loss puts into-fermenter at 20.82 L.
      const recipe = createTestRecipe({
        batchVolumeL: 19.95,
        equipment: {
          ...createTestRecipe().equipment,
          brewhouseEfficiencyPercent: 78,
          kettleLossLiters: 0,
          chillerLossLiters: 0,
          fermenterLossLiters: 0.87,
        },
        fermentables: [
          createFermentable({ id: 'mild', name: 'Briess Mild', weightKg: 3.6344, ppg: 36.17 }),
          createFermentable({ id: 'maize', name: 'Flaked Maize', weightKg: 0.4532, ppg: 34.16 }),
          createFermentable({ id: 'crystal', name: 'Crystal Medium', weightKg: 0.341, ppg: 32.15 }),
          createFermentable({ id: 'roast', name: 'Roasted Barley', weightKg: 0.0583, ppg: 34.16 }),
        ],
        hops: [
          createHop({ id: 'h1', name: 'EKG', grams: 28.35, alphaAcid: 4.8, type: 'boil', timeMinutes: 60 }),
          createHop({ id: 'h2', name: 'EKG', grams: 14.17, alphaAcid: 4.8, type: 'boil', timeMinutes: 30 }),
        ],
      });
      const calc = recipeCalculationService.calculate(recipe);
      expect(calc.og).toBeCloseTo(1.05, 2);
      // IBU references post-boil volume + a +10% pellet factor → ~23.9, matching
      // Brewfather's 23 within Tinseth's inherent accuracy (band guards the model).
      expect(calc.ibu).toBeGreaterThan(22);
      expect(calc.ibu).toBeLessThan(25);
    });

    test('missing brewhouseEfficiencyPercent defaults to 75% — no NaN cascade', () => {
      // Regression guard: a legacy/malformed recipe whose equipment lacks the
      // efficiency field must still produce a finite OG (not NaN, which used to
      // cascade through IBU/ABV and crash the UI).
      const recipe = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
      });
      delete (recipe.equipment as Record<string, unknown>).brewhouseEfficiencyPercent;
      const og = recipeCalculationService.calculateOG(recipe);
      expect(Number.isFinite(og)).toBe(true);
      // Equals an explicit 75% recipe.
      const explicit = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
        equipment: { ...createTestRecipe().equipment, brewhouseEfficiencyPercent: 75 },
      });
      expect(og).toBeCloseTo(recipeCalculationService.calculateOG(explicit), 6);
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

    const lager = { id: 'y1', name: 'WLP860', attenuation: 0.72, type: 'lager', lab: 'WL', labId: 'WLP860' } as Yeast;
    const singleInfusion = (T: number, yeast: Yeast = lager) =>
      createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
        yeasts: [yeast],
        mashSteps: [{ id: 's1', name: 'sacch', temperatureC: T, durationMinutes: 60 }] as Recipe['mashSteps'],
      });

    test('linear: lower saccharification rest ferments further (lower FG)', () => {
      const low = recipeCalculationService.calculateFG(singleInfusion(63), { attenuationModel: 'linear' });
      const high = recipeCalculationService.calculateFG(singleInfusion(70), { attenuationModel: 'linear' });
      expect(low).toBeLessThan(high);
    });

    test('linear formula: Grainfather 0.0225/°C off the 67.5°C neutral point', () => {
      const eff = (T: number) => recipeCalculationService.getEffectiveAttenuation(singleInfusion(T), 'linear');
      expect(eff(67.5)).toBeCloseTo(0.72, 4);
      expect(eff(63)).toBeCloseTo(0.72 - 0.0225 * (63 - 67.5), 4); // ~0.821
      expect(eff(70)).toBeCloseTo(0.72 - 0.0225 * (70 - 67.5), 4); // ~0.664
    });

    test('linear uses the LOWEST saccharification rest (Grainfather convention)', () => {
      // A 63/30 + 70/30 step mash → lowest in-window rest is 63°C (not the average).
      const step = createTestRecipe({
        fermentables: [createFermentable({ weightKg: 5, ppg: 37 })],
        yeasts: [lager],
        mashSteps: [
          { id: 's1', name: 'beta', temperatureC: 63, durationMinutes: 30 },
          { id: 's2', name: 'alpha', temperatureC: 70, durationMinutes: 30 },
        ] as Recipe['mashSteps'],
      });
      const eff = recipeCalculationService.getEffectiveAttenuation(step, 'linear');
      expect(eff).toBeCloseTo(0.72 - 0.0225 * (63 - 67.5), 3); // lowest rest 63°C → ~0.821
    });

    test('linear: very hot mash (>72.5°C) reads dextrinous, not nominal', () => {
      const hot = recipeCalculationService.getEffectiveAttenuation(singleInfusion(74), 'linear');
      expect(hot).toBeLessThan(0.72); // regression: used to fall back to nominal
    });

    test('no mash steps (extract) → neutral nominal attenuation (both models)', () => {
      const us05 = { id: 'y1', name: 'US-05', attenuation: 0.81, type: 'ale', lab: 'T', labId: 'T1' } as Yeast;
      const recipe = createTestRecipe({ fermentables: [createFermentable({ weightKg: 5 })], yeasts: [us05], mashSteps: [] });
      expect(recipeCalculationService.getEffectiveAttenuation(recipe, 'linear')).toBeCloseTo(0.81, 4);
      expect(recipeCalculationService.getEffectiveAttenuation(recipe, 'kinetic')).toBeCloseTo(0.81, 2);
    });

    test('kinetic (default) anchors at 67.5°C and is monotonic in mash temp', () => {
      expect(recipeCalculationService.getEffectiveAttenuation(singleInfusion(67.5), 'kinetic')).toBeCloseTo(0.72, 2);
      const aa = (T: number) => recipeCalculationService.getEffectiveAttenuation(singleInfusion(T), 'kinetic');
      expect(aa(64)).toBeGreaterThan(aa(68)); // cooler mash → more fermentable
      expect(aa(68)).toBeGreaterThan(aa(72));
    });

    test('Märzen HochKurz step mash: OG matches, both models give a plausible FG', () => {
      const y = (v: number) => Math.round((v / 100) * 46);
      const marzen = createTestRecipe({
        batchVolumeL: 20.5,
        fermentables: [
          createFermentable({ id: 'f1', name: 'Pilsner', weightKg: 2.722, colorLovibond: 2, ppg: y(78.91) }),
          createFermentable({ id: 'f2', name: 'Munich', weightKg: 2.268, colorLovibond: 6, ppg: y(80.43) }),
          createFermentable({ id: 'f3', name: 'Munich II', weightKg: 0.907, colorLovibond: 10, ppg: y(80.43) }),
          createFermentable({ id: 'f4', name: 'Melanoidin', weightKg: 0.113, colorLovibond: 27, ppg: y(75) }),
        ],
        yeasts: [lager],
        mashSteps: [
          { id: 's1', name: 'acid', temperatureC: 55, durationMinutes: 10 },
          { id: 's2', name: 'beta', temperatureC: 63, durationMinutes: 30 },
          { id: 's3', name: 'alpha', temperatureC: 70, durationMinutes: 30 },
          { id: 's4', name: 'out', temperatureC: 76, durationMinutes: 15 },
        ] as Recipe['mashSteps'],
        // OG is measured at the into-fermenter volume (batch + fermenter loss).
        // The real beer's ~1 L of trub/yeast loss puts into-fermenter at ~21.5 L,
        // which reproduces the real OG of 1.056 at 66% brewhouse efficiency.
        equipment: { ...createTestRecipe().equipment, brewhouseEfficiencyPercent: 66, kettleLossLiters: 0, chillerLossLiters: 0, fermenterLossLiters: 1 },
      });
      const og = recipeCalculationService.calculateOG(marzen);
      expect(og).toBeCloseTo(1.056, 2);  // OG matches Brewfather / the real beer

      // Real batch finished 1.011 (80.4%). The kinetic model predicts ~76% (FG ~1.013,
      // population-typical for a 63/70 step); the linear model uses the lowest rest
      // (63°C, Grainfather) so it over-credits to ~82% (FG ~1.010). Both plausible.
      for (const model of ['kinetic', 'linear'] as const) {
        const fg = recipeCalculationService.calculateFG(marzen, { attenuationModel: model });
        const abv = recipeCalculationService.calculateABV(og, fg);
        expect(fg).toBeGreaterThan(1.008);
        expect(fg).toBeLessThan(1.016);
        expect(abv).toBeGreaterThan(5.2);
        expect(abv).toBeLessThan(6.2);
      }
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

    test('first wort hops use the full boil time even when timeMinutes is unset (regression)', () => {
      // The builder creates FWH with timeMinutes cleared. The old code read that
      // as 0 and computed tinseth(0 + 20) — roughly half the correct value.
      const fwh = createTestRecipe({
        hops: [createHop({ type: 'first wort', timeMinutes: undefined })],
      });
      const boil20 = createTestRecipe({
        hops: [createHop({ type: 'boil', timeMinutes: 20 })],
      });
      const boil60 = createTestRecipe({
        hops: [createHop({ type: 'boil', timeMinutes: 60 })],
      });

      const fwhIBU = recipeCalculationService.calculateIBU(fwh, 1.05);
      const boil20IBU = recipeCalculationService.calculateIBU(boil20, 1.05);
      const boil60IBU = recipeCalculationService.calculateIBU(boil60, 1.05);

      // FWH steeps the whole boil (boilTime + 20), so it beats a 60-min boil
      // addition and sits far above the old half-strength (~20 min) value.
      expect(fwhIBU).toBeGreaterThan(boil60IBU);
      expect(fwhIBU).toBeGreaterThan(boil20IBU * 1.6);
    });

    test('boil-gravity averaging raises IBU vs using post-boil OG', () => {
      const recipe = createTestRecipe({
        hops: [createHop({ type: 'boil', timeMinutes: 60 })],
      });
      // A lower average boil gravity reduces Tinseth's bigness suppression, so
      // passing the boil average yields more IBU than passing OG alone.
      const withAveraging = recipeCalculationService.calculateIBU(recipe, 1.06, 1.045);
      const withOgOnly = recipeCalculationService.calculateIBU(recipe, 1.06, 1.06);
      expect(withAveraging).toBeGreaterThan(withOgOnly);
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

    test('exact output unchanged after sgToPlato consolidation (golden master)', () => {
      // Pinned from the pre-refactor inline ASBC polynomial. The shared
      // sgToPlato helper must reproduce these rounded outputs exactly.
      expect(recipeCalculationService.calculateNutrition(1.050, 1.010)).toEqual({ calories: 164, carbsG: 15.2 });
      expect(recipeCalculationService.calculateNutrition(1.080, 1.020)).toEqual({ calories: 266, carbsG: 27.4 });
      expect(recipeCalculationService.calculateNutrition(1.040, 1.008)).toEqual({ calories: 130, carbsG: 12.1 });
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

  // ── Forward / reverse symmetry ──────────────────────────────────────────────
  // The reverse "target ABV → grain bill" solver (FermentableCalculationService)
  // must invert this forward OG calc: same per-fermentable efficiency selector
  // (sugar/extract 100%, grains at mash efficiency) AND same post-boil volume
  // basis. When it does, feeding the solved bill back through calculateOG
  // reproduces the target OG exactly — at ANY efficiency. These tests would fail
  // if the reverse used the old per-grain efficiency field or the batch volume.
  describe('reverse solver round-trips through calculateOG', () => {
    test('back-calculated bill reproduces the target OG exactly (65% eff, grain + sugar)', () => {
      const recipe = createTestRecipe({
        batchVolumeL: 20,
        equipment: { ...createTestRecipe().equipment, brewhouseEfficiencyPercent: 65 },
        fermentables: [
          createFermentable({ id: 'base', name: 'Pale Malt 2-Row', ppg: 37, weightKg: 1 }),
          createFermentable({ id: 'sugar', name: 'Corn Sugar', ppg: 46, weightKg: 1 }),
        ],
      });
      const intoFermenterL = volumeCalculationService.calculateIntoFermenterVolume(recipe);
      const effAtt = recipeCalculationService.getEffectiveAttenuation(recipe, 'linear');
      const targetABV = 6.2;

      const weighted = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
        recipe.fermentables,
        { base: 85, sugar: 15 },
        targetABV,
        intoFermenterL,
        recipe.equipment.brewhouseEfficiencyPercent,
        effAtt,
      );
      const solvedRecipe: Recipe = { ...recipe, fermentables: weighted };

      // OG the reverse inverts to, using the same [0.40, 0.98] attenuation clamp.
      const att = Math.max(0.4, Math.min(0.98, effAtt));
      const ogTarget = 1 + targetABV / (131.25 * att);

      expect(recipeCalculationService.calculateOG(solvedRecipe)).toBeCloseTo(ogTarget, 4);
    });

    test('changing only brewhouse efficiency changes the back-calculated grain weight', () => {
      // Direct evidence the equipment efficiency is live in the reverse calc:
      // a lower-efficiency system needs more grain for the same ABV.
      const base = createTestRecipe({
        fermentables: [createFermentable({ id: 'base', name: 'Pale Malt 2-Row', ppg: 37, weightKg: 1 })],
      });
      const reverseAt = (brewhouseEff: number) => {
        const r: Recipe = { ...base, equipment: { ...base.equipment, brewhouseEfficiencyPercent: brewhouseEff } };
        const intoFermenterL = volumeCalculationService.calculateIntoFermenterVolume(r);
        const effAtt = recipeCalculationService.getEffectiveAttenuation(r, 'linear');
        return fermentableCalculationService.calculateWeightsFromPercentsAndABV(
          r.fermentables, { base: 100 }, 5.5, intoFermenterL, brewhouseEff, effAtt,
        )[0].weightKg;
      };
      expect(reverseAt(65)).toBeGreaterThan(reverseAt(85));
    });

    test('ABV round-trips even with non-fermentable extract (lactose), at 65% eff', () => {
      // The reverse solver weights the inversion by the bill's average
      // fermentability, so a recipe with unfermentable lactose still reads back
      // as the requested ABV (not an undershoot). OG ends higher to compensate.
      const recipe = createTestRecipe({
        batchVolumeL: 20,
        equipment: { ...createTestRecipe().equipment, brewhouseEfficiencyPercent: 65 },
        fermentables: [
          createFermentable({ id: 'base', name: 'Pale Malt 2-Row', ppg: 37, weightKg: 1 }),
          createFermentable({ id: 'lac', name: 'Lactose', ppg: 35, weightKg: 1 }),
        ],
      });
      const intoFermenterL = volumeCalculationService.calculateIntoFermenterVolume(recipe);
      const effAtt = recipeCalculationService.getEffectiveAttenuation(recipe, 'linear');
      const targetABV = 5.5;

      const weighted = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
        recipe.fermentables, { base: 85, lac: 15 }, targetABV, intoFermenterL,
        recipe.equipment.brewhouseEfficiencyPercent, effAtt,
      );
      const solved: Recipe = { ...recipe, fermentables: weighted };

      const og = recipeCalculationService.calculateOG(solved);
      const fg = recipeCalculationService.calculateFG(solved, { attenuationModel: 'linear' });
      const abv = recipeCalculationService.calculateABV(og, fg);
      expect(abv).toBeCloseTo(targetABV, 1);
    });
  });
});
