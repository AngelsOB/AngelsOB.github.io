import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { starterCalculationService } from './StarterCalculationService';
import type { StarterStep } from '../models/Recipe';

describe('Starter Calculation Service', () => {
  describe('sgToPlato', () => {
    test('converts SG 1.000 to ~0°P', () => {
      const plato = starterCalculationService.sgToPlato(1.0);
      expect(plato).toBeCloseTo(0, 1);
    });

    test('converts typical wort gravity', () => {
      // SG 1.050 ≈ 12.4°P
      const plato = starterCalculationService.sgToPlato(1.050);
      expect(plato).toBeCloseTo(12.4, 1);
    });

    test('converts high gravity wort', () => {
      // SG 1.080 ≈ 19.3°P
      const plato = starterCalculationService.sgToPlato(1.080);
      expect(plato).toBeCloseTo(19.3, 1);
    });

    test('converts starter gravity', () => {
      // SG 1.037 ≈ 9.25°P (typical starter)
      const plato = starterCalculationService.sgToPlato(1.037);
      expect(plato).toBeCloseTo(9.25, 1);
    });
  });

  describe('dmeGramsForGravity', () => {
    test('returns 0 for SG 1.000', () => {
      const grams = starterCalculationService.dmeGramsForGravity(1, 1.0);
      expect(grams).toBe(0);
    });

    test('calculates DME for 1L starter at 1.037', () => {
      // 1L at 1.037 ≈ 100g DME (rough approximation)
      const grams = starterCalculationService.dmeGramsForGravity(1, 1.037);
      expect(grams).toBeGreaterThan(80);
      expect(grams).toBeLessThan(120);
    });

    test('scales linearly with volume', () => {
      const oneL = starterCalculationService.dmeGramsForGravity(1, 1.037);
      const twoL = starterCalculationService.dmeGramsForGravity(2, 1.037);
      expect(twoL).toBeCloseTo(oneL * 2, 1);
    });

    test('increases with higher target gravity', () => {
      const low = starterCalculationService.dmeGramsForGravity(1, 1.030);
      const high = starterCalculationService.dmeGramsForGravity(1, 1.045);
      expect(high).toBeGreaterThan(low);
    });

    test('handles very low gravity below 1.000', () => {
      // Should return 0 for impossible gravity
      const grams = starterCalculationService.dmeGramsForGravity(1, 0.990);
      expect(grams).toBe(0);
    });
  });

  describe('calculateViability', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('returns 1.0 for undefined date', () => {
      expect(starterCalculationService.calculateViability(undefined)).toBe(1);
    });

    test('returns 1.0 for today', () => {
      vi.setSystemTime(new Date('2024-01-15'));
      const viability = starterCalculationService.calculateViability('2024-01-15');
      expect(viability).toBe(1);
    });

    test('returns reduced viability for aged yeast', () => {
      vi.setSystemTime(new Date('2024-01-15'));
      // 30 days old: 1 - 0.007 * 30 = 0.79
      const viability = starterCalculationService.calculateViability('2023-12-16');
      expect(viability).toBeCloseTo(0.79, 2);
    });

    test('returns 0 for very old yeast', () => {
      vi.setSystemTime(new Date('2024-06-15'));
      // 200+ days old would go negative, should clamp to 0
      const viability = starterCalculationService.calculateViability('2023-06-15');
      expect(viability).toBe(0);
    });

    test('handles invalid date string', () => {
      const viability = starterCalculationService.calculateViability('not-a-date');
      expect(viability).toBe(1);
    });
  });

  describe('calculateCellsAvailable', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('calculates cells for dry yeast', () => {
      // 2 packs × 11g × 6B/g = 132B
      const cells = starterCalculationService.calculateCellsAvailable('dry', 2);
      expect(cells).toBe(132);
    });

    test('calculates cells for fresh liquid 100B pack', () => {
      // 1 pack × 100B × 100% viability = 100B
      const cells = starterCalculationService.calculateCellsAvailable(
        'liquid-100',
        1,
        '2024-01-15'
      );
      expect(cells).toBe(100);
    });

    test('calculates cells for fresh liquid 200B pack', () => {
      // 1 pack × 200B × 100% viability = 200B
      const cells = starterCalculationService.calculateCellsAvailable(
        'liquid-200',
        1,
        '2024-01-15'
      );
      expect(cells).toBe(200);
    });

    test('reduces cells for aged liquid yeast', () => {
      // 30 days old: 100B × 0.79 viability = 79B
      const cells = starterCalculationService.calculateCellsAvailable(
        'liquid-100',
        1,
        '2023-12-16'
      );
      expect(cells).toBeCloseTo(79, 0);
    });

    test('calculates cells for slurry', () => {
      // 0.5L × 1000 mL/L × 2 B/mL = 1000B
      const cells = starterCalculationService.calculateCellsAvailable(
        'slurry',
        1, // packs ignored for slurry
        undefined,
        0.5, // liters
        2 // billion per mL
      );
      expect(cells).toBe(1000);
    });

    test('handles zero slurry volume', () => {
      const cells = starterCalculationService.calculateCellsAvailable(
        'slurry',
        1,
        undefined,
        0,
        2
      );
      expect(cells).toBe(0);
    });

    test('handles fractional packs by flooring', () => {
      // 1.5 packs → 1 pack × 100B = 100B
      const cells = starterCalculationService.calculateCellsAvailable(
        'liquid-100',
        1.5,
        '2024-01-15'
      );
      expect(cells).toBe(100);
    });
  });

  describe('calculateRequiredCells', () => {
    test('calculates required cells for ale', () => {
      // 20L × 12.4°P × 0.75 = 186B
      const required = starterCalculationService.calculateRequiredCells(20, 1.050, 0.75);
      expect(required).toBeCloseTo(186, 0);
    });

    test('calculates required cells for lager (higher pitch rate)', () => {
      // 20L × 12.4°P × 1.5 = 372B
      const required = starterCalculationService.calculateRequiredCells(20, 1.050, 1.5);
      expect(required).toBeCloseTo(372, 0);
    });

    test('uses default pitch rate of 0.75', () => {
      const withDefault = starterCalculationService.calculateRequiredCells(20, 1.050);
      const withExplicit = starterCalculationService.calculateRequiredCells(20, 1.050, 0.75);
      expect(withDefault).toBeCloseTo(withExplicit, 5);
    });

    test('returns 0 for zero volume', () => {
      expect(starterCalculationService.calculateRequiredCells(0, 1.050)).toBe(0);
    });

    test('increases with higher gravity', () => {
      const low = starterCalculationService.calculateRequiredCells(20, 1.040);
      const high = starterCalculationService.calculateRequiredCells(20, 1.080);
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('calculateStarter', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('calculates complete starter plan with White model', () => {
      const steps: StarterStep[] = [
        { id: 'step1', liters: 1.5, gravity: 1.037, model: { kind: 'white', aeration: 'shaking' } },
      ];

      const result = starterCalculationService.calculateStarter(
        20,      // batch volume
        1.050,   // OG
        'liquid-100',
        1,       // packs
        '2024-01-15',
        undefined,
        undefined,
        steps
      );

      expect(result.requiredCellsB).toBeGreaterThan(0);
      expect(result.cellsAvailableB).toBe(100);
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].endBillion).toBeGreaterThan(100);
      expect(result.finalEndB).toBeGreaterThan(result.cellsAvailableB);
      expect(result.totalStarterL).toBe(1.5);
      expect(result.totalDmeG).toBeGreaterThan(0);
    });

    test('calculates starter with Braukaiser model', () => {
      const steps: StarterStep[] = [
        { id: 'step1', liters: 2, gravity: 1.037, model: { kind: 'braukaiser' } },
      ];

      const result = starterCalculationService.calculateStarter(
        20, 1.050, 'liquid-100', 1, '2024-01-15', undefined, undefined, steps
      );

      expect(result.stepResults[0].endBillion).toBeGreaterThan(100);
    });

    test('calculates multi-step starter', () => {
      const steps: StarterStep[] = [
        { id: 'step1', liters: 1, gravity: 1.037, model: { kind: 'white', aeration: 'shaking' } },
        { id: 'step2', liters: 2, gravity: 1.037, model: { kind: 'white', aeration: 'none' } },
      ];

      const result = starterCalculationService.calculateStarter(
        20, 1.050, 'liquid-100', 1, '2024-01-15', undefined, undefined, steps
      );

      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[1].endBillion).toBeGreaterThan(result.stepResults[0].endBillion);
      expect(result.totalStarterL).toBe(3);
    });

    test('returns initial cells when no steps', () => {
      const result = starterCalculationService.calculateStarter(
        20, 1.050, 'liquid-100', 1, '2024-01-15', undefined, undefined, []
      );

      expect(result.finalEndB).toBe(100);
      expect(result.totalStarterL).toBe(0);
      expect(result.totalDmeG).toBe(0);
    });

    test('handles dry yeast without starter', () => {
      const result = starterCalculationService.calculateStarter(
        20, 1.050, 'dry', 2, undefined, undefined, undefined, []
      );

      // 2 packs × 11g × 6B/g = 132B
      expect(result.cellsAvailableB).toBe(132);
      expect(result.finalEndB).toBe(132);
    });

    test('accumulates DME across steps', () => {
      const steps: StarterStep[] = [
        { id: 'step1', liters: 1, gravity: 1.037, model: { kind: 'white', aeration: 'shaking' } },
        { id: 'step2', liters: 1, gravity: 1.037, model: { kind: 'white', aeration: 'shaking' } },
      ];

      const singleStep: StarterStep[] = [
        { id: 'step1', liters: 1, gravity: 1.037, model: { kind: 'white', aeration: 'shaking' } },
      ];

      const double = starterCalculationService.calculateStarter(
        20, 1.050, 'liquid-100', 1, '2024-01-15', undefined, undefined, steps
      );
      const single = starterCalculationService.calculateStarter(
        20, 1.050, 'liquid-100', 1, '2024-01-15', undefined, undefined, singleStep
      );

      expect(double.totalDmeG).toBeCloseTo(single.totalDmeG * 2, 0);
    });
  });
});
