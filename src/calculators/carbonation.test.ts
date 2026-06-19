import { describe, test, expect } from "vitest";
import {
  carbonationPsi,
  psiToBar,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from "./carbonation";

describe("carbonation", () => {
  // ── carbonationPsi ──────────────────────────────────────────────────────
  //
  // carbonationPsi(T °F, V volumes CO₂) returns the regulator PSI needed to
  // hold V volumes of CO₂ in beer held at T, clamped at a floor of 0.
  //
  // These tests deliberately do NOT re-derive expected PSI by re-plugging the
  // source's own polynomial coefficients (that would only prove the literal is
  // evaluated correctly, not that the formula is right). Instead the anchors
  // come from independent published force-carbonation charts/calculators, and
  // the coefficient-pinning tests use finite-difference identities that depend
  // only on the published *form* of the standard force-carbonation polynomial.

  describe("carbonationPsi", () => {
    // ── External chart anchors ──
    // Published keg-carbonation calculators/charts (Brewer's Friend,
    // kegerators.com) report, at 40 °F: 11 PSI → ~2.39 vol and 12 PSI → ~2.47
    // vol. Interpolating, 2.5 vol at 40 °F lands a hair above 12 PSI (~12.3),
    // and the slightly colder 38 °F needs marginally less (~11.3). Tolerances
    // below (toBeCloseTo(_, 0) ⇒ |Δ| < 0.5 PSI) are wide enough to absorb the
    // ~±0.3 PSI spread between published charts but tight enough to reject a
    // single mistyped coefficient: e.g. the T·V coefficient 0.173354 → 0.137354
    // would shift the 38/2.5 result by 0.036·38·2.5 ≈ 3.4 PSI, far outside 0.5.

    test("38°F / 2.5 vol ≈ 11.3 PSI (matches published keg chart)", () => {
      // External: at 38 °F the canonical kegging starting point for ~2.5 vol is
      // ~11–12 PSI; Brewer's Friend-class calculators read ~11.3 here.
      expect(carbonationPsi(38, 2.5)).toBeCloseTo(11.3, 0);
    });

    test("40°F / 2.5 vol ≈ 12.3 PSI (matches published keg chart)", () => {
      // External: kegerators.com / Brewer's Friend give 12 PSI → 2.47 vol and
      // 11 PSI → 2.39 vol at 40 °F, so 2.5 vol ⇒ just over 12 PSI (~12.3).
      expect(carbonationPsi(40, 2.5)).toBeCloseTo(12.3, 0);
    });

    test("50°F / 3.0 vol ≈ 24 PSI (published warm/high-carb regime)", () => {
      // External: at 50 °F charts show ~13 PSI → ~2.15 vol and ~15 PSI →
      // ~2.3 vol (≈7 PSI per added volume in this corner), so reaching 3.0 vol
      // at 50 °F lands in the low-to-mid 20s PSI. toBeCloseTo(24, 0) ⇒
      // |Δ| < 0.5 PSI; the wider band test below absorbs cross-chart spread.
      expect(carbonationPsi(50, 3.0)).toBeCloseTo(24, 0);
    });

    test("50°F / 3.0 vol sits in the published 22–26 PSI band", () => {
      // Wider external band for the warm/high-carbonation extreme.
      const psi = carbonationPsi(50, 3.0);
      expect(psi).toBeGreaterThan(22);
      expect(psi).toBeLessThan(26);
    });

    test("high-volume soda/seltzer: 40°F / 4.5 vol in the 30–37 PSI band", () => {
      // The −0.0684226·V² term only matters at high V (≈ −1.39 PSI at V=4.5 vs
      // −0.43 at V=2.5), so it is invisible to the 2.0–3.0 vol tests above.
      // Force-carbonation charts put cold (≈40 °F) seltzer/soda territory
      // (4–5 vol) in the low-to-mid 30s PSI. This band constrains the regime
      // where the quadratic-in-V term is finally significant.
      const psi = carbonationPsi(40, 4.5);
      expect(psi).toBeGreaterThan(30);
      expect(psi).toBeLessThan(37);
    });

    // ── Coefficient-pinning via finite differences ──
    // For any polynomial the centered 2nd difference isolates the leading
    // quadratic coefficient: f(x−h) − 2f(x) + f(x+h) = 2·a·h². The standard
    // published force-carbonation polynomial has a T² coefficient of
    // 0.00116512 and a V² coefficient of −0.0684226. These checks therefore
    // constrain the curvature coefficients independently of any single-point
    // evaluation and would catch a sign flip or transposition the coarse
    // monotonicity comparisons miss. (Clamp is a no-op in these positive ranges.)

    test("curvature in V pins the published V² coefficient (−0.0684226)", () => {
      // 2nd difference in V at fixed T, h = 1 vol ⇒ 2·(−0.0684226)·1² = −0.1368452
      const T = 40;
      const d2v =
        carbonationPsi(T, 2.0) - 2 * carbonationPsi(T, 3.0) + carbonationPsi(T, 4.0);
      expect(d2v).toBeCloseTo(2 * -0.0684226, 6);
    });

    test("curvature in T pins the published T² coefficient (0.00116512)", () => {
      // 2nd difference in T at fixed V, h = 1 °F ⇒ 2·(0.00116512)·1² = 0.00233024
      const V = 2.5;
      const d2t =
        carbonationPsi(39, V) - 2 * carbonationPsi(40, V) + carbonationPsi(41, V);
      expect(d2t).toBeCloseTo(2 * 0.00116512, 6);
    });

    // ── Clamp behaviour: floor at 0, and the transition ──

    test("clamps to 0 when the polynomial goes negative (32°F / 0 vol)", () => {
      // At 0 carbonation volumes the saturation pressure is physically ~0/below
      // atmospheric, so the raw fit is strongly negative and must floor at 0.
      expect(carbonationPsi(32, 0)).toBe(0);
    });

    test("never returns negative even for extreme cold / low target", () => {
      // Below freezing, near-zero target: raw fit is strongly negative.
      expect(carbonationPsi(0, 0)).toBeGreaterThanOrEqual(0);
      expect(carbonationPsi(20, 0.5)).toBeGreaterThanOrEqual(0);
    });

    test("floor affects only negatives — small positive output is NOT clamped", () => {
      // Straddle the zero-crossing at 35 °F: as V rises, the fit passes through
      // 0. Just below the crossing the result must floor to exactly 0; just
      // above it must return the (small, strictly positive) raw value, i.e. the
      // clamp is a no-op for non-negative inputs. This distinguishes
      // Math.max(0, …) from a Math.min, a sign error, or a clamp that also caps
      // the positive range.
      expect(carbonationPsi(35, 1.5)).toBe(0); // raw ≈ −0.32 → floored
      const justAbove = carbonationPsi(35, 1.6); // raw ≈ +0.69 → passed through
      expect(justAbove).toBeGreaterThan(0);
      expect(justAbove).toBeLessThan(2); // genuinely small, not clamped to some constant
      // And a comfortably-positive normal input is returned untouched.
      expect(carbonationPsi(38, 2.5)).toBeGreaterThan(10);
    });

    // ── Monotonicity (with the real low-V caveat documented) ──

    test("monotonic in temperature across the brewing range at fixed volumes", () => {
      // ∂P/∂T = −0.0101059 + 2·0.00116512·T + 0.173354·V. At a typical
      // carbonation target (V ≥ ~2) this is positive for all brewing temps, so
      // PSI strictly increases with temperature. Step through several points
      // rather than a single coarse pair so a small slope error is visible.
      const psis = [34, 38, 42, 46, 50].map((t) => carbonationPsi(t, 2.5));
      for (let i = 1; i < psis.length; i++) {
        expect(psis[i]).toBeGreaterThan(psis[i - 1]);
      }
    });

    test("monotonicity in temperature is NOT universal — fails in the cold/low-V corner", () => {
      // ∂P/∂T at V=0 is −0.0101059 + 0.00233024·T, which is NEGATIVE for
      // T < ~4.3 °F. So the blanket "warmer ⇒ more PSI" claim is false at very
      // low volumes/temps. Here the raw fit is negative throughout and floors
      // to 0, so the *observable* output is flat (both clamped) — documenting
      // that the slope sign genuinely flips in this corner.
      expect(carbonationPsi(33, 0)).toBe(0);
      expect(carbonationPsi(40, 0)).toBe(0);
    });

    test("monotonic in volumes across the brewing range at fixed temperature", () => {
      // ∂P/∂V = 0.173354·T + 4.24267 − 2·0.0684226·V is positive over the
      // brewing range, so a higher carbonation target needs higher pressure.
      const psis = [2.0, 2.4, 2.8, 3.2, 3.6].map((v) => carbonationPsi(40, v));
      for (let i = 1; i < psis.length; i++) {
        expect(psis[i]).toBeGreaterThan(psis[i - 1]);
      }
    });
  });

  // ── psiToBar ────────────────────────────────────────────────────────────
  //
  // Physical constant: 1 psi = 0.0689476 bar (1 bar = 14.5037744 psi).

  describe("psiToBar", () => {
    test("12 PSI = 0.827 bar", () => {
      // 12 × 0.0689476 = 0.8273712 bar
      expect(psiToBar(12)).toBeCloseTo(0.82737, 4);
    });

    test("1 PSI = 0.0689476 bar (the conversion factor itself)", () => {
      expect(psiToBar(1)).toBeCloseTo(0.0689476, 6);
    });

    test("0 PSI = 0 bar", () => {
      expect(psiToBar(0)).toBe(0);
    });

    test("≈14.5 PSI ≈ 1 bar (atmospheric reference)", () => {
      // 14.5037744 psi = 1 bar exactly, so 14.5 psi ≈ 0.99974 bar.
      expect(psiToBar(14.5037744)).toBeCloseTo(1, 5);
    });
  });

  // ── celsiusToFahrenheit ─────────────────────────────────────────────────
  //
  // Definition: °F = °C·9/5 + 32.

  describe("celsiusToFahrenheit", () => {
    test("0°C = 32°F (freezing point of water)", () => {
      expect(celsiusToFahrenheit(0)).toBe(32);
    });

    test("100°C = 212°F (boiling point of water)", () => {
      expect(celsiusToFahrenheit(100)).toBe(212);
    });

    test("4°C = 39.2°F (typical keezer temperature)", () => {
      // 4·9/5 + 32 = 7.2 + 32 = 39.2
      expect(celsiusToFahrenheit(4)).toBeCloseTo(39.2, 6);
    });

    test("-40°C = -40°F (the scales cross)", () => {
      expect(celsiusToFahrenheit(-40)).toBe(-40);
    });
  });

  // ── fahrenheitToCelsius ─────────────────────────────────────────────────
  //
  // Definition: °C = (°F − 32)·5/9.

  describe("fahrenheitToCelsius", () => {
    test("32°F = 0°C (freezing point of water)", () => {
      expect(fahrenheitToCelsius(32)).toBe(0);
    });

    test("212°F = 100°C (boiling point of water)", () => {
      expect(fahrenheitToCelsius(212)).toBe(100);
    });

    test("38°F ≈ 3.333°C (fridge temp)", () => {
      // (38 − 32)·5/9 = 6·5/9 = 30/9 = 3.3333…
      expect(fahrenheitToCelsius(38)).toBeCloseTo(3.3333, 4);
    });

    test("-40°F = -40°C (the scales cross)", () => {
      expect(fahrenheitToCelsius(-40)).toBe(-40);
    });
  });

  // ── round-trip invariants ───────────────────────────────────────────────

  describe("temperature conversion round-trips", () => {
    test("C → F → C is the identity", () => {
      // Inverse functions: fahrenheitToCelsius(celsiusToFahrenheit(c)) === c
      for (const c of [-10, 0, 4, 18, 37.5, 100]) {
        expect(fahrenheitToCelsius(celsiusToFahrenheit(c))).toBeCloseTo(c, 9);
      }
    });

    test("F → C → F is the identity", () => {
      for (const f of [0, 32, 38, 68, 212]) {
        expect(celsiusToFahrenheit(fahrenheitToCelsius(f))).toBeCloseTo(f, 9);
      }
    });
  });
});
