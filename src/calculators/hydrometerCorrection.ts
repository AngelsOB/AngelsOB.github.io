/**
 * Density of water at a given temperature (°C) using the Kell (1975) equation.
 * Returns density in kg/m³. Valid for 0–150 °C.
 */
function waterDensity(tempC: number): number {
  const t = tempC;
  return (
    (999.83952 +
      16.945176 * t -
      7.9870401e-3 * t * t -
      46.170461e-6 * t * t * t +
      105.56302e-9 * t * t * t * t -
      280.54253e-12 * t * t * t * t * t) /
    (1 + 16.897850e-3 * t)
  );
}

/**
 * Correct a hydrometer SG reading for temperature.
 *
 * A hydrometer calibrated at Tcal reads accurately only at that temperature.
 * At other temperatures the density of water changes, shifting the reading.
 *
 * Formula: correctedSG = measuredSG × ρ_water(Tcal) / ρ_water(T_sample)
 */
export function correctHydrometer(
  measuredSG: number,
  sampleTempC: number,
  calTempC: number,
): number {
  const rhoCal = waterDensity(calTempC);
  const rhoSample = waterDensity(sampleTempC);
  return measuredSG * (rhoCal / rhoSample);
}
