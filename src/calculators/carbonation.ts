/**
 * Empirical fit for CO₂ equilibrium pressure used for force carbonation.
 * Returns regulator PSI required to hold the given volumes of CO₂ at the
 * given beer temperature.
 *
 * Source: standard force-carbonation polynomial used by most homebrew
 * carbonation calculators.
 *
 * P(psi) = -16.6999 - 0.0101059·T + 0.00116512·T² + 0.173354·T·V
 *        + 4.24267·V - 0.0684226·V²
 * where T = °F, V = target volumes CO₂.
 */
export function carbonationPsi(tempF: number, volumes: number): number {
  const t = tempF;
  const v = volumes;
  return Math.max(
    0,
    -16.6999 -
      0.0101059 * t +
      0.00116512 * t * t +
      0.173354 * t * v +
      4.24267 * v -
      0.0684226 * v * v,
  );
}

export function psiToBar(psi: number): number {
  return psi * 0.0689476;
}

export { celsiusToFahrenheit, fahrenheitToCelsius } from "./units";
