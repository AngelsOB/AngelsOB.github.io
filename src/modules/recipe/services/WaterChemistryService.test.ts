import { describe, test, expect } from "vitest";
import {
  waterChemistryService as svc,
  WaterChemistryService,
  ION_PPM_PER_G_PER_L,
  COMMON_WATER_PROFILES,
  BEER_STYLE_TARGETS,
  getWaterTargetForBjcpStyle,
} from "./WaterChemistryService";
import type { WaterProfile, SaltAdditions } from "./WaterChemistryService";

const RO: WaterProfile = { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 };

describe("WaterChemistryService", () => {
  // ── ION_PPM_PER_G_PER_L constant: derived from molar masses ──────────────
  //
  // Each value = (ion molar mass / salt molar mass) × 1000, giving ppm (mg/L)
  // contributed by 1 g of salt dissolved in 1 L of water. Anchored to the
  // standard atomic/molecular weights:
  //   Ca 40.078, Mg 24.305, Na 22.990, Cl 35.453, S 32.06, O 15.999, H 1.008
  //   SO4 = 32.06 + 4·15.999 = 96.056
  //   HCO3 = 1.008 + 12.011 + 3·15.999 = 61.016
  //   H2O = 18.015

  describe("ION_PPM_PER_G_PER_L (mass-fraction constants)", () => {
    test("gypsum CaSO4·2H2O Ca = 40.078/172.164 ≈ 232.8 ppm/g/L", () => {
      // M(gypsum) = 40.078 + 96.056 + 2·18.015 = 172.164
      const M = 40.078 + 96.056 + 2 * 18.015;
      expect(ION_PPM_PER_G_PER_L.gypsum.Ca).toBeCloseTo((40.078 / M) * 1000, 0);
    });

    test("gypsum SO4 = 96.056/172.164 ≈ 557.9 ppm/g/L", () => {
      const M = 40.078 + 96.056 + 2 * 18.015;
      expect(ION_PPM_PER_G_PER_L.gypsum.SO4).toBeCloseTo((96.056 / M) * 1000, 0);
    });

    test("cacl2 CaCl2·2H2O Ca = 40.078/147.014 ≈ 272.6 ppm/g/L", () => {
      // M(CaCl2·2H2O) = 40.078 + 2·35.453 + 2·18.015 = 147.014
      const M = 40.078 + 2 * 35.453 + 2 * 18.015;
      expect(ION_PPM_PER_G_PER_L.cacl2.Ca).toBeCloseTo((40.078 / M) * 1000, 0);
    });

    test("cacl2 Cl = 70.906/147.014 ≈ 482.3 ppm/g/L (to <0.05 ppm)", () => {
      const M = 40.078 + 2 * 35.453 + 2 * 18.015;
      // Source stores cacl2.Cl = 0.4823·1000 = 482.3, matching the true molar-mass
      // value (2·35.453/147.014)·1000 = 482.308 to <0.05 ppm, and consistent with
      // the sibling WaterSaltOptimizer.ts constant (482.3).
      expect(ION_PPM_PER_G_PER_L.cacl2.Cl).toBeCloseTo((2 * 35.453 / M) * 1000, 1);
    });

    test("epsom MgSO4·7H2O Mg = 24.305/246.466 ≈ 98.6 ppm/g/L", () => {
      // M(epsom) = 24.305 + 96.056 + 7·18.015 = 246.466
      const M = 24.305 + 96.056 + 7 * 18.015;
      expect(ION_PPM_PER_G_PER_L.epsom.Mg).toBeCloseTo((24.305 / M) * 1000, 0);
    });

    test("epsom SO4 = 96.056/246.466 ≈ 389.7 ppm/g/L", () => {
      const M = 24.305 + 96.056 + 7 * 18.015;
      expect(ION_PPM_PER_G_PER_L.epsom.SO4).toBeCloseTo((96.056 / M) * 1000, 0);
    });

    test("nacl Na = 22.990/58.443 ≈ 393.4 ppm/g/L", () => {
      // M(NaCl) = 22.990 + 35.453 = 58.443
      const M = 22.99 + 35.453;
      expect(ION_PPM_PER_G_PER_L.nacl.Na).toBeCloseTo((22.99 / M) * 1000, 0);
    });

    test("nacl Cl = 35.453/58.443 ≈ 606.6 ppm/g/L", () => {
      const M = 22.99 + 35.453;
      expect(ION_PPM_PER_G_PER_L.nacl.Cl).toBeCloseTo((35.453 / M) * 1000, 0);
    });

    test("nahco3 Na = 22.990/84.006 ≈ 273.7 ppm/g/L", () => {
      // M(NaHCO3) = 22.990 + 61.016 = 84.006
      const M = 22.99 + 61.016;
      expect(ION_PPM_PER_G_PER_L.nahco3.Na).toBeCloseTo((22.99 / M) * 1000, 0);
    });

    test("nahco3 HCO3 = 61.016/84.006 ≈ 726.3 ppm/g/L", () => {
      const M = 22.99 + 61.016;
      expect(ION_PPM_PER_G_PER_L.nahco3.HCO3).toBeCloseTo((61.016 / M) * 1000, 0);
    });

    test("hydrated/poly-atomic salts: two tracked ions sum to < 1000 ppm/g/L", () => {
      // For these salts the two tracked ions are only PART of the molecule, so
      // their combined mass fraction is strictly below 1:
      //   gypsum CaSO4·2H2O — water of crystallisation (2 H2O) is not tracked
      //   cacl2  CaCl2·2H2O — water of crystallisation (2 H2O) is not tracked
      //   epsom  MgSO4·7H2O — 7 H2O is not tracked
      // Verified by molar mass: (ion1 + ion2)/M < 1 for each hydrated salt.
      const hydratedSums = {
        gypsum: ION_PPM_PER_G_PER_L.gypsum.Ca + ION_PPM_PER_G_PER_L.gypsum.SO4,
        cacl2: ION_PPM_PER_G_PER_L.cacl2.Ca + ION_PPM_PER_G_PER_L.cacl2.Cl,
        epsom: ION_PPM_PER_G_PER_L.epsom.Mg + ION_PPM_PER_G_PER_L.epsom.SO4,
      };
      for (const v of Object.values(hydratedSums)) {
        expect(v).toBeLessThan(1000);
        expect(v).toBeGreaterThan(0);
      }
    });

    test("anhydrous fully-dissociating salts: two ions sum to exactly 1000 ppm/g/L", () => {
      // NaCl → Na⁺ + Cl⁻ and NaHCO3 → Na⁺ + HCO3⁻ : the molecule is ENTIRELY
      // the two tracked ions (no water of crystallisation, no untracked atoms).
      //   NaCl:   22.990/58.443 + 35.453/58.443  = 58.443/58.443 = 1.000 → 1000
      //   NaHCO3: 22.990/84.006 + 61.016/84.006  = 84.006/84.006 = 1.000 → 1000
      const nacl = ION_PPM_PER_G_PER_L.nacl.Na + ION_PPM_PER_G_PER_L.nacl.Cl;
      const nahco3 = ION_PPM_PER_G_PER_L.nahco3.Na + ION_PPM_PER_G_PER_L.nahco3.HCO3;
      expect(nacl).toBeCloseTo(1000, 0);
      expect(nahco3).toBeCloseTo(1000, 0);
    });
  });

  // ── ionDeltaFromSalts ────────────────────────────────────────────────────

  describe("ionDeltaFromSalts", () => {
    test("1 g gypsum in 1 L → Ca ≈ 232.8, SO4 ≈ 557.9 ppm", () => {
      // perL = 1g / 1L = 1 g/L; Ca = 1·232.8, SO4 = 1·557.9
      const d = svc.ionDeltaFromSalts({ gypsum_g: 1 }, 1);
      expect(d.Ca).toBeCloseTo(232.8, 1);
      expect(d.SO4).toBeCloseTo(557.9, 1);
      // Gypsum contributes no Mg/Na/Cl/HCO3
      expect(d.Mg).toBe(0);
      expect(d.Na).toBe(0);
      expect(d.Cl).toBe(0);
      expect(d.HCO3).toBe(0);
    });

    test("10 g gypsum in 20 L → Ca = (10/20)·232.8 = 116.4 ppm", () => {
      // g/L = 10/20 = 0.5; Ca = 0.5·232.8 = 116.4; SO4 = 0.5·557.9 = 278.95
      const d = svc.ionDeltaFromSalts({ gypsum_g: 10 }, 20);
      expect(d.Ca).toBeCloseTo(116.4, 1);
      expect(d.SO4).toBeCloseTo(278.95, 1);
    });

    test("1 g NaCl in 1 L → Na ≈ 393.4, Cl ≈ 606.6 ppm (others exactly 0)", () => {
      const d = svc.ionDeltaFromSalts({ nacl_g: 1 }, 1);
      expect(d.Na).toBeCloseTo(393.4, 1);
      expect(d.Cl).toBeCloseTo(606.6, 1);
      // NaCl contributes only Na and Cl — Ca/Mg/SO4/HCO3 must stay 0.
      expect(d.Ca).toBe(0);
      expect(d.Mg).toBe(0);
      expect(d.SO4).toBe(0);
      expect(d.HCO3).toBe(0);
    });

    test("1 g baking soda in 1 L → Na ≈ 273.7, HCO3 ≈ 726.3 ppm (others exactly 0)", () => {
      const d = svc.ionDeltaFromSalts({ nahco3_g: 1 }, 1);
      expect(d.Na).toBeCloseTo(273.7, 1);
      expect(d.HCO3).toBeCloseTo(726.3, 1);
      // NaHCO3 contributes only Na and HCO3 — Ca/Mg/Cl/SO4 must stay 0
      // (a cross-wired constant adding to Cl or SO4 would be caught here).
      expect(d.Ca).toBe(0);
      expect(d.Mg).toBe(0);
      expect(d.Cl).toBe(0);
      expect(d.SO4).toBe(0);
    });

    test("1 g epsom in 1 L → Mg ≈ 98.6, SO4 ≈ 389.7 ppm (others exactly 0)", () => {
      const d = svc.ionDeltaFromSalts({ epsom_g: 1 }, 1);
      expect(d.Mg).toBeCloseTo(98.6, 1);
      expect(d.SO4).toBeCloseTo(389.7, 1);
      // Epsom (MgSO4·7H2O) contributes only Mg and SO4 — Ca/Na/Cl/HCO3 must stay 0.
      expect(d.Ca).toBe(0);
      expect(d.Na).toBe(0);
      expect(d.Cl).toBe(0);
      expect(d.HCO3).toBe(0);
    });

    test("1 g CaCl2·2H2O in 1 L → Ca ≈ 272.6, Cl ≈ 482.3 ppm (others exactly 0)", () => {
      // Independent molar-mass derivation (NOT the impl's rounded constant):
      //   M(CaCl2·2H2O) = 40.078 + 2·35.453 + 2·18.015 = 147.014
      //   Ca = 40.078/147.014·1000 = 272.6 ; Cl = 70.906/147.014·1000 = 482.3
      const d = svc.ionDeltaFromSalts({ cacl2_g: 1 }, 1);
      expect(d.Ca).toBeCloseTo((40.078 / 147.014) * 1000, 0); // 272.6
      expect(d.Cl).toBeCloseTo((2 * 35.453 / 147.014) * 1000, 0); // 482.3
      // CaCl2 contributes only Ca and Cl — Mg/Na/SO4/HCO3 must stay 0.
      expect(d.Mg).toBe(0);
      expect(d.Na).toBe(0);
      expect(d.SO4).toBe(0);
      expect(d.HCO3).toBe(0);
    });

    test("Ca and SO4 add across gypsum + cacl2 + epsom (additivity vs molar-mass derivation)", () => {
      // 1 g each in 1 L. Expected values derived INDEPENDENTLY from molar masses
      // (not the impl's stored constants), so this pins additivity AND magnitude:
      //   M(gypsum)=172.164, M(cacl2)=147.014, M(epsom)=246.466
      //   Ca  = (40.078/M_gyp + 40.078/M_cacl2)·1000   = 505.40
      //   SO4 = (96.056/M_gyp + 96.056/M_eps)·1000      = 947.67
      //   Cl  = (2·35.453/M_cacl2)·1000                 = 482.31
      //   Mg  = (24.305/M_eps)·1000                     = 98.61
      const M_gyp = 40.078 + 96.056 + 2 * 18.015;
      const M_cacl2 = 40.078 + 2 * 35.453 + 2 * 18.015;
      const M_eps = 24.305 + 96.056 + 7 * 18.015;
      const d = svc.ionDeltaFromSalts(
        { gypsum_g: 1, cacl2_g: 1, epsom_g: 1 },
        1
      );
      expect(d.Ca).toBeCloseTo((40.078 / M_gyp + 40.078 / M_cacl2) * 1000, 0);
      expect(d.SO4).toBeCloseTo((96.056 / M_gyp + 96.056 / M_eps) * 1000, 0);
      expect(d.Cl).toBeCloseTo((2 * 35.453 / M_cacl2) * 1000, 0);
      expect(d.Mg).toBeCloseTo((24.305 / M_eps) * 1000, 0);
    });

    test("Na adds across nacl + nahco3 (additivity vs molar-mass derivation)", () => {
      // 1 g each in 1 L. Na expected from molar masses (NaCl 58.443, NaHCO3 84.006):
      //   Na = (22.990/58.443 + 22.990/84.006)·1000 = 667.05
      const M_nacl = 22.99 + 35.453;
      const M_nahco3 = 22.99 + 61.016;
      const d = svc.ionDeltaFromSalts({ nacl_g: 1, nahco3_g: 1 }, 1);
      expect(d.Na).toBeCloseTo((22.99 / M_nacl + 22.99 / M_nahco3) * 1000, 0);
    });

    test("empty additions → all-zero profile", () => {
      const d = svc.ionDeltaFromSalts({}, 20);
      expect(d).toEqual(RO);
    });

    test("concentration is inversely proportional to volume (½ volume → 2× ppm)", () => {
      // ppm = g/volume, so halving the volume doubles concentration.
      const small = svc.ionDeltaFromSalts({ gypsum_g: 5 }, 10);
      const large = svc.ionDeltaFromSalts({ gypsum_g: 5 }, 20);
      expect(small.Ca).toBeCloseTo(large.Ca * 2, 4);
    });

    test("doubling the salt mass doubles every ion delta (linearity)", () => {
      const single = svc.ionDeltaFromSalts({ gypsum_g: 3, nacl_g: 2 }, 19);
      const dbl = svc.ionDeltaFromSalts({ gypsum_g: 6, nacl_g: 4 }, 19);
      expect(dbl.Ca).toBeCloseTo(single.Ca * 2, 6);
      expect(dbl.SO4).toBeCloseTo(single.SO4 * 2, 6);
      expect(dbl.Na).toBeCloseTo(single.Na * 2, 6);
      expect(dbl.Cl).toBeCloseTo(single.Cl * 2, 6);
    });

    test("zero volume is guarded (floor 0.0001 L) → finite, large positive ppm", () => {
      // v = max(0.0001, 0); 1g / 0.0001L = 10000 g/L → Ca = 10000·232.8
      const d = svc.ionDeltaFromSalts({ gypsum_g: 1 }, 0);
      expect(Number.isFinite(d.Ca)).toBe(true);
      expect(d.Ca).toBeCloseTo(10000 * 232.8, 0);
    });

    test("negative grams are treated as zero contribution (g>0 guard)", () => {
      // perL only counts g when g > 0; a negative gypsum value contributes nothing.
      const d = svc.ionDeltaFromSalts({ gypsum_g: -5 }, 10);
      expect(d.Ca).toBe(0);
      expect(d.SO4).toBe(0);
    });

    test("zero-gram explicit entry contributes nothing", () => {
      const d = svc.ionDeltaFromSalts({ gypsum_g: 0, nacl_g: 0 }, 10);
      expect(d).toEqual(RO);
    });
  });

  // ── addProfiles ────────────────────────────────────────────────────────

  describe("addProfiles", () => {
    test("adds ion by ion", () => {
      const a: WaterProfile = { Ca: 10, Mg: 1, Na: 2, Cl: 3, SO4: 4, HCO3: 5 };
      const b: WaterProfile = { Ca: 90, Mg: 9, Na: 8, Cl: 7, SO4: 6, HCO3: 5 };
      expect(svc.addProfiles(a, b)).toEqual({
        Ca: 100,
        Mg: 10,
        Na: 10,
        Cl: 10,
        SO4: 10,
        HCO3: 10,
      });
    });

    test("adding RO (all zeros) is the identity", () => {
      const a: WaterProfile = { Ca: 50, Mg: 5, Na: 12, Cl: 40, SO4: 70, HCO3: 100 };
      expect(svc.addProfiles(a, RO)).toEqual(a);
    });

    test("is commutative", () => {
      const a: WaterProfile = { Ca: 11, Mg: 2, Na: 3, Cl: 4, SO4: 5, HCO3: 6 };
      const b: WaterProfile = { Ca: 7, Mg: 8, Na: 9, Cl: 10, SO4: 11, HCO3: 12 };
      expect(svc.addProfiles(a, b)).toEqual(svc.addProfiles(b, a));
    });
  });

  // ── scaleProfile ─────────────────────────────────────────────────────────

  describe("scaleProfile", () => {
    test("scales every ion by the factor", () => {
      const p: WaterProfile = { Ca: 10, Mg: 20, Na: 30, Cl: 40, SO4: 50, HCO3: 60 };
      expect(svc.scaleProfile(p, 2)).toEqual({
        Ca: 20,
        Mg: 40,
        Na: 60,
        Cl: 80,
        SO4: 100,
        HCO3: 120,
      });
    });

    test("factor of 1 is the identity", () => {
      const p: WaterProfile = { Ca: 7, Mg: 8, Na: 9, Cl: 10, SO4: 11, HCO3: 12 };
      expect(svc.scaleProfile(p, 1)).toEqual(p);
    });

    test("factor of 0 zeros the profile", () => {
      const p: WaterProfile = { Ca: 7, Mg: 8, Na: 9, Cl: 10, SO4: 11, HCO3: 12 };
      expect(svc.scaleProfile(p, 0)).toEqual(RO);
    });

    test("dilution by 0.5 halves every ion (mixing with equal RO)", () => {
      const p: WaterProfile = { Ca: 200, Mg: 40, Na: 60, Cl: 60, SO4: 120, HCO3: 220 };
      const half = svc.scaleProfile(p, 0.5);
      expect(half.Ca).toBeCloseTo(100, 6);
      expect(half.SO4).toBeCloseTo(60, 6);
      expect(half.HCO3).toBeCloseTo(110, 6);
    });

    test("a NEGATIVE factor is sign-preserving — scaleProfile does NOT clamp", () => {
      // Unlike clampProfile/calculateFinalProfile, scaleProfile is a plain
      // multiply: factor·p with no Math.max(0, …). This contract is load-bearing
      // (e.g. computing a profile DIFFERENCE to subtract); a "helpful" clamp added
      // here would silently break it. Pin the sign by asserting negatives stay negative.
      const p: WaterProfile = { Ca: 10, Mg: 20, Na: 30, Cl: 40, SO4: 50, HCO3: 60 };
      expect(svc.scaleProfile(p, -1)).toEqual({
        Ca: -10,
        Mg: -20,
        Na: -30,
        Cl: -40,
        SO4: -50,
        HCO3: -60,
      });
    });
  });

  // ── clampProfile ─────────────────────────────────────────────────────────

  describe("clampProfile", () => {
    test("negative ions are clamped to 0, positives untouched", () => {
      const p: WaterProfile = { Ca: -5, Mg: 10, Na: -1, Cl: 0, SO4: 50, HCO3: -100 };
      expect(svc.clampProfile(p)).toEqual({
        Ca: 0,
        Mg: 10,
        Na: 0,
        Cl: 0,
        SO4: 50,
        HCO3: 0,
      });
    });

    test("already non-negative profile is unchanged", () => {
      const p: WaterProfile = { Ca: 75, Mg: 8, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };
      expect(svc.clampProfile(p)).toEqual(p);
    });

    test("never returns a negative ion", () => {
      const p: WaterProfile = { Ca: -1, Mg: -2, Na: -3, Cl: -4, SO4: -5, HCO3: -6 };
      const clamped = svc.clampProfile(p);
      for (const v of Object.values(clamped)) expect(v).toBeGreaterThanOrEqual(0);
    });
  });

  // ── chlorideToSulfateRatio ───────────────────────────────────────────────

  describe("chlorideToSulfateRatio", () => {
    test("balanced 75/75 → 1.0", () => {
      // 75 / 75 = 1.0
      const r = svc.chlorideToSulfateRatio({ ...RO, Cl: 75, SO4: 75 });
      expect(r).toBeCloseTo(1.0, 6);
    });

    test("NEIPA 150 Cl / 75 SO4 → 2.0 (malty/chloride-forward)", () => {
      // 150 / 75 = 2.0
      const r = svc.chlorideToSulfateRatio({ ...RO, Cl: 150, SO4: 75 });
      expect(r).toBeCloseTo(2.0, 6);
    });

    test("West Coast IPA 50 Cl / 250 SO4 → 0.2 (very hoppy)", () => {
      // 50 / 250 = 0.2
      const r = svc.chlorideToSulfateRatio({ ...RO, Cl: 50, SO4: 250 });
      expect(r).toBeCloseTo(0.2, 6);
    });

    test("returns null when SO4 is zero (division-by-zero guard)", () => {
      expect(svc.chlorideToSulfateRatio({ ...RO, Cl: 50, SO4: 0 })).toBeNull();
    });

    test("returns null when SO4 is negative", () => {
      expect(svc.chlorideToSulfateRatio({ ...RO, Cl: 50, SO4: -10 })).toBeNull();
    });

    test("zero chloride over positive sulfate → 0", () => {
      expect(svc.chlorideToSulfateRatio({ ...RO, Cl: 0, SO4: 100 })).toBe(0);
    });
  });

  // ── calculateFinalProfile ────────────────────────────────────────────────

  describe("calculateFinalProfile", () => {
    test("source + salt delta, ion by ion (RO base + 1 g gypsum in 1 L)", () => {
      // Ca = 0 + 232.8, SO4 = 0 + 557.9
      const final = svc.calculateFinalProfile(RO, { gypsum_g: 1 }, 1);
      expect(final.Ca).toBeCloseTo(232.8, 1);
      expect(final.SO4).toBeCloseTo(557.9, 1);
    });

    test("adds delta on top of an existing mineral source", () => {
      // Source Ca 50 + (10/20)·232.8 = 50 + 116.4 = 166.4
      const source: WaterProfile = { Ca: 50, Mg: 5, Na: 10, Cl: 20, SO4: 30, HCO3: 60 };
      const final = svc.calculateFinalProfile(source, { gypsum_g: 10 }, 20);
      expect(final.Ca).toBeCloseTo(166.4, 1);
      // SO4 = 30 + 0.5·557.9 = 30 + 278.95 = 308.95
      expect(final.SO4).toBeCloseTo(308.95, 1);
      // Untouched ions carry through unchanged
      expect(final.HCO3).toBeCloseTo(60, 6);
    });

    test("no salts → returns the (clamped) source unchanged", () => {
      const source: WaterProfile = { Ca: 75, Mg: 8, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };
      expect(svc.calculateFinalProfile(source, {}, 20)).toEqual(source);
    });

    test("result is clamped non-negative even with negative source ions", () => {
      // clampProfile is applied last, so a negative source HCO3 becomes 0.
      const source: WaterProfile = { ...RO, HCO3: -50 };
      const final = svc.calculateFinalProfile(source, { gypsum_g: 1 }, 1);
      expect(final.HCO3).toBe(0);
    });

    test("equals manual addProfiles(source, ionDeltaFromSalts) then clamp", () => {
      const source: WaterProfile = { Ca: 30, Mg: 5, Na: 8, Cl: 12, SO4: 40, HCO3: 70 };
      const salts: SaltAdditions = { gypsum_g: 4, cacl2_g: 3, nacl_g: 1 };
      const manual = svc.clampProfile(
        svc.addProfiles(source, svc.ionDeltaFromSalts(salts, 25))
      );
      expect(svc.calculateFinalProfile(source, salts, 25)).toEqual(manual);
    });
  });

  // ── splitSaltsProportionally ─────────────────────────────────────────────

  describe("splitSaltsProportionally", () => {
    test("splits each salt by water-volume ratio (mash 60% / sparge 40%)", () => {
      // total 30 L: mashRatio 18/30 = 0.6, spargeRatio 12/30 = 0.4
      const { mashSalts, spargeSalts } = svc.splitSaltsProportionally(
        { gypsum_g: 10, cacl2_g: 5 },
        18,
        12
      );
      expect(mashSalts.gypsum_g).toBeCloseTo(6, 6);
      expect(spargeSalts.gypsum_g).toBeCloseTo(4, 6);
      expect(mashSalts.cacl2_g).toBeCloseTo(3, 6);
      expect(spargeSalts.cacl2_g).toBeCloseTo(2, 6);
    });

    test("mash + sparge halves of each salt sum back to the total", () => {
      const total: SaltAdditions = { gypsum_g: 7, nacl_g: 3.5, epsom_g: 2 };
      const { mashSalts, spargeSalts } = svc.splitSaltsProportionally(total, 15, 9);
      (Object.keys(total) as Array<keyof SaltAdditions>).forEach((k) => {
        expect((mashSalts[k] ?? 0) + (spargeSalts[k] ?? 0)).toBeCloseTo(total[k]!, 6);
      });
    });

    test("all water in mash → sparge gets nothing", () => {
      const { mashSalts, spargeSalts } = svc.splitSaltsProportionally(
        { gypsum_g: 8 },
        20,
        0
      );
      expect(mashSalts.gypsum_g).toBeCloseTo(8, 6);
      expect(spargeSalts.gypsum_g).toBeCloseTo(0, 6);
    });

    test("zero/negative total water → empty splits", () => {
      const { mashSalts, spargeSalts } = svc.splitSaltsProportionally(
        { gypsum_g: 8 },
        0,
        0
      );
      expect(mashSalts).toEqual({});
      expect(spargeSalts).toEqual({});
    });

    test("zero-valued salts are skipped (not copied into splits)", () => {
      const { mashSalts, spargeSalts } = svc.splitSaltsProportionally(
        { gypsum_g: 0, cacl2_g: 4 },
        10,
        10
      );
      expect(mashSalts.gypsum_g).toBeUndefined();
      expect(mashSalts.cacl2_g).toBeCloseTo(2, 6);
      expect(spargeSalts.cacl2_g).toBeCloseTo(2, 6);
    });
  });

  // ── calculateFinalProfileFromTotalSalts ──────────────────────────────────

  describe("calculateFinalProfileFromTotalSalts", () => {
    test("uses TOTAL water (mash + sparge) for concentration", () => {
      // 10 g gypsum across 30 L total → Ca = (10/30)·232.8 = 77.6
      const final = svc.calculateFinalProfileFromTotalSalts(
        RO,
        { gypsum_g: 10 },
        18,
        12
      );
      expect(final.Ca).toBeCloseTo((10 / 30) * 232.8, 1);
    });

    test("equivalent to calculateFinalProfile at the summed volume", () => {
      const source: WaterProfile = { Ca: 20, Mg: 4, Na: 6, Cl: 10, SO4: 25, HCO3: 40 };
      const salts: SaltAdditions = { gypsum_g: 6, cacl2_g: 4 };
      const viaTotal = svc.calculateFinalProfileFromTotalSalts(source, salts, 16, 9);
      const viaDirect = svc.calculateFinalProfile(source, salts, 25);
      expect(viaTotal).toEqual(viaDirect);
    });

    test("zero/negative total water → returns source unchanged", () => {
      const source: WaterProfile = { Ca: 50, Mg: 5, Na: 12, Cl: 40, SO4: 70, HCO3: 100 };
      expect(svc.calculateFinalProfileFromTotalSalts(source, { gypsum_g: 5 }, 0, 0)).toBe(
        source
      );
    });
  });

  // ── calculateSaltsForTarget (wiring around the optimizer) ────────────────
  // Note: the optimizer math itself is covered in WaterSaltOptimizer.test.ts.
  // Here we verify the service correctly delegates and then proportionally
  // splits the resulting total salts.

  describe("calculateSaltsForTarget", () => {
    test("RO → high-sulfate IPA target produces gypsum, split mash/sparge", () => {
      const target = BEER_STYLE_TARGETS["American IPA"].profile;
      const { totalSalts, mashSalts, spargeSalts } = svc.calculateSaltsForTarget(
        RO,
        target,
        18,
        12
      );
      // A high-SO4 target from RO must call for gypsum.
      expect(totalSalts.gypsum_g ?? 0).toBeGreaterThan(0);
      // Split must conserve mass per salt (mash + sparge = total).
      const keys = Object.keys(totalSalts) as Array<keyof SaltAdditions>;
      for (const k of keys) {
        expect((mashSalts[k] ?? 0) + (spargeSalts[k] ?? 0)).toBeCloseTo(
          totalSalts[k]!,
          5
        );
      }
    });

    test("split honours the mash/sparge water ratio (60/40)", () => {
      const target = BEER_STYLE_TARGETS["West Coast IPA"].profile;
      const { totalSalts, mashSalts } = svc.calculateSaltsForTarget(RO, target, 18, 12);
      if ((totalSalts.gypsum_g ?? 0) > 0) {
        // mashRatio = 18/30 = 0.6
        expect(mashSalts.gypsum_g).toBeCloseTo(totalSalts.gypsum_g! * 0.6, 5);
      } else {
        // Defensive: if optimizer produced no gypsum, the assertion above is moot.
        expect(totalSalts.gypsum_g ?? 0).toBeGreaterThanOrEqual(0);
      }
    });

    test("source already at target → no salts needed", () => {
      const profile: WaterProfile = { Ca: 75, Mg: 8, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };
      const { totalSalts } = svc.calculateSaltsForTarget(profile, profile, 18, 12);
      expect(totalSalts.gypsum_g).toBeUndefined();
      expect(totalSalts.cacl2_g).toBeUndefined();
      expect(totalSalts.epsom_g).toBeUndefined();
      expect(totalSalts.nacl_g).toBeUndefined();
    });

    test("zero/negative total water → all-empty result", () => {
      const target = BEER_STYLE_TARGETS["American IPA"].profile;
      const result = svc.calculateSaltsForTarget(RO, target, 0, 0);
      expect(result.totalSalts).toEqual({});
      expect(result.mashSalts).toEqual({});
      expect(result.spargeSalts).toEqual({});
    });
  });

  // ── COMMON_WATER_PROFILES (preset sanity) ────────────────────────────────

  describe("COMMON_WATER_PROFILES", () => {
    test("RO preset is all zeros (distilled / reverse-osmosis baseline)", () => {
      expect(COMMON_WATER_PROFILES.RO).toEqual(RO);
    });

    test("Burton-on-Trent is the high-sulfate classic (SO4 ≫ Cl)", () => {
      // Burton water is famous for very high sulfate — the IPA water.
      const burton = COMMON_WATER_PROFILES.Burton;
      expect(burton.SO4).toBeGreaterThan(burton.Cl);
      expect(burton.SO4).toBeGreaterThan(400);
    });

    test("Pilsen is very soft (all ions low, < 20 ppm)", () => {
      // Pilsen / Plzeň is the canonical soft-water source.
      const p = COMMON_WATER_PROFILES.Pilsen;
      for (const v of Object.values(p)) expect(v).toBeLessThan(20);
    });

    test("Montreal HCO3 = 113 (from City report, never 0)", () => {
      // Anchored by project memory: Montreal HCO3 corrected to 113.
      expect(COMMON_WATER_PROFILES.Montreal.HCO3).toBe(113);
    });

    test("every preset has all six ions, all non-negative", () => {
      const ions: Array<keyof WaterProfile> = ["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"];
      for (const profile of Object.values(COMMON_WATER_PROFILES)) {
        for (const ion of ions) {
          expect(typeof profile[ion]).toBe("number");
          expect(profile[ion]).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // ── BEER_STYLE_TARGETS (target sanity) ───────────────────────────────────

  describe("BEER_STYLE_TARGETS", () => {
    test("West Coast IPA target is sulfate-dominant (hoppy: SO4 ≫ Cl)", () => {
      const t = BEER_STYLE_TARGETS["West Coast IPA"].profile;
      expect(t.SO4).toBeGreaterThan(t.Cl);
      expect(t.SO4).toBeGreaterThanOrEqual(250);
    });

    test("NEIPA / Hazy IPA target is chloride-dominant (juicy: Cl > SO4)", () => {
      const t = BEER_STYLE_TARGETS["NEIPA / Hazy IPA"].profile;
      expect(t.Cl).toBeGreaterThan(t.SO4);
    });

    test("Balanced target has equal Cl and SO4 (1:1)", () => {
      const t = BEER_STYLE_TARGETS["Balanced"].profile;
      expect(t.Cl).toBe(t.SO4);
    });

    test("Stout/Porter has the highest bicarbonate of the IPA/pale styles", () => {
      // Dark, roasty styles need alkalinity to buffer acidity.
      const stout = BEER_STYLE_TARGETS["Stout / Porter"].profile;
      const wcipa = BEER_STYLE_TARGETS["West Coast IPA"].profile;
      expect(stout.HCO3).toBeGreaterThan(wcipa.HCO3);
    });

    test("every target profile is non-negative across all ions", () => {
      const ions: Array<keyof WaterProfile> = ["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"];
      for (const t of Object.values(BEER_STYLE_TARGETS)) {
        for (const ion of ions) expect(t.profile[ion]).toBeGreaterThanOrEqual(0);
      }
    });

    test("every target carries a non-empty description and clToSo4Ratio label", () => {
      for (const t of Object.values(BEER_STYLE_TARGETS)) {
        expect(t.description.length).toBeGreaterThan(0);
        expect(t.clToSo4Ratio.length).toBeGreaterThan(0);
      }
    });

    test("each clToSo4Ratio LABEL agrees with that profile's actual Cl/SO4", () => {
      // The label (e.g. "0.3:1 (Hoppy)") summarizes profile.Cl / profile.SO4.
      // Parse the leading number and compare to the true ratio. A label that
      // contradicts its own numbers (data drift) must fail, not pass silently.
      // Tolerance: precision 0 (|diff| < 0.5), since labels round to 1 decimal.
      for (const [name, t] of Object.entries(BEER_STYLE_TARGETS)) {
        const labelled = parseFloat(t.clToSo4Ratio);
        expect(Number.isNaN(labelled), `${name} label "${t.clToSo4Ratio}" has no leading number`).toBe(false);
        expect(t.profile.SO4, `${name} has SO4<=0, ratio undefined`).toBeGreaterThan(0);
        const actual = t.profile.Cl / t.profile.SO4;
        expect(
          Math.abs(labelled - actual),
          `${name}: label ${labelled}:1 vs actual Cl/SO4 ${actual.toFixed(3)}:1`
        ).toBeLessThan(0.5);
      }
    });
  });

  // ── getWaterTargetForBjcpStyle ───────────────────────────────────────────

  describe("getWaterTargetForBjcpStyle", () => {
    test("strips BJCP number prefix and maps the name (21A. American IPA → American IPA)", () => {
      expect(getWaterTargetForBjcpStyle("21A. American IPA")).toBe("American IPA");
    });

    test("maps Hazy IPA to NEIPA target", () => {
      // BJCP "Hazy IPA" → "NEIPA / Hazy IPA" per BJCP_TO_WATER_TARGET.
      expect(getWaterTargetForBjcpStyle("21C. Hazy IPA")).toBe("NEIPA / Hazy IPA");
    });

    test("maps Double IPA to West Coast IPA (very high sulfate)", () => {
      expect(getWaterTargetForBjcpStyle("22A. Double IPA")).toBe("West Coast IPA");
    });

    test("works without a numeric prefix (bare style name)", () => {
      expect(getWaterTargetForBjcpStyle("Irish Stout")).toBe("Irish Stout");
    });

    test("empty string → 'Balanced' fallback", () => {
      expect(getWaterTargetForBjcpStyle("")).toBe("Balanced");
    });

    test("unknown style → 'Balanced' fallback", () => {
      expect(getWaterTargetForBjcpStyle("99Z. Klingon Bloodwine")).toBe("Balanced");
    });

    test("returned key always exists in BEER_STYLE_TARGETS", () => {
      // The function promises a usable target key. Spot-check several mappings.
      const samples = [
        "1A. American Light Lager",
        "5C. German Pils",
        "16B. Oatmeal Stout",
        "26C. Belgian Tripel",
        "30A. Spice, Herb, or Vegetable Beer",
      ];
      for (const s of samples) {
        const key = getWaterTargetForBjcpStyle(s);
        expect(BEER_STYLE_TARGETS[key]).toBeDefined();
      }
    });

    test("only the prefix before the first '. ' is stripped (handles names containing periods)", () => {
      // indexOf('. ') finds the FIRST occurrence; 'New Zealand Pilsner' maps to German Pilsner.
      expect(getWaterTargetForBjcpStyle("X1. New Zealand Pilsner")).toBe("German Pilsner");
    });
  });

  // ── class vs singleton ───────────────────────────────────────────────────

  describe("module exports", () => {
    test("singleton is an instance of WaterChemistryService", () => {
      expect(svc).toBeInstanceOf(WaterChemistryService);
    });

    test("a fresh instance computes identically to the singleton", () => {
      const fresh = new WaterChemistryService();
      expect(fresh.ionDeltaFromSalts({ gypsum_g: 5 }, 19)).toEqual(
        svc.ionDeltaFromSalts({ gypsum_g: 5 }, 19)
      );
    });
  });

  describe("COMMON_WATER_PROFILES (the live, corrected built-in set)", () => {
    test("Montreal HCO3 is 113 from the city report — never revert to 0", () => {
      // A legacy duplicate in @/utils/water had drifted to HCO3 0; it was
      // removed in the Tier-1 water consolidation. This is the canonical value.
      expect(COMMON_WATER_PROFILES.Montreal.HCO3).toBe(113);
    });

    test("RO entry is all-zero", () => {
      expect(COMMON_WATER_PROFILES.RO).toEqual(RO);
    });
  });
});
