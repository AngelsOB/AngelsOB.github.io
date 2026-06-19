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

/**
 * ASBC polynomial converting specific gravity to degrees Plato:
 *   °P = A + B·SG + C·SG² + D·SG³
 * Reference: ASBC Methods of Analysis.
 */
export const PLATO_COEFF_A = -616.868;
export const PLATO_COEFF_B = 1111.14;
export const PLATO_COEFF_C = -630.272;
export const PLATO_COEFF_D = 135.997;

/** Specific gravity → degrees Plato (ASBC polynomial). */
export function sgToPlato(sg: number): number {
  const s2 = sg * sg;
  const s3 = s2 * sg;
  return PLATO_COEFF_A + PLATO_COEFF_B * sg + PLATO_COEFF_C * s2 + PLATO_COEFF_D * s3;
}
