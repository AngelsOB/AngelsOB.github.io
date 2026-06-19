import { describe, test, expect } from "vitest";
import { gravityPoints, postBoilVolume } from "./boilOff";

describe("boilOff", () => {
  // ── gravityPoints ───────────────────────────────────────────────────────
  // points = (SG - 1) * 1000.  This is the standard "gravity points" / GU
  // definition used throughout brewing (e.g. 1.042 → 42 points).

  describe("gravityPoints", () => {
    test("1.042 → 42 points", () => {
      // (1.042 - 1) * 1000 = 42
      expect(gravityPoints(1.042)).toBeCloseTo(42, 6);
    });

    test("1.050 → 50 points", () => {
      // (1.050 - 1) * 1000 = 50
      expect(gravityPoints(1.05)).toBeCloseTo(50, 6);
    });

    test("1.000 (water) → 0 points", () => {
      // (1.000 - 1) * 1000 = 0
      expect(gravityPoints(1.0)).toBe(0);
    });

    test("sub-1.000 gravity yields negative points", () => {
      // (0.998 - 1) * 1000 = -2  (e.g. a finished beer below 1.000)
      expect(gravityPoints(0.998)).toBeCloseTo(-2, 6);
    });

    test("high gravity 1.100 → 100 points", () => {
      // (1.100 - 1) * 1000 = 100
      expect(gravityPoints(1.1)).toBeCloseTo(100, 6);
    });

    test("linear & monotonic in SG: equal SG steps give equal point steps", () => {
      // Each +0.001 in SG must add exactly +1 point (slope = 1000).
      const a = gravityPoints(1.04);
      const b = gravityPoints(1.041);
      const c = gravityPoints(1.042);
      expect(b - a).toBeCloseTo(1, 6);
      expect(c - b).toBeCloseTo(1, 6);
    });
  });

  // ── postBoilVolume ──────────────────────────────────────────────────────
  // Sugar is conserved during the boil (only water evaporates):
  //   V_pre * P_pre = V_post * P_post   →   V_post = V_pre * P_pre / P_target
  // where P = (SG - 1) * 1000.

  describe("postBoilVolume", () => {
    test("concentrating wort: 30 L @ 1.040 to hit 1.050 → 24 L", () => {
      // P_pre = 40, P_target = 50.
      // V_post = 30 * 40 / 50 = 24 L.
      // Sanity: 30 L * 40 pts = 1200 GU; 24 L * 50 pts = 1200 GU. Conserved.
      expect(postBoilVolume(30, 1.04, 1.05)).toBeCloseTo(24, 6);
    });

    test("textbook case: 25 L @ 1.040 to 1.050 → 20 L", () => {
      // V_post = 25 * 40 / 50 = 20 L. (1000 GU conserved both sides.)
      expect(postBoilVolume(25, 1.04, 1.05)).toBeCloseTo(20, 6);
    });

    test("no concentration when target == pre-boil gravity → volume unchanged", () => {
      // P_pre == P_target → V_post = V_pre * P/P = V_pre.
      // 22 L @ 1.045 targeting 1.045 → 22 L.
      expect(postBoilVolume(22, 1.045, 1.045)).toBeCloseTo(22, 6);
    });

    test("diluting (target below pre-boil) yields a LARGER post-boil volume", () => {
      // P_pre = 60, P_target = 40 → V_post = 20 * 60 / 40 = 30 L (> 20).
      // (Physically this is dilution, not boil-off, but the conservation
      // relation is symmetric and the formula must still hold.)
      expect(postBoilVolume(20, 1.06, 1.04)).toBeCloseTo(30, 6);
    });

    test("independently-derived case: 26.5 L @ 1.038 to 1.055 → 18.30909 L", () => {
      // Hand-derived from the conservation formula, NOT from function output:
      //   P_pre    = (1.038 - 1) * 1000 = 38
      //   P_target = (1.055 - 1) * 1000 = 55
      //   V_post   = 26.5 * 38 / 55 = 1007 / 55 = 18.309090909... L
      // This irrational-ish result pins the *constant* (1000) and *formula*:
      // a wrong constant (e.g. *100) would shift this absolute value, so this
      // assertion — unlike the old V_post*P_target == V_pre*P_pre identity —
      // is not satisfied by an arbitrary (a*b)/c implementation.
      expect(postBoilVolume(26.5, 1.038, 1.055)).toBeCloseTo(18.30909, 4);

      // Secondary sanity (conservation), kept but NOT the primary assertion:
      // 26.5 L * 38 pts = 1007 GU; 18.30909 L * 55 pts ≈ 1007 GU.
      const vPost = postBoilVolume(26.5, 1.038, 1.055);
      expect(vPost * gravityPoints(1.055)).toBeCloseTo(1007, 6);
    });

    test("higher target OG → smaller post-boil volume (monotonic, boil longer)", () => {
      // Same pre-boil charge; a stronger target means more water must leave,
      // so the resulting volume is smaller.
      const lessConcentrated = postBoilVolume(25, 1.04, 1.048);
      const moreConcentrated = postBoilVolume(25, 1.04, 1.06);
      expect(moreConcentrated).toBeLessThan(lessConcentrated);
    });

    test("larger pre-boil volume → larger post-boil volume (proportional)", () => {
      // Doubling the pre-boil volume at fixed gravities doubles the result.
      const small = postBoilVolume(20, 1.04, 1.05);
      const big = postBoilVolume(40, 1.04, 1.05);
      expect(big).toBeCloseTo(small * 2, 6);
    });

    // ── Non-physical inputs → NaN (guarded) ───────────────────────────────
    // postBoilVolume returns NaN whenever there is no physical answer: a
    // non-positive volume, or either gravity at/below water (points <= 0).
    // Callers guard on Number.isFinite, so NaN can't propagate as a bogus
    // negative/Infinite "volume". Each case is reasoned from the formula and
    // the guard condition, not pasted from the implementation.

    test("target OG of 1.000 (zero target points) → NaN", () => {
      // P_target = (1.000 - 1) * 1000 = 0 → not > 0 → guarded to NaN.
      expect(postBoilVolume(25, 1.04, 1.0)).toBeNaN();
    });

    test("zero pre-boil volume → NaN (non-positive volume)", () => {
      // preBoilVol = 0 is not > 0 → guarded to NaN.
      expect(postBoilVolume(0, 1.04, 1.05)).toBeNaN();
    });

    test("pre-boil at water gravity (1.000) → NaN (no extract to concentrate)", () => {
      // P_pre = 0 is not > 0 → guarded to NaN.
      expect(postBoilVolume(30, 1.0, 1.05)).toBeNaN();
    });

    test("target OG below 1.000 (negative target points) → NaN", () => {
      // P_target = (0.998 - 1)*1000 = -2 is not > 0 → guarded (was -500 L).
      expect(postBoilVolume(25, 1.04, 0.998)).toBeNaN();
    });

    test("negative pre-boil volume → NaN", () => {
      // preBoilVol = -30 is not > 0 → guarded (was -24 L).
      expect(postBoilVolume(-30, 1.04, 1.05)).toBeNaN();
    });

    test("pre-boil SG below 1.000 (negative numerator) → NaN", () => {
      // P_pre = (0.998 - 1)*1000 = -2 is not > 0 → guarded (was -1.2 L).
      expect(postBoilVolume(30, 0.998, 1.05)).toBeNaN();
    });
  });
});
