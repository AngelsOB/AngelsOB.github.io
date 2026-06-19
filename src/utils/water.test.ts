import { describe, test, expect, beforeEach, vi } from "vitest";
import {
  RO_PROFILE,
  ION_PPM_PER_G_PER_L,
  addProfiles,
  subtractProfiles,
  scaleProfile,
  zeroProfile,
  ionDeltaFromSalts,
  clampProfile,
  mixProfiles,
  chlorideToSulfateRatio,
  COMMON_WATER_PROFILES,
  ION_KEYS,
  DEFAULT_TOLERANCE_PPM,
  ION_HINTS,
  loadSavedWaterProfiles,
  saveNewWaterProfile,
  updateSavedWaterProfile,
  deleteSavedWaterProfile,
  type WaterProfile,
} from "./water";

// A non-trivial reference profile used across arithmetic tests.
const PROFILE_A: WaterProfile = {
  Ca: 50,
  Mg: 10,
  Na: 20,
  Cl: 60,
  SO4: 100,
  HCO3: 40,
};

const PROFILE_B: WaterProfile = {
  Ca: 25,
  Mg: 5,
  Na: 10,
  Cl: 30,
  SO4: 50,
  HCO3: 20,
};

describe("water chemistry helpers", () => {
  // ── Constants ─────────────────────────────────────────────────────────

  describe("RO_PROFILE", () => {
    test("reverse-osmosis water has zero of every ion", () => {
      // RO water is deionized: by definition all mineral content is ~0 ppm.
      expect(RO_PROFILE).toEqual({
        Ca: 0,
        Mg: 0,
        Na: 0,
        Cl: 0,
        SO4: 0,
        HCO3: 0,
      });
    });
  });

  describe("ION_KEYS", () => {
    test("lists exactly the six ion fields of WaterProfile", () => {
      expect(ION_KEYS).toEqual(["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"]);
    });
  });

  describe("DEFAULT_TOLERANCE_PPM", () => {
    test("default ppm tolerance is 20", () => {
      expect(DEFAULT_TOLERANCE_PPM).toBe(20);
    });
  });

  describe("ION_HINTS", () => {
    test("provides a non-empty hint string for every ion key", () => {
      for (const key of ION_KEYS) {
        expect(typeof ION_HINTS[key]).toBe("string");
        expect(ION_HINTS[key].length).toBeGreaterThan(0);
      }
    });

    test("each hint is keyed to the correct ion (no copy-paste swaps)", () => {
      // Anchor each hint to a token that is UNIQUE to its own ion's hint, so a
      // swap between two ions (e.g. SO4's hint pasted under Cl) would fail.
      // Each token below was verified to occur in exactly one ion's hint.
      // SO4 = sulfate: drives hop expression / bitterness.
      expect(ION_HINTS.SO4.toLowerCase()).toContain("sulfate");
      expect(ION_HINTS.SO4.toLowerCase()).toContain("hop");
      // Cl = chloride: enhances malt body and mouthfeel.
      expect(ION_HINTS.Cl.toLowerCase()).toContain("mouthfeel");
      // Ca = calcium: enzymes / mash pH.
      expect(ION_HINTS.Ca.toLowerCase()).toContain("enzymes");
      // Mg = magnesium: yeast nutrient.
      expect(ION_HINTS.Mg.toLowerCase()).toContain("nutrient");
      // Na = sodium: salty above threshold.
      expect(ION_HINTS.Na.toLowerCase()).toContain("salty");
      // HCO3 = bicarbonate: alkalinity proxy.
      expect(ION_HINTS.HCO3.toLowerCase()).toContain("alkalinity");
    });
  });

  // ── ION_PPM_PER_G_PER_L (molar-mass-derived mass fractions × 1000) ──────
  // Standard atomic masses (g/mol): Ca 40.078, Mg 24.305, Na 22.990,
  // Cl 35.453, S 32.06, O 15.999, H 1.008, C 12.011. Water of crystallisation
  // H2O = 18.015. ppm contribution per (g salt / L water) = mass_fraction*1000.

  describe("ION_PPM_PER_G_PER_L", () => {
    // These constants are exact molar-mass mass-fractions × 1000. They are
    // known to 4–5 sig figs, so assertions are anchored to the independently
    // computed formula value at 0.1 ppm precision (digits=1). A loose ±0.5 ppm
    // window (digits=0) would mask a 4th-digit transcription error, so we do
    // NOT use it here.

    test("gypsum CaSO4·2H2O Ca = 40.078/172.164 → 232.79 ppm", () => {
      // M = 40.078 + 32.06 + 4*15.999 + 2*18.015 = 172.164 g/mol
      // Ca = 40.078 / 172.164 = 0.232790 → 232.79 ppm
      expect(ION_PPM_PER_G_PER_L.gypsum.Ca).toBeCloseTo(232.79, 1);
    });

    // gypsum.SO4 = (32.06 + 4*15.999)/172.164 = 0.557933 → 557.93 ppm.
    test("gypsum CaSO4·2H2O SO4 = 96.056/172.164 → 557.93 ppm", () => {
      expect(ION_PPM_PER_G_PER_L.gypsum.SO4).toBeCloseTo(557.93, 1);
    });

    test("cacl2 CaCl2·2H2O Ca = 40.078/147.014 → 272.61 ppm", () => {
      // M = 40.078 + 2*35.453 + 2*18.015 = 147.014 g/mol
      // Ca = 40.078 / 147.014 = 0.272613 → 272.61 ppm
      expect(ION_PPM_PER_G_PER_L.cacl2.Ca).toBeCloseTo(272.61, 1);
    });

    // cacl2.Cl = (2*35.453)/147.014 = 0.482308 → 482.31 ppm.
    test("cacl2 CaCl2·2H2O Cl = 70.906/147.014 → 482.31 ppm", () => {
      expect(ION_PPM_PER_G_PER_L.cacl2.Cl).toBeCloseTo(482.31, 1);
    });

    test("epsom MgSO4·7H2O Mg = 24.305/246.466 → 98.61 ppm", () => {
      // M = 24.305 + 96.056 + 7*18.015 = 246.466 g/mol
      // Mg = 24.305 / 246.466 = 0.098614 → 98.61 ppm
      expect(ION_PPM_PER_G_PER_L.epsom.Mg).toBeCloseTo(98.61, 1);
    });

    // epsom.SO4 = 96.056/246.466 = 0.389733 → 389.73 ppm.
    test("epsom MgSO4·7H2O SO4 = 96.056/246.466 → 389.73 ppm", () => {
      expect(ION_PPM_PER_G_PER_L.epsom.SO4).toBeCloseTo(389.73, 1);
    });

    test("nacl Na = 22.990/58.443 → 393.37 ppm", () => {
      // M = 22.990 + 35.453 = 58.443; Na = 0.393375 → 393.37 ppm
      expect(ION_PPM_PER_G_PER_L.nacl.Na).toBeCloseTo(393.37, 1);
    });

    test("nacl Cl = 35.453/58.443 → 606.63 ppm", () => {
      // Cl = 35.453 / 58.443 = 0.606625 → 606.63 ppm
      expect(ION_PPM_PER_G_PER_L.nacl.Cl).toBeCloseTo(606.63, 1);
    });

    test("nahco3 Na = 22.990/84.006 → 273.67 ppm", () => {
      // M = 22.990 + 1.008 + 12.011 + 3*15.999 = 84.006; Na = 0.273671 → 273.67
      expect(ION_PPM_PER_G_PER_L.nahco3.Na).toBeCloseTo(273.67, 1);
    });

    test("nahco3 HCO3 = 61.016/84.006 → 726.33 ppm", () => {
      // HCO3 = 1.008 + 12.011 + 3*15.999 = 61.016; / 84.006 = 0.726329 → 726.33
      expect(ION_PPM_PER_G_PER_L.nahco3.HCO3).toBeCloseTo(726.33, 1);
    });

    test("each salt's ion fractions sum to less than 1000 (water/counter-ion remainder)", () => {
      // Mass fractions of named ions cannot reach 100% because crystal water
      // and (where applicable) the un-tracked half of the molecule carry mass.
      expect(
        ION_PPM_PER_G_PER_L.gypsum.Ca + ION_PPM_PER_G_PER_L.gypsum.SO4
      ).toBeLessThan(1000);
      expect(
        ION_PPM_PER_G_PER_L.cacl2.Ca + ION_PPM_PER_G_PER_L.cacl2.Cl
      ).toBeLessThan(1000);
      // NaCl is anhydrous and fully accounted: Na + Cl ≈ 1000 ppm.
      expect(
        ION_PPM_PER_G_PER_L.nacl.Na + ION_PPM_PER_G_PER_L.nacl.Cl
      ).toBeCloseTo(1000, 0);
    });
  });

  // ── addProfiles ─────────────────────────────────────────────────────────

  describe("addProfiles", () => {
    test("adds each ion component-wise", () => {
      // A + B summed per ion: Ca 75, Mg 15, Na 30, Cl 90, SO4 150, HCO3 60
      expect(addProfiles(PROFILE_A, PROFILE_B)).toEqual({
        Ca: 75,
        Mg: 15,
        Na: 30,
        Cl: 90,
        SO4: 150,
        HCO3: 60,
      });
    });

    test("adding the zero profile is an identity", () => {
      expect(addProfiles(PROFILE_A, zeroProfile())).toEqual(PROFILE_A);
    });

    test("adds fractional ppm without rounding or truncation", () => {
      // Real water profiles carry decimals; the addition must be exact.
      const a: WaterProfile = {
        Ca: 50.5,
        Mg: 10.25,
        Na: 20.1,
        Cl: 60.75,
        SO4: 100.4,
        HCO3: 40.2,
      };
      const b: WaterProfile = {
        Ca: 0.25,
        Mg: 0.05,
        Na: 0.9,
        Cl: 0.5,
        SO4: 0.15,
        HCO3: 0.8,
      };
      const r = addProfiles(a, b);
      expect(r.Ca).toBeCloseTo(50.75, 10);
      expect(r.Mg).toBeCloseTo(10.3, 10);
      expect(r.Na).toBeCloseTo(21.0, 10);
      expect(r.Cl).toBeCloseTo(61.25, 10);
      expect(r.SO4).toBeCloseTo(100.55, 10);
      expect(r.HCO3).toBeCloseTo(41.0, 10);
    });

    test("is commutative", () => {
      expect(addProfiles(PROFILE_A, PROFILE_B)).toEqual(
        addProfiles(PROFILE_B, PROFILE_A)
      );
    });
  });

  // ── subtractProfiles ──────────────────────────────────────────────────

  describe("subtractProfiles", () => {
    test("subtracts each ion component-wise", () => {
      // A - B per ion: Ca 25, Mg 5, Na 10, Cl 30, SO4 50, HCO3 20
      expect(subtractProfiles(PROFILE_A, PROFILE_B)).toEqual({
        Ca: 25,
        Mg: 5,
        Na: 10,
        Cl: 30,
        SO4: 50,
        HCO3: 20,
      });
    });

    test("subtracting a profile from itself yields the zero profile", () => {
      expect(subtractProfiles(PROFILE_A, PROFILE_A)).toEqual(zeroProfile());
    });

    test("can produce negative ions on EVERY component (no clamping in this helper)", () => {
      // B - A per ion (B is exactly half of A, so each component goes negative):
      //   Ca 25-50=-25, Mg 5-10=-5, Na 10-20=-10, Cl 30-60=-30,
      //   SO4 50-100=-50, HCO3 20-40=-20. Assert the full object so a bug that
      //   clamped or mishandled a single non-Ca ion would be caught.
      expect(subtractProfiles(PROFILE_B, PROFILE_A)).toEqual({
        Ca: -25,
        Mg: -5,
        Na: -10,
        Cl: -30,
        SO4: -50,
        HCO3: -20,
      });
    });

    test("subtracts fractional ppm without rounding or truncation", () => {
      // Real water profiles carry decimals; the subtraction must be exact.
      const a: WaterProfile = {
        Ca: 50.5,
        Mg: 10.25,
        Na: 20.1,
        Cl: 60.75,
        SO4: 100.4,
        HCO3: 40.2,
      };
      const b: WaterProfile = {
        Ca: 0.25,
        Mg: 0.05,
        Na: 0.1,
        Cl: 0.5,
        SO4: 0.15,
        HCO3: 0.2,
      };
      const r = subtractProfiles(a, b);
      expect(r.Ca).toBeCloseTo(50.25, 10);
      expect(r.Mg).toBeCloseTo(10.2, 10);
      expect(r.Na).toBeCloseTo(20.0, 10);
      expect(r.Cl).toBeCloseTo(60.25, 10);
      expect(r.SO4).toBeCloseTo(100.25, 10);
      expect(r.HCO3).toBeCloseTo(40.0, 10);
    });

    test("is the inverse of addProfiles: (A+B)-B === A", () => {
      expect(subtractProfiles(addProfiles(PROFILE_A, PROFILE_B), PROFILE_B)).toEqual(
        PROFILE_A
      );
    });
  });

  // ── scaleProfile ──────────────────────────────────────────────────────

  describe("scaleProfile", () => {
    test("multiplies every ion by the factor", () => {
      // A * 2: Ca 100, Mg 20, Na 40, Cl 120, SO4 200, HCO3 80
      expect(scaleProfile(PROFILE_A, 2)).toEqual({
        Ca: 100,
        Mg: 20,
        Na: 40,
        Cl: 120,
        SO4: 200,
        HCO3: 80,
      });
    });

    test("scaling by 0 yields the zero profile", () => {
      expect(scaleProfile(PROFILE_A, 0)).toEqual(zeroProfile());
    });

    test("scaling by 1 is an identity", () => {
      expect(scaleProfile(PROFILE_A, 1)).toEqual(PROFILE_A);
    });

    test("scaling by 0.5 halves every ion", () => {
      // A * 0.5 should equal B (B is exactly half of A)
      expect(scaleProfile(PROFILE_A, 0.5)).toEqual(PROFILE_B);
    });
  });

  // ── zeroProfile ───────────────────────────────────────────────────────

  describe("zeroProfile", () => {
    test("returns an all-zero profile equal to RO_PROFILE values", () => {
      expect(zeroProfile()).toEqual(RO_PROFILE);
    });

    test("returns a fresh copy, not the RO_PROFILE reference", () => {
      // It must be a clone so mutating the result cannot corrupt the constant.
      const z = zeroProfile();
      expect(z).not.toBe(RO_PROFILE);
      z.Ca = 999;
      expect(RO_PROFILE.Ca).toBe(0);
    });
  });

  // ── ionDeltaFromSalts ─────────────────────────────────────────────────

  describe("ionDeltaFromSalts", () => {
    test("1 g gypsum in 1 L raises Ca by the gypsum.Ca constant, no other tracked ion except SO4", () => {
      // perL = 1 g / 1 L = 1, so delta.Ca = gypsum.Ca constant = 232.79 ppm
      // (40.078/172.164*1000). Gypsum contributes only Ca and SO4.
      const delta = ionDeltaFromSalts({ gypsum_g: 1 }, 1);
      expect(delta.Ca).toBeCloseTo(232.79, 1);
      expect(delta.Mg).toBe(0);
      expect(delta.Na).toBe(0);
      expect(delta.Cl).toBe(0);
      expect(delta.HCO3).toBe(0);
      // Exact SO4 value is asserted in the dedicated test below.
      expect(delta.SO4).toBeGreaterThan(0);
    });

    // 1 g gypsum in 1 L → SO4 = 96.056/172.164*1000 = 557.93 ppm.
    test("1 g gypsum in 1 L raises SO4 by 557.93 ppm", () => {
      const delta = ionDeltaFromSalts({ gypsum_g: 1 }, 1);
      expect(delta.SO4).toBeCloseTo(557.93, 1);
    });

    test("dilution: doubling the volume halves the ppm delta", () => {
      // 1 g gypsum in 2 L → perL = 0.5 → Ca = 0.5 * 232.79 = 116.40 ppm.
      const delta = ionDeltaFromSalts({ gypsum_g: 1 }, 2);
      expect(delta.Ca).toBeCloseTo(116.4, 1);
      // SO4 scales linearly too: exactly half of the 1 L value.
      const full = ionDeltaFromSalts({ gypsum_g: 1 }, 1);
      expect(delta.SO4).toBeCloseTo(full.SO4 / 2, 6);
    });

    test("CaCl2 raises Ca and Cl only among tracked salts", () => {
      // 2 g CaCl2·2H2O in 1 L → perL = 2. Ca = 2 * 272.61 = 545.23 ppm
      // (40.078/147.014*1000 * 2). CaCl2 adds no SO4.
      const delta = ionDeltaFromSalts({ cacl2_g: 2 }, 1);
      expect(delta.Ca).toBeCloseTo(545.23, 1);
      expect(delta.SO4).toBe(0);
      expect(delta.Mg).toBe(0);
      expect(delta.Na).toBe(0);
      expect(delta.HCO3).toBe(0);
      expect(delta.Cl).toBeGreaterThan(0);
    });

    // 2 g CaCl2 in 1 L → Cl = 2 * 70.906/147.014*1000 = 964.62 ppm.
    test("2 g CaCl2 in 1 L raises Cl by 964.62 ppm", () => {
      const delta = ionDeltaFromSalts({ cacl2_g: 2 }, 1);
      expect(delta.Cl).toBeCloseTo(964.62, 1);
    });

    test("epsom raises Mg and SO4 only among tracked salts", () => {
      // 1 g epsom in 1 L: Mg = 98.61 ppm (24.305/246.466*1000). Epsom adds no Ca.
      const delta = ionDeltaFromSalts({ epsom_g: 1 }, 1);
      expect(delta.Mg).toBeCloseTo(98.61, 1);
      expect(delta.Ca).toBe(0);
      expect(delta.Na).toBe(0);
      expect(delta.Cl).toBe(0);
      expect(delta.HCO3).toBe(0);
      expect(delta.SO4).toBeGreaterThan(0);
    });

    // 1 g epsom in 1 L → SO4 = 96.056/246.466*1000 = 389.73 ppm.
    test("1 g epsom in 1 L raises SO4 by 389.73 ppm", () => {
      const delta = ionDeltaFromSalts({ epsom_g: 1 }, 1);
      expect(delta.SO4).toBeCloseTo(389.73, 1);
    });

    test("NaCl raises Na and Cl only", () => {
      // 1 g NaCl in 1 L: Na = 393.37 (22.990/58.443*1000), Cl = 606.63.
      const delta = ionDeltaFromSalts({ nacl_g: 1 }, 1);
      expect(delta.Na).toBeCloseTo(393.37, 1);
      expect(delta.Cl).toBeCloseTo(606.63, 1);
      expect(delta.Ca).toBe(0);
      expect(delta.Mg).toBe(0);
      expect(delta.SO4).toBe(0);
      expect(delta.HCO3).toBe(0);
    });

    test("baking soda raises Na and HCO3 only", () => {
      // 1 g NaHCO3 in 1 L: Na = 273.67 (22.990/84.006*1000), HCO3 = 726.33.
      const delta = ionDeltaFromSalts({ nahco3_g: 1 }, 1);
      expect(delta.Na).toBeCloseTo(273.67, 1);
      expect(delta.HCO3).toBeCloseTo(726.33, 1);
      expect(delta.Ca).toBe(0);
      expect(delta.Mg).toBe(0);
      expect(delta.Cl).toBe(0);
      expect(delta.SO4).toBe(0);
    });

    test("Ca accumulates across salts that share that ion", () => {
      // 1 g gypsum + 1 g CaCl2 in 1 L:
      //   Ca = 232.79 (gypsum) + 272.61 (cacl2) = 505.40 ppm
      const delta = ionDeltaFromSalts({ gypsum_g: 1, cacl2_g: 1 }, 1);
      expect(delta.Ca).toBeCloseTo(505.4, 1);
    });

    test("Na from NaCl and NaHCO3 add together", () => {
      // 1 g NaCl + 1 g NaHCO3 in 1 L: Na = 22.990/58.443*1000 + 22.990/84.006*1000
      //   = 393.375 + 273.671 = 667.05 ppm. Anchored at ±0.5 ppm (digits=0)
      // because both Na constants are stored at 4 dp (393.4, 273.7) and their
      // sum carries benign accumulated rounding (~0.05 ppm); the window still
      // catches a wrong/transposed constant (which would be off by tens of ppm).
      const delta = ionDeltaFromSalts({ nacl_g: 1, nahco3_g: 1 }, 1);
      expect(delta.Na).toBeCloseTo(667.05, 0);
    });

    test("empty additions yield zero ppm for everything", () => {
      const delta = ionDeltaFromSalts({}, 19);
      expect(delta).toEqual(zeroProfile());
    });

    test("negative gram amounts are ignored (treated as 0)", () => {
      // perL guard requires g > 0, so a negative dose contributes nothing.
      const delta = ionDeltaFromSalts({ gypsum_g: -5 }, 1);
      expect(delta.Ca).toBe(0);
      expect(delta.SO4).toBe(0);
    });

    test("exactly 0 g contributes nothing (g > 0 boundary)", () => {
      // The perL guard is `g && g > 0`. At g = 0 the contribution must be 0,
      // distinct from the negative-grams case above.
      const delta = ionDeltaFromSalts({ gypsum_g: 0 }, 1);
      expect(delta).toEqual(zeroProfile());
    });

    test("zero volume is floored to 0.0001 L (no division by zero)", () => {
      // v = max(0.0001, 0) = 0.0001, so perL = 1 / 0.0001 = 10000 (finite, huge).
      const delta = ionDeltaFromSalts({ gypsum_g: 1 }, 0);
      expect(Number.isFinite(delta.Ca)).toBe(true);
      // Ca = 10000 * 232.79 ≈ 2,327,900. The 10000× amplifies the constant's
      // 4-dp rounding, so anchor at ±500 ppm (digits=-3) — still confirms the
      // ~2.3M magnitude from flooring vs any other guard value.
      expect(delta.Ca).toBeCloseTo(232.79 * 10000, -3);
    });

    test("negative volume is also floored to 0.0001 L (huge positive delta)", () => {
      // v = max(0.0001, -3) = 0.0001, so the negative volume is clamped exactly
      // like 0: perL = 1 / 0.0001 = 10000 and the delta is large and POSITIVE,
      // never negative. This exercises the Math.max guard's negative branch.
      const delta = ionDeltaFromSalts({ gypsum_g: 1 }, -3);
      expect(Number.isFinite(delta.Ca)).toBe(true);
      expect(delta.Ca).toBeGreaterThan(0);
      expect(delta.Ca).toBeCloseTo(232.79 * 10000, -3);
      // Same floored volume as volumeL = 0, so the two must match exactly.
      const atZero = ionDeltaFromSalts({ gypsum_g: 1 }, 0);
      expect(delta.Ca).toBeCloseTo(atZero.Ca, 6);
    });
  });

  // ── clampProfile ──────────────────────────────────────────────────────

  describe("clampProfile", () => {
    test("clamps negative ions to zero, leaves positives untouched", () => {
      const negative: WaterProfile = {
        Ca: -10,
        Mg: 5,
        Na: -1,
        Cl: 60,
        SO4: -100,
        HCO3: 40,
      };
      expect(clampProfile(negative)).toEqual({
        Ca: 0,
        Mg: 5,
        Na: 0,
        Cl: 60,
        SO4: 0,
        HCO3: 40,
      });
    });

    test("an already non-negative profile is unchanged", () => {
      expect(clampProfile(PROFILE_A)).toEqual(PROFILE_A);
    });

    test("never returns a negative ion", () => {
      const result = clampProfile({
        Ca: -1,
        Mg: -1,
        Na: -1,
        Cl: -1,
        SO4: -1,
        HCO3: -1,
      });
      for (const key of ION_KEYS) {
        expect(result[key]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ── mixProfiles ───────────────────────────────────────────────────────

  describe("mixProfiles", () => {
    test("volume-weighted average of two equal volumes is the arithmetic mean", () => {
      // Equal 10 L of A and B → mean per ion: Ca 37.5, Mg 7.5, Na 15,
      // Cl 45, SO4 75, HCO3 30.
      const mixed = mixProfiles([
        { volumeL: 10, profile: PROFILE_A },
        { volumeL: 10, profile: PROFILE_B },
      ]);
      expect(mixed.Ca).toBeCloseTo(37.5, 6);
      expect(mixed.SO4).toBeCloseTo(75, 6);
      expect(mixed.HCO3).toBeCloseTo(30, 6);
    });

    test("weights by volume: more A pulls the mix toward A", () => {
      // 30 L A + 10 L B, Ca = (30*50 + 10*25)/40 = (1500+250)/40 = 43.75
      const mixed = mixProfiles([
        { volumeL: 30, profile: PROFILE_A },
        { volumeL: 10, profile: PROFILE_B },
      ]);
      expect(mixed.Ca).toBeCloseTo(43.75, 6);
    });

    test("mixing RO with mineral water dilutes proportionally", () => {
      // 10 L RO + 10 L A → Ca = (0 + 10*50)/20 = 25 (exactly half of A)
      const mixed = mixProfiles([
        { volumeL: 10, profile: RO_PROFILE },
        { volumeL: 10, profile: PROFILE_A },
      ]);
      expect(mixed.Ca).toBeCloseTo(25, 6);
      expect(mixed.SO4).toBeCloseTo(50, 6);
    });

    test("a single source returns that source's profile unchanged", () => {
      const mixed = mixProfiles([{ volumeL: 19, profile: PROFILE_A }]);
      expect(mixed.Ca).toBeCloseTo(PROFILE_A.Ca, 6);
      expect(mixed.SO4).toBeCloseTo(PROFILE_A.SO4, 6);
    });

    test("empty input returns the zero profile", () => {
      expect(mixProfiles([])).toEqual(zeroProfile());
    });

    test("total volume <= 0 returns the zero profile (no division by zero)", () => {
      expect(mixProfiles([{ volumeL: 0, profile: PROFILE_A }])).toEqual(
        zeroProfile()
      );
    });

    test("negative volume source contributes nothing → weighted avg of valid volumes", () => {
      // mixProfiles floors volumes in BOTH the denominator (totalV) and the
      // weighted numerator (water.ts), so a negative entry contributes nothing:
      //   totalV = max(0,-5) + max(0,10) = 10
      //   Ca = (0 (floored B) + PROFILE_A.Ca * 10) / 10 = 50
      // The result is a genuine weighted average within the [25, 50] source range.
      const mixed = mixProfiles([
        { volumeL: -5, profile: PROFILE_B },
        { volumeL: 10, profile: PROFILE_A },
      ]);
      // Only the +10 L of PROFILE_A is valid, so the mix equals PROFILE_A.
      expect(mixed.Ca).toBeCloseTo(PROFILE_A.Ca, 6);
    });

    test("mixed result stays within the min/max bounds of the sources", () => {
      // A weighted average can never exceed the largest or fall below the
      // smallest source value for an ion.
      const mixed = mixProfiles([
        { volumeL: 5, profile: PROFILE_A },
        { volumeL: 15, profile: PROFILE_B },
      ]);
      expect(mixed.Ca).toBeGreaterThanOrEqual(PROFILE_B.Ca);
      expect(mixed.Ca).toBeLessThanOrEqual(PROFILE_A.Ca);
    });
  });

  // ── chlorideToSulfateRatio ────────────────────────────────────────────

  describe("chlorideToSulfateRatio", () => {
    test("computes Cl / SO4", () => {
      // PROFILE_A: Cl 60 / SO4 100 = 0.6
      expect(chlorideToSulfateRatio(PROFILE_A)).toBeCloseTo(0.6, 6);
    });

    test("returns 1.0 for a balanced profile", () => {
      // Equal Cl and SO4 → ratio 1 (the classic 'balanced' water)
      const balanced: WaterProfile = { ...RO_PROFILE, Cl: 100, SO4: 100 };
      expect(chlorideToSulfateRatio(balanced)).toBeCloseTo(1, 6);
    });

    test("returns null when sulfate is zero (avoids divide-by-zero)", () => {
      const noSulfate: WaterProfile = { ...RO_PROFILE, Cl: 50, SO4: 0 };
      expect(chlorideToSulfateRatio(noSulfate)).toBeNull();
    });

    test("returns null when sulfate is negative", () => {
      const negSulfate: WaterProfile = { ...RO_PROFILE, Cl: 50, SO4: -10 };
      expect(chlorideToSulfateRatio(negSulfate)).toBeNull();
    });

    test("hop-forward water (high SO4) yields ratio < 1", () => {
      // Burton: Cl 35 / SO4 470 = 0.0745 — sulfate-dominant, classic for bitters.
      const ratio = chlorideToSulfateRatio(COMMON_WATER_PROFILES.Burton);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeCloseTo(35 / 470, 6);
      expect(ratio!).toBeLessThan(1);
    });
  });

  // ── COMMON_WATER_PROFILES (well-known historical city water) ───────────

  describe("COMMON_WATER_PROFILES", () => {
    test("RO entry aliases the all-zero RO_PROFILE", () => {
      expect(COMMON_WATER_PROFILES.RO).toEqual(RO_PROFILE);
    });

    test("Burton-on-Trent is high-sulfate (pale-ale water)", () => {
      // Burton water is famously gypsum-rich; SO4 should dominate Cl heavily.
      const b = COMMON_WATER_PROFILES.Burton;
      expect(b.SO4).toBe(470);
      expect(b.SO4).toBeGreaterThan(b.Cl);
    });

    test("Pilsen is very soft (low total mineral content)", () => {
      // Pilsen's softness is what defines pale lagers; every ion is small.
      const p = COMMON_WATER_PROFILES.Pilsen;
      for (const key of ION_KEYS) {
        expect(p[key]).toBeLessThanOrEqual(15);
      }
    });

    test("Dublin is high-alkalinity (stout water)", () => {
      // Dublin's high HCO3 buffers roasted-malt acidity in stouts.
      expect(COMMON_WATER_PROFILES.Dublin.HCO3).toBe(319);
    });

    test("Montreal has zero bicarbonate per the city report", () => {
      // Per project memory: Montreal HCO3 was corrected to 0 from the city report.
      expect(COMMON_WATER_PROFILES.Montreal.HCO3).toBe(0);
    });

    test("every profile exposes all six ion keys as finite, non-negative ppm", () => {
      // A real water profile cannot have NaN/Infinity (typeof both === 'number')
      // nor a negative ion concentration, so assert finiteness and >= 0 too.
      for (const name of Object.keys(COMMON_WATER_PROFILES)) {
        const profile = COMMON_WATER_PROFILES[name];
        for (const key of ION_KEYS) {
          expect(typeof profile[key]).toBe("number");
          expect(Number.isFinite(profile[key])).toBe(true);
          expect(profile[key]).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});

// ── Saved water profiles (localStorage-backed) ──────────────────────────
// The module persists custom profiles via storage.loadJson/saveJson, which
// touch localStorage. The vitest env is 'node', so we stub a mock store.

describe("saved water profiles (localStorage)", () => {
  const createMockStorage = () => {
    const store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((key) => delete store[key]);
      }),
      get length() {
        return Object.keys(store).length;
      },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
      _store: store,
    };
  };

  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    vi.stubGlobal("localStorage", mockStorage);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const SAMPLE: WaterProfile = {
    Ca: 80,
    Mg: 5,
    Na: 10,
    Cl: 50,
    SO4: 90,
    HCO3: 30,
  };

  describe("loadSavedWaterProfiles", () => {
    test("returns an empty array when nothing is stored", () => {
      expect(loadSavedWaterProfiles()).toEqual([]);
    });

    test("round-trips a previously saved profile", () => {
      saveNewWaterProfile("My Tap", SAMPLE);
      const list = loadSavedWaterProfiles();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("My Tap");
      expect(list[0].profile).toEqual(SAMPLE);
    });
  });

  describe("saveNewWaterProfile", () => {
    test("returns an item with a non-empty id, the name, and the profile", () => {
      const item = saveNewWaterProfile("Filtered", SAMPLE);
      expect(typeof item.id).toBe("string");
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.name).toBe("Filtered");
      expect(item.profile).toEqual(SAMPLE);
    });

    test("prepends new profiles (newest first)", () => {
      const first = saveNewWaterProfile("First", SAMPLE);
      const second = saveNewWaterProfile("Second", SAMPLE);
      const list = loadSavedWaterProfiles();
      expect(list[0].id).toBe(second.id);
      expect(list[1].id).toBe(first.id);
    });

    test("assigns unique ids to distinct saves", () => {
      const a = saveNewWaterProfile("A", SAMPLE);
      const b = saveNewWaterProfile("B", SAMPLE);
      expect(a.id).not.toBe(b.id);
    });
  });

  describe("updateSavedWaterProfile", () => {
    test("updates name and profile for an existing id", () => {
      const item = saveNewWaterProfile("Old", SAMPLE);
      const newProfile: WaterProfile = { ...SAMPLE, Ca: 120 };
      const updated = updateSavedWaterProfile(item.id, "New", newProfile);
      expect(updated).not.toBeNull();
      expect(updated!.id).toBe(item.id);
      expect(updated!.name).toBe("New");
      expect(updated!.profile.Ca).toBe(120);
      // Persisted change is visible on reload.
      expect(loadSavedWaterProfiles()[0].name).toBe("New");
    });

    test("returns null for an unknown id and stores nothing new", () => {
      const result = updateSavedWaterProfile("does-not-exist", "X", SAMPLE);
      expect(result).toBeNull();
      expect(loadSavedWaterProfiles()).toEqual([]);
    });

    test("preserves the position of other profiles", () => {
      const a = saveNewWaterProfile("A", SAMPLE); // ends at index 1 after b
      const b = saveNewWaterProfile("B", SAMPLE); // index 0
      updateSavedWaterProfile(a.id, "A-renamed", SAMPLE);
      const list = loadSavedWaterProfiles();
      // b stays at the front; a stays at index 1 (just renamed in place)
      expect(list[0].id).toBe(b.id);
      expect(list[1].id).toBe(a.id);
      expect(list[1].name).toBe("A-renamed");
    });
  });

  describe("deleteSavedWaterProfile", () => {
    test("removes the matching profile", () => {
      const a = saveNewWaterProfile("A", SAMPLE);
      const b = saveNewWaterProfile("B", SAMPLE);
      deleteSavedWaterProfile(a.id);
      const list = loadSavedWaterProfiles();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(b.id);
    });

    test("deleting an unknown id leaves the list intact", () => {
      saveNewWaterProfile("A", SAMPLE);
      deleteSavedWaterProfile("nope");
      expect(loadSavedWaterProfiles()).toHaveLength(1);
    });

    test("deleting from an empty store is a no-op", () => {
      expect(() => deleteSavedWaterProfile("anything")).not.toThrow();
      expect(loadSavedWaterProfiles()).toEqual([]);
    });
  });
});
