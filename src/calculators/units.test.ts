import { describe, test, expect } from "vitest";

import {
  LITERS_TO_GALLONS,
  KG_TO_LBS,
  GRAVITY_TO_POINTS,
  gravityPoints,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from "./units";

describe("units", () => {
  test("conversion constants match the values long used in the services", () => {
    expect(LITERS_TO_GALLONS).toBe(0.264172);
    expect(KG_TO_LBS).toBe(2.20462);
    expect(GRAVITY_TO_POINTS).toBe(1000);
  });

  test("gravityPoints = (SG - 1) * 1000", () => {
    expect(gravityPoints(1.0)).toBeCloseTo(0, 10);
    expect(gravityPoints(1.06)).toBeCloseTo(60, 10);
    expect(gravityPoints(1.042)).toBeCloseTo(42, 10);
    // exact form parity with the old inline `(sg - 1) * 1000`
    expect(gravityPoints(1.05)).toBe((1.05 - 1) * 1000);
  });

  test("celsiusToFahrenheit (unrounded) matches (c * 9) / 5 + 32", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(celsiusToFahrenheit(20)).toBe(68);
    expect(celsiusToFahrenheit(66.6)).toBe((66.6 * 9) / 5 + 32);
  });

  test("fahrenheitToCelsius (unrounded) matches ((f - 32) * 5) / 9", () => {
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBe(100);
    expect(fahrenheitToCelsius(70)).toBe(((70 - 32) * 5) / 9);
  });
});
