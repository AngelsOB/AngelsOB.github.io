/**
 * Strike water temperature calculation.
 *
 * Uses Palmer's heat balance equation:
 *   strikeTemp = targetTemp + (0.41 / thickness) × (targetTemp − grainTemp)
 *
 * Where 0.41 is the grain/water heat capacity ratio (c_grain/c_water ≈ 1.71/4.18).
 * Source: John Palmer, "How to Brew" (4th ed., 2017).
 *
 * @param targetMashTempC  Target mash temperature in °C
 * @param grainTempC       Grain temperature in °C (typical room temp: 20°C)
 * @param thicknessLPerKg  Mash thickness in L/kg (typical: 2.5–4.0)
 * @returns Strike water temperature in °C
 */
export function calculateStrikeTemp(
  targetMashTempC: number,
  grainTempC: number,
  thicknessLPerKg: number
): number {
  const grainHeatRatio = 0.41;
  const strikeTemp =
    targetMashTempC +
    (grainHeatRatio / thicknessLPerKg) * (targetMashTempC - grainTempC);
  return Math.round(strikeTemp * 10) / 10;
}

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32 * 10) / 10;
}

export function fahrenheitToCelsius(f: number): number {
  return Math.round((((f - 32) * 5) / 9) * 10) / 10;
}
