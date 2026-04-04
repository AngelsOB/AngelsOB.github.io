import { describe, test, expect } from 'vitest';
import { optimizeSaltAdditions } from './WaterSaltOptimizer';
import type { WaterProfile } from './WaterChemistryService';
import { BEER_STYLE_TARGETS } from './WaterChemistryService';

const RO: WaterProfile = { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 };

function expectWithinTolerance(
  achieved: WaterProfile,
  target: WaterProfile,
  tolerancePpm: number,
  ions: (keyof WaterProfile)[] = ['Ca', 'Mg', 'Na', 'Cl', 'SO4']
) {
  for (const ion of ions) {
    expect(Math.abs(achieved[ion] - target[ion])).toBeLessThanOrEqual(tolerancePpm);
  }
}

describe('WaterSaltOptimizer', () => {
  describe('RO → style targets', () => {
    test('RO → American IPA (high sulfate)', () => {
      const target = BEER_STYLE_TARGETS['American IPA'].profile;
      const result = optimizeSaltAdditions(RO, target, 20);

      expect(result.salts.gypsum_g).toBeGreaterThan(0);
      expect(result.rmsError).toBeLessThan(10);
      expectWithinTolerance(result.achieved, target, 15);
    });

    test('RO → NEIPA (high chloride)', () => {
      const target = BEER_STYLE_TARGETS['NEIPA / Hazy IPA'].profile;
      const result = optimizeSaltAdditions(RO, target, 20);

      expect(result.salts.cacl2_g).toBeGreaterThan(0);
      expect(result.rmsError).toBeLessThan(10);
      expectWithinTolerance(result.achieved, target, 15);
    });

    test('RO → West Coast IPA (very high sulfate)', () => {
      const target = BEER_STYLE_TARGETS['West Coast IPA'].profile;
      const result = optimizeSaltAdditions(RO, target, 20);

      expect(result.salts.gypsum_g).toBeGreaterThan(0);
      expect(result.achieved.SO4).toBeGreaterThan(200);
      expect(result.rmsError).toBeLessThan(15);
    });

    test('RO → Balanced', () => {
      const target = BEER_STYLE_TARGETS['Balanced'].profile;
      const result = optimizeSaltAdditions(RO, target, 20);

      expect(result.rmsError).toBeLessThan(10);
      expectWithinTolerance(result.achieved, target, 15);
    });
  });

  describe('edge cases', () => {
    test('source already at target → zero salts', () => {
      const profile: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };
      const result = optimizeSaltAdditions(profile, profile, 20);

      expect(result.salts.gypsum_g).toBeUndefined();
      expect(result.salts.cacl2_g).toBeUndefined();
      expect(result.salts.epsom_g).toBeUndefined();
      expect(result.salts.nacl_g).toBeUndefined();
    });

    test('source within ±5 ppm of target → zero salts', () => {
      const source: WaterProfile = { Ca: 73, Mg: 16, Na: 18, Cl: 77, SO4: 74, HCO3: 50 };
      const target: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };
      const result = optimizeSaltAdditions(source, target, 20);

      expect(result.salts.gypsum_g).toBeUndefined();
    });

    test('zero volume → empty result with warning', () => {
      const target: WaterProfile = { Ca: 100, Mg: 15, Na: 20, Cl: 75, SO4: 200, HCO3: 49 };
      const result = optimizeSaltAdditions(RO, target, 0);

      expect(result.salts.gypsum_g).toBeUndefined();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('source exceeds target → warnings generated', () => {
      const source: WaterProfile = { Ca: 200, Mg: 50, Na: 50, Cl: 200, SO4: 300, HCO3: 200 };
      const target: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };
      const result = optimizeSaltAdditions(source, target, 20);

      expect(result.warnings.some((w) => w.includes('exceeds target'))).toBe(true);
      // Should not add salts that would increase already-exceeded ions
      expect(result.salts.gypsum_g ?? 0).toBe(0);
    });
  });

  describe('solver correctness', () => {
    test('single ion deficit — Ca with reasonable target', () => {
      const source = RO;
      // Realistic target: wanting Ca also means accepting some SO4 and Cl
      const target: WaterProfile = { Ca: 100, Mg: 0, Na: 0, Cl: 50, SO4: 100, HCO3: 0 };
      const result = optimizeSaltAdditions(source, target, 10);

      const totalCaSalts = (result.salts.gypsum_g ?? 0) + (result.salts.cacl2_g ?? 0);
      expect(totalCaSalts).toBeGreaterThan(0);
      // Ca is lower priority than Cl/SO4, so larger deviation is expected
      expect(Math.abs(result.achieved.Ca - 100)).toBeLessThan(35);
    });

    test('salts are rounded to 0.1g', () => {
      const target = BEER_STYLE_TARGETS['American IPA'].profile;
      const result = optimizeSaltAdditions(RO, target, 20);

      for (const key of ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g'] as const) {
        const val = result.salts[key];
        if (val !== undefined) {
          expect(Math.round(val * 10) / 10).toBe(val);
        }
      }
    });

    test('different volumes produce different salt amounts', () => {
      const target = BEER_STYLE_TARGETS['American IPA'].profile;
      const result10L = optimizeSaltAdditions(RO, target, 10);
      const result40L = optimizeSaltAdditions(RO, target, 40);

      // Larger volume needs more salt to achieve same ppm
      const total10 = (result10L.salts.gypsum_g ?? 0) + (result10L.salts.cacl2_g ?? 0);
      const total40 = (result40L.salts.gypsum_g ?? 0) + (result40L.salts.cacl2_g ?? 0);
      expect(total40).toBeGreaterThan(total10);
    });

    test('RMS error is computed correctly', () => {
      const target = BEER_STYLE_TARGETS['Balanced'].profile;
      const result = optimizeSaltAdditions(RO, target, 20);

      // Manually compute RMS from deltas
      const ions = ['Ca', 'Mg', 'Na', 'Cl', 'SO4'] as const;
      const sumSq = ions.reduce((sum, ion) => {
        const d = result.achieved[ion] - target[ion];
        return sum + d * d;
      }, 0);
      const expectedRms = Math.sqrt(sumSq / 5);

      expect(Math.abs(result.rmsError - expectedRms)).toBeLessThan(0.5);
    });
  });

  describe('baking soda (NaHCO3)', () => {
    test('includeBakingSoda adds nahco3_g when HCO3 deficit exists', () => {
      const target: WaterProfile = { Ca: 100, Mg: 20, Na: 20, Cl: 100, SO4: 100, HCO3: 150 };
      const result = optimizeSaltAdditions(RO, target, 20, { includeBakingSoda: true });

      expect(result.salts.nahco3_g).toBeGreaterThan(0);
      // HCO3 should be reasonably close to target
      expect(Math.abs(result.achieved.HCO3 - 150)).toBeLessThan(30);
    });

    test('without includeBakingSoda, nahco3_g is absent', () => {
      const target: WaterProfile = { Ca: 100, Mg: 20, Na: 20, Cl: 100, SO4: 100, HCO3: 150 };
      const result = optimizeSaltAdditions(RO, target, 20);

      expect(result.salts.nahco3_g).toBeUndefined();
    });

    test('baking soda contributes Na — solver accounts for cross-ion effect', () => {
      const target: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 100 };
      const result = optimizeSaltAdditions(RO, target, 20, { includeBakingSoda: true });

      // Baking soda adds Na, so NaCl should be reduced or zero compared to without
      const resultWithout = optimizeSaltAdditions(RO, target, 20);
      const naclWith = result.salts.nacl_g ?? 0;
      const naclWithout = resultWithout.salts.nacl_g ?? 0;
      expect(naclWith).toBeLessThanOrEqual(naclWithout + 0.1);
    });

    test('RO → Stout/Porter with baking soda targets HCO3', () => {
      const target = BEER_STYLE_TARGETS['Stout / Porter'].profile;
      const result = optimizeSaltAdditions(RO, target, 20, { includeBakingSoda: true });

      expect(result.salts.nahco3_g).toBeGreaterThan(0);
      // Cl:SO4 ratio should still be accurate
      const achievedRatio = result.achieved.Cl / result.achieved.SO4;
      const targetRatio = target.Cl / target.SO4;
      expect(Math.abs(achievedRatio - targetRatio)).toBeLessThan(0.15);
    });

    test('no HCO3 deficit → baking soda is negligible', () => {
      const target: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 0 };
      const result = optimizeSaltAdditions(RO, target, 20, { includeBakingSoda: true });

      // May be a tiny amount (0.1g) due to Na cross-contribution, but should be minimal
      expect(result.salts.nahco3_g ?? 0).toBeLessThanOrEqual(0.2);
    });

    test('salts are rounded to 0.1g with baking soda', () => {
      const target = BEER_STYLE_TARGETS['Stout / Porter'].profile;
      const result = optimizeSaltAdditions(RO, target, 20, { includeBakingSoda: true });

      for (const key of ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g', 'nahco3_g'] as const) {
        const val = result.salts[key];
        if (val !== undefined) {
          expect(Math.round(val * 10) / 10).toBe(val);
        }
      }
    });
  });
});
