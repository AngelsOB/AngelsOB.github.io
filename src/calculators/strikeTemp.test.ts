import { describe, test, expect } from "vitest";
import {
  calculateStrikeTemp,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from "./strikeTemp";

describe("strikeTemp", () => {
  // ── Palmer Strike Water Temperature ───────────────────────────────────────
  // Formula (Palmer, "How to Brew" 4th ed.):
  //   Tw = Tmash + (0.41 / thickness) × (Tmash − Tgrain)
  // 0.41 = c_grain / c_water heat-capacity ratio (≈ 1.71 / 4.18). Result is
  // rounded to one decimal place (0.1 °C) by the implementation.

  describe("calculateStrikeTemp", () => {
    test("typical single infusion: 66°C target, 20°C grain, 3.0 L/kg", () => {
      // 66 + (0.41/3.0)×(66−20) = 66 + 0.1366667×46 = 66 + 6.286667 = 72.286…
      // round(722.866…)/10 = 723/10 = 72.3
      const result = calculateStrikeTemp(66, 20, 3.0);
      expect(result).toBeCloseTo(72.3, 5);
    });

    test("thicker mash 2.5 L/kg: 65°C target, 20°C grain", () => {
      // 65 + (0.41/2.5)×(65−20) = 65 + 0.164×45 = 65 + 7.38 = 72.38
      // round(723.8)/10 = 724/10 = 72.4
      const result = calculateStrikeTemp(65, 20, 2.5);
      expect(result).toBeCloseTo(72.4, 5);
    });

    test("thin mash 3.21 L/kg: 67°C (≈152°F) target, 20°C grain", () => {
      // 67 + (0.41/3.21)×(67−20) = 67 + 0.1277259×47 = 67 + 6.003115 = 73.003…
      // round(730.03)/10 = 730/10 = 73.0
      const result = calculateStrikeTemp(67, 20, 3.21);
      expect(result).toBeCloseTo(73.0, 5);
    });

    test("very thick decoction-style mash 2.0 L/kg: 68°C target, 18°C grain", () => {
      // 68 + (0.41/2.0)×(68−18) = 68 + 0.205×50 = 68 + 10.25 = 78.25
      // round(782.5)/10 = 783/10 = 78.3 (Math.round is round-half-up)
      const result = calculateStrikeTemp(68, 18, 2.0);
      expect(result).toBeCloseTo(78.3, 5);
    });

    test("cold grain 10°C with thin 3.5 L/kg mash, 66°C target", () => {
      // 66 + (0.41/3.5)×(66−10) = 66 + 0.1171429×56 = 66 + 6.56 = 72.56
      // round(725.6)/10 = 726/10 = 72.6
      const result = calculateStrikeTemp(66, 10, 3.5);
      expect(result).toBeCloseTo(72.6, 5);
    });

    // ── Boundary / degenerate cases ─────────────────────────────────────────

    test("grain already at mash temp → no overshoot, strike = target", () => {
      // (Tmash − Tgrain) = 0 ⇒ correction term = 0 ⇒ Tw = Tmash = 67.0
      const result = calculateStrikeTemp(67, 67, 3.0);
      expect(result).toBeCloseTo(67.0, 5);
    });

    test("grain warmer than target → strike temp falls below target", () => {
      // 60 + (0.41/3.0)×(60−70) = 60 + 0.1366667×(−10) = 60 − 1.366667 = 58.633…
      // round(586.33…)/10 = 586/10 = 58.6
      const result = calculateStrikeTemp(60, 70, 3.0);
      expect(result).toBeCloseTo(58.6, 5);
    });

    test("near-freezing grain 0°C, 65°C target, 3.0 L/kg", () => {
      // 65 + (0.41/3.0)×(65−0) = 65 + 0.1366667×65 = 65 + 8.883333 = 73.883…
      // round(738.83…)/10 = 739/10 = 73.9
      const result = calculateStrikeTemp(65, 0, 3.0);
      expect(result).toBeCloseTo(73.9, 5);
    });

    // ── Invariants ──────────────────────────────────────────────────────────

    test("strike temp always exceeds the mash target when grain is cooler", () => {
      // Grain cooler than target ⇒ (Tmash − Tgrain) > 0 ⇒ correction > 0 ⇒ Tw > Tmash.
      expect(calculateStrikeTemp(66, 20, 3.0)).toBeGreaterThan(66);
    });

    test("warmer grain needs less heating → lower strike temp", () => {
      // Monotonic decreasing in Tgrain: raising Tgrain shrinks (Tmash − Tgrain),
      // so the positive correction term — and the strike temp — falls.
      const cold = calculateStrikeTemp(66, 10, 3.0);
      const warm = calculateStrikeTemp(66, 25, 3.0);
      expect(warm).toBeLessThan(cold);
    });

    test("thinner mash (more water per kg grain) gives a lower strike temp", () => {
      // Monotonic in thickness: the 0.41/thickness factor shrinks as thickness
      // grows, so a thinner (higher L/kg) mash needs less overshoot.
      const thick = calculateStrikeTemp(66, 20, 2.0);
      const thin = calculateStrikeTemp(66, 20, 4.0);
      expect(thin).toBeLessThan(thick);
    });

    test("higher mash target raises the strike temp (all else equal)", () => {
      // Monotonic increasing in Tmash for fixed grain temp and thickness:
      // both the base term and the (Tmash − Tgrain) correction rise with Tmash.
      const lower = calculateStrikeTemp(63, 20, 3.0);
      const higher = calculateStrikeTemp(70, 20, 3.0);
      expect(higher).toBeGreaterThan(lower);
    });

    test("result is rounded to one decimal place (×10 is an integer)", () => {
      // The contract rounds to 0.1 °C, so the value × 10 must be an integer.
      const result = calculateStrikeTemp(66.7, 19.4, 2.73);
      expect(result * 10).toBe(Math.round(result * 10));
    });

    // ── thickness = 0 boundary (division by zero) ────────────────────────────
    // The function does not guard against thickness = 0, which is a plausible bad
    // value from a UI field. The behavior follows directly from IEEE-754:
    //   factor = 0.41 / 0 = +Infinity.
    // These tests pin the *current* (unguarded) contract derived from the math —
    // not from running the code. If a validation guard is later added (throw or
    // clamp), these become deliberate, test-covered changes rather than silent ones.

    test("thickness 0 with grain cooler than target → +Infinity (no guard)", () => {
      // factor = 0.41/0 = +Infinity; ×(66−20)=+46 ⇒ +Infinity; +66 ⇒ +Infinity.
      // Math.round(Infinity × 10) / 10 = Infinity.
      expect(calculateStrikeTemp(66, 20, 0)).toBe(Infinity);
    });

    test("thickness 0 with grain warmer than target → −Infinity (no guard)", () => {
      // factor = 0.41/0 = +Infinity; ×(60−70)=−10 ⇒ −Infinity; +60 ⇒ −Infinity.
      expect(calculateStrikeTemp(60, 70, 0)).toBe(-Infinity);
    });

    test("thickness 0 with grain at target → NaN (∞ × 0 is NaN)", () => {
      // factor = 0.41/0 = +Infinity; ×(66−66)=0 ⇒ Infinity × 0 = NaN (IEEE-754).
      expect(calculateStrikeTemp(66, 66, 0)).toBeNaN();
    });
  });

  // ── Celsius → Fahrenheit ──────────────────────────────────────────────────
  // Reference conversion: F = C × 9/5 + 32, rounded to 0.1 °F. Freezing
  // 0°C=32°F, boiling 100°C=212°F, and the scales cross at −40. Every expected
  // value below is derived from the physics, not from the implementation.
  describe("celsiusToFahrenheit", () => {
    test("0°C = 32°F (freezing point of water)", () => {
      // 0 × 9/5 + 32 = 32
      expect(celsiusToFahrenheit(0)).toBeCloseTo(32, 5);
    });

    test("100°C = 212°F (boiling point of water)", () => {
      // 100 × 9/5 + 32 = 180 + 32 = 212
      expect(celsiusToFahrenheit(100)).toBeCloseTo(212, 5);
    });

    test("20°C = 68°F (room temperature)", () => {
      // 20 × 9/5 + 32 = 36 + 32 = 68
      expect(celsiusToFahrenheit(20)).toBeCloseTo(68, 5);
    });

    test("66.7°C ≈ 152°F (a common single-infusion mash target)", () => {
      // 66.7 × 9/5 + 32 = 120.06 + 32 = 152.06 → round(1520.6)/10 = 152.1
      expect(celsiusToFahrenheit(66.7)).toBeCloseTo(152.1, 5);
    });

    test("−40°C = −40°F (the scales cross)", () => {
      // −40 × 9/5 + 32 = −72 + 32 = −40
      expect(celsiusToFahrenheit(-40)).toBeCloseTo(-40, 5);
    });

    test("result is rounded to one decimal place (×10 is an integer)", () => {
      // c2f rounds to 0.1 °F, so value × 10 must be an integer.
      const result = celsiusToFahrenheit(37.78); // body temperature ≈ 100°F
      expect(result * 10).toBe(Math.round(result * 10));
    });

    test("monotonic: a higher Celsius value yields a higher Fahrenheit value", () => {
      // F = C×9/5 + 32 is strictly increasing in C.
      expect(celsiusToFahrenheit(30)).toBeGreaterThan(celsiusToFahrenheit(20));
    });

    test("round-trips with fahrenheitToCelsius at 66°C mash temp", () => {
      // C → F → C should recover the original (within 0.1 °C rounding):
      // c2f(66) = 150.8°F, f2c(150.8) = 66.0°C.
      expect(fahrenheitToCelsius(celsiusToFahrenheit(66))).toBeCloseTo(66, 1);
    });
  });

  // ── Fahrenheit → Celsius ──────────────────────────────────────────────────
  // Reference conversion: C = (F − 32) × 5/9, rounded to 0.1 °C.

  describe("fahrenheitToCelsius", () => {
    test("32°F = 0°C (freezing point of water)", () => {
      // (32 − 32) × 5/9 = 0
      expect(fahrenheitToCelsius(32)).toBeCloseTo(0, 5);
    });

    test("212°F = 100°C (boiling point of water)", () => {
      // (212 − 32) × 5/9 = 180 × 5/9 = 100
      expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 5);
    });

    test("68°F = 20°C (room temperature)", () => {
      // (68 − 32) × 5/9 = 36 × 5/9 = 20
      expect(fahrenheitToCelsius(68)).toBeCloseTo(20, 5);
    });

    test("−40°F = −40°C (the scales cross)", () => {
      // (−40 − 32) × 5/9 = −72 × 5/9 = −40
      expect(fahrenheitToCelsius(-40)).toBeCloseTo(-40, 5);
    });

    test("152°F ≈ 66.7°C (a common single-infusion mash target)", () => {
      // (152 − 32) × 5/9 = 120 × 5/9 = 66.666… → round(666.66…)/10 = 66.7
      expect(fahrenheitToCelsius(152)).toBeCloseTo(66.7, 5);
    });

    test("monotonic: a higher Fahrenheit value yields a higher Celsius value", () => {
      // C = (F−32)×5/9 is strictly increasing in F.
      expect(fahrenheitToCelsius(80)).toBeGreaterThan(fahrenheitToCelsius(50));
    });

    test("result is rounded to one decimal place (×10 is an integer)", () => {
      // Rounds to 0.1 °C, so value × 10 must be an integer.
      const result = fahrenheitToCelsius(151);
      expect(result * 10).toBe(Math.round(result * 10));
    });

    test("inverts celsiusToFahrenheit's reference at the freezing point", () => {
      // c2f(0) = 32; f2c(32) must return 0.
      expect(fahrenheitToCelsius(celsiusToFahrenheit(0))).toBeCloseTo(0, 5);
    });
  });
});
