/**
 * Shared unit-conversion constants and pure helpers for the calculators and the
 * recipe calculation services.
 *
 * The constant values intentionally match the literals long used across the
 * recipe calculation services (0.264172, 2.20462) so existing numeric output is
 * preserved exactly. `recipeExport.ts` and `recipeTextParser.ts` keep their own
 * higher-precision constants where their callers rely on them.
 */

/** Litres → US gallons. */
export const LITERS_TO_GALLONS = 0.264172;

/** Kilograms → pounds. */
export const KG_TO_LBS = 2.20462;

/** Multiplier turning a gravity reading into "points": (SG − 1) × 1000. */
export const GRAVITY_TO_POINTS = 1000;

/** Gravity "points" = (SG − 1) × 1000. e.g. 1.060 → 60 */
export function gravityPoints(sg: number): number {
  return (sg - 1) * GRAVITY_TO_POINTS;
}

/** Celsius → Fahrenheit (unrounded). */
export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

/** Fahrenheit → Celsius (unrounded). */
export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}
